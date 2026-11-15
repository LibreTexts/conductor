import logger, { childLogger } from "../../logger.js";
import { z } from "zod";
import { v4 } from "uuid";
import { randomBytes } from "crypto";
import SupportTicket, { SupportTicketFeedEntryInterface, SupportTicketInterface, SupportTicketStatusEnum } from "../../models/supporticket";
import User, { SanitizedUserSelectProjection, UserInterface } from "../../models/user";
import Organization from "../../models/organization";
import { SupportQueueInterface } from "../../models/supportqueue";
import { AssignSupportTicketParams, ChangeTicketStatusParams, SearchTicketsParams } from "../../types/SupportTicket";
import { capitalizeFirstLetter, getPaginationOffset } from "../../util/helpers";
import mailAPI from "../mail";
import authAPI from "../auth";
import { BulkUpdateTicketsValidator } from "../validators/support";
import SupportQueueService from "./support-queue-service";
import SupportTicketMessage, { SupportTicketMessageInterface } from "../../models/supporticketmessage";
import SearchService from "./search-service";
import SlackNotificationService from "./slack-notification-service";
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { subMonths } from "date-fns";
import {
    getDefaultPrivacyFields,
    getPrivacyCloseErrors,
    getPrivacyDueDate,
    PRIVACY_QUEUE_SLUG,
    getPrivacyReminderState,
    isPrivacyDenial,
    PRIVACY_RETENTION_MONTHS,
    PrivacyOutcomeLabels,
    PrivacyTicketError,
    PrivacyTicketFields,
    shouldRedactOnClose,
} from "../../util/privacyTickets";
import { CreateTicketValidator, PrivacyUpdateFieldsType } from "../validators/support";
const supportTicketLog = childLogger("support-tickets");

export default class SupportTicketService {
    async getTicket(uuid: string): Promise<SupportTicketInterface | null> {
        try {
            return await SupportTicket.findOne({ uuid }).populate('queue').populate('assignedUsers').populate('user').orFail();
        } catch (err) {
            throw err;
        }
    }

    async assignTicket({
        uuid,
        assigned,
        assigner,
    }: AssignSupportTicketParams): Promise<SupportTicketInterface> {
        try {
            const ticket = await SupportTicket.findOne({ uuid }).populate('queue').orFail();

            const assignerUser = await User.findOne({ uuid: assigner }).orFail();

            // Calculate additions and removals
            const currentAssignees = ticket.assignedUUIDs?.map(a => a.toString()) || [];
            const newAssignees = assigned.filter(a => !currentAssignees.includes(a));

            const assignees = await User.find({ uuid: { $in: assigned } }).orFail();
            const newAssigneeEmails = assignees
                .filter(a => newAssignees.includes(a.uuid))
                .map(a => a.email);

            const feedEntry = this._createFeedEntry_Assigned(
                `${assignerUser.firstName} ${assignerUser.lastName}`,
                assignees.map(a => `${a.firstName} ${a.lastName}`),
            );

            const messages = await this.getTicketMessages(ticket.uuid, "general");

            ticket.assignedUUIDs = assigned;
            ticket.status = ticket.status === "awaiting_requester" ? "awaiting_requester" : messages.length > 0 ? "in_progress" : "assigned";
            ticket.feed = [...(ticket.feed || []), feedEntry];
            await ticket.save();
            await this.upsertToSearchIndex(uuid);

            if (newAssigneeEmails.length === 0) {
                return ticket; // No need to send emails
            }

            await this.sendAssignmentEmails(
                ticket,
                newAssigneeEmails,
                assignerUser.firstName
            );

            return ticket;
        } catch (err) {
            throw err;
        }
    }

    /**
     * Automatically assigns a newly-created ticket to the support staff configured on its queue.
     * Unlike {@link assignTicket}, there is no human assigner: the configured UUIDs are applied
     * directly, a system-attributed feed entry is written, and the standard assignment email is
     * sent. Configured users are re-validated against the support roster so stale UUIDs (deleted
     * or de-roled users) are silently skipped.
     */
    async autoAssignNewTicket(ticket: SupportTicketInterface, assigneeUUIDs: string[]): Promise<SupportTicketInterface> {
        try {
            if (!assigneeUUIDs || assigneeUUIDs.length === 0) return ticket;

            // Only auto-assign users who currently hold a libretexts support/superadmin role
            const assignees = await User.find({
                uuid: { $in: assigneeUUIDs },
                roles: {
                    $elemMatch: {
                        org: "libretexts",
                        role: { $in: ["superadmin", "support"] },
                    },
                },
            });

            if (assignees.length === 0) return ticket; // No valid assignees, leave unassigned

            const validUUIDs = assignees.map(a => a.uuid);

            // Ensure the queue is populated for the assignment email (ticket_descriptor)
            if (!ticket.queue) {
                await ticket.populate("queue");
            }

            const feedEntry = this._createFeedEntry_AutoAssigned(
                assignees.map(a => `${a.firstName} ${a.lastName}`),
            );

            ticket.assignedUUIDs = validUUIDs;
            ticket.status = "assigned";
            ticket.feed = [...(ticket.feed || []), feedEntry];
            await ticket.save();
            await this.upsertToSearchIndex(ticket.uuid);

            await this.sendAssignmentEmails(
                ticket,
                assignees.map(a => a.email),
                "the LibreTexts Support system",
            );

            return ticket;
        } catch (err) {
            throw err;
        }
    }

    async bulkUpdateTickets({ tickets, assignee, priority, queue, status, callingUserId, canEditPrivacy }: z.infer<typeof BulkUpdateTicketsValidator>['body'] & { callingUserId: string; canEditPrivacy: boolean; }) {
        try {
            const queueService = new SupportQueueService();
            const ticketsToUpdate = await SupportTicket.find({ uuid: { $in: tickets } }).orFail();
            const callingUser = await User.findOne({ uuid: callingUserId }).orFail();

            // Validate every ticket before writing any, so a rejected batch leaves nothing half-applied
            const movingToPrivacy = queue?.toLowerCase() === PRIVACY_QUEUE_SLUG;
            if (!canEditPrivacy && (movingToPrivacy || ticketsToUpdate.some(t => t.privacy))) {
                throw new PrivacyTicketError("Only support staff can change privacy inquiries");
            }
            if (queue) {
                ticketsToUpdate.forEach(t => this.privacyFieldsForQueueMove(t, queue));
            }
            if (status) {
                ticketsToUpdate.forEach(t =>
                    this.assertPrivacyStatusChange(t, status, t.privacy ?? (movingToPrivacy ? {} : undefined))
                );
            }

            const queueExists = queue ? await queueService.getQueueBySlug(queue) : null;
            if (queue && !queueExists) {
                throw new Error(`Queue with slug ${queue} does not exist.`);
            }

            /*
             * Phases run in order: assignTicket saves a full document, so running it alongside the
             * status change could reopen a ticket after its close email/redaction. Status goes last.
             */
            if (assignee && assignee.length > 0) {
                await Promise.all(ticketsToUpdate.map(ticket => this.assignTicket({
                    uuid: ticket.uuid,
                    assigned: assignee,
                    assigner: callingUserId,
                })));
            }

            if (priority) {
                await Promise.all(ticketsToUpdate.map(ticket => this.changeTicketPriority(
                    ticket.uuid,
                    priority,
                    `${callingUser.firstName} ${callingUser.lastName}`,
                )));
            }

            if (queueExists) {
                await Promise.all(ticketsToUpdate.map(ticket => this.changeTicketQueue(
                    ticket.uuid,
                    queueExists.id,
                    this.privacyFieldsForQueueMove(ticket, queueExists.slug),
                )));
            }

            if (status) {
                await Promise.all(ticketsToUpdate.map(ticket => this.changeTicketStatus({
                    uuid: ticket.uuid,
                    status,
                    callingUserName: `${callingUser.firstName} ${callingUser.lastName}`,
                })));
            }
        } catch (err) {
            throw err;
        }
    }

    async getTicketMessages(ticketId: string, type: "general" | "internal"): Promise<SupportTicketMessageInterface[]> {
        try {
            const messages = await SupportTicketMessage.find({
                ticket: ticketId,
                type,
            })
                .populate('sender')
                .sort({ createdAt: -1 });

            return messages || [];
        } catch (err) {
            throw err;
        }
    }

    async checkHarvesterAccessToTicket(ticketId: string, userId: string): Promise<boolean> {
        try {
            const user = await User.findOne({ uuid: { $eq: userId } }).orFail();
            if (!user) return false;

            const ticket = await SupportTicket.findOne({ uuid: ticketId }).populate('queue').orFail();
            if (!ticket) return false;

            const isHarvester = authAPI.checkHasRole(user, 'libretexts', 'harvester', true, true);

            if (isHarvester && ticket.queue?.slug !== 'harvesting') {
                return false;
            }

            return true;
        } catch (err) {
            throw err;
        }
    }

    async changeTicketPriority(uuid: string, priority: string, callingUser: string) {
        try {
            const feedEntry = this._createFeedEntryPriorityChanged(
                callingUser,
                priority,
            );

            await SupportTicket.updateOne(
                { uuid },
                {
                    $set: { priority },
                    $push: { feed: feedEntry },
                }
            ).orFail();
            await this.upsertToSearchIndex(uuid);
        } catch (err) {
            throw err;
        }
    }

    async changeTicketQueue(uuid: string, queueId: string, privacy?: PrivacyTicketFields) {
        try {
            await SupportTicket.updateOne(
                { uuid },
                {
                    $set: { queue_id: queueId, ...(privacy && { privacy }) },
                }
            ).orFail();
            await this.upsertToSearchIndex(uuid);
        } catch (err) {
            throw err;
        }
    }

    async changeTicketStatus<T extends SupportTicketStatusEnum>(params: ChangeTicketStatusParams<T>) {
        try {
            const { uuid, status, callingUserName } = params;

            const ticket = await SupportTicket.findOne({ uuid }).orFail();
            if (status === ticket.status) return; // re-close would resend the outcome and reset retention
            this.assertPrivacyStatusChange(ticket, status);

            let feedEntry: SupportTicketFeedEntryInterface | null = null;
            if (status === "closed" && callingUserName) {
                feedEntry = this._createFeedEntry_Closed(
                    callingUserName
                );
            } else if (ticket.status === "closed" && callingUserName) {
                feedEntry = {
                    action: `Ticket was reopened`,
                    blame: callingUserName,
                    date: new Date().toISOString(),
                };
            }

            await SupportTicket.updateOne(
                { uuid },
                {
                    $set: {
                        status,
                        ...(status === "closed" && { timeClosed: new Date().toISOString() }),
                    },
                    ...(feedEntry ? { $push: { feed: feedEntry } } : {}),
                }
            ).orFail();
            await this.upsertToSearchIndex(uuid);
            if (status === "closed" && ticket.privacy) await this.onPrivacyTicketClosed(uuid);
        } catch (err) {
            throw err;
        }
    }

    async searchTickets({
        queue_id,
        statuses,
        query,
        assignee,
        priority,
        category,
        sort,
        returnAccessKeys = false,
        limit,
        page
    }: SearchTicketsParams): Promise<{ tickets: SupportTicketInterface[]; total: number }> {
        try {
            const searchService = await SearchService.getInstance();

            const isExactUUIDQuery = z.uuid().safeParse(query).success;

            const results = await searchService.search("supportTickets", query || "", {
                ...(isExactUUIDQuery ? { uuid: [query as string] } : {}),
                ...(statuses ? { status: statuses } : {}),
                ...(queue_id ? { queue_id: [queue_id] } : {}),
                ...(assignee ? { "assignedUUIDs": assignee } : {}),
                ...(priority ? { priority: priority } : {}),
                ...(category ? { category: category } : {}),
            }, [{
                field: sort || "timeOpened",
                order: sort === "category" ? "asc" : "desc", // timeOpened sorts newest first
            }], {
                limit: limit || 25,
                offset: getPaginationOffset(page || 1, limit || 25),
            });

            const tickets = results.hits as SupportTicketInterface[];

            if (!returnAccessKeys) {
                tickets.forEach(t => {
                    return this._removeAccessKeysFromResponse(t);
                });
            }

            return { tickets, total: results.estimatedTotalHits ?? tickets.length };
        } catch (err) {
            throw err;
        }
    }

    async syncWithSearchIndex() {
        try {
            supportTicketLog.info(`Starting sync with search index...`);
            const searchService = await SearchService.getInstance();

            const batchSize = 100;
            let skip = 0;
            let hasMore = true;
            let totalSynced = 0;

            while (hasMore) {
                const batch = await SupportTicket.aggregate([
                    ...this.searchIndexAggregationStages,
                    { $skip: skip },
                    { $limit: batchSize },
                ]);

                if (batch.length === 0) {
                    hasMore = false;
                    break;
                }

                try {
                    const sanitizedBatch = JSON.parse(JSON.stringify(batch));
                    const task: any = await searchService.addDocuments("supportTickets", sanitizedBatch, { waitForCompletion: true });
                    supportTicketLog.info(`Batch ${Math.floor(skip / batchSize) + 1} indexed. Task UID: ${task.uid ?? task.taskUid}`);
                } catch (batchError: any) {
                    supportTicketLog.error(`Error adding batch starting at ${skip}: ${batchError.message}`);
                    if (batchError.meilisearchError) {
                        supportTicketLog.error(`Meilisearch error object: ${JSON.stringify(batchError.meilisearchError)}`);
                    }
                    const firstFive = batch.slice(0, 5).map((b: any) => b.uuid);
                    const lastFive = batch.slice(-5).map((b: any) => b.uuid);
                    supportTicketLog.error(`Batch uuids (first 5): ${firstFive.join(', ')}`);
                    supportTicketLog.error(`Batch uuids (last 5): ${lastFive.join(', ')}`);
                    throw batchError;
                }
                totalSynced += batch.length;
                supportTicketLog.info(`Synced batch of ${batch.length} tickets. Total synced so far: ${totalSynced}`);
                skip += batchSize;

                // If we received less than the batch size, we know we've reached the end
                if (batch.length < batchSize) {
                    hasMore = false;
                }
            }

            supportTicketLog.info(`Completed sync with search index. Total synced: ${totalSynced}`);
        } catch (err) {
            supportTicketLog.error({ err }, "Error syncing with search index");
            throw err;
        }
    }

    /**
     * This method can be called after any update to a ticket to ensure the search index has the most up-to-date information.
     * This way, we don't have to wait for the next full sync to have accurate search results after a ticket is updated.
     * Essentially does the same thing as syncWithSearchIndex but for a single ticket, and is optimized to only reindex that one ticket instead of all tickets.
     * Will swallow and log any errors instead of throwing, since this is meant to be a best-effort method to keep the search index up-to-date.
     * @param ticketID the ID of the ticket to upsert to the search index
     */
    async upsertToSearchIndex(ticketID: string): Promise<void> {
        try {
            const searchService = await SearchService.getInstance();

            const results = await SupportTicket.aggregate([
                { $match: { uuid: ticketID } },
                ...this.searchIndexAggregationStages,
            ]);

            if (!results || results.length === 0) {
                supportTicketLog.error(`No ticket found with ID ${ticketID} for upsert to search index.`);
                return;
            }

            const ticket = results[0] as SupportTicketInterface;
            if (!ticket) {
                supportTicketLog.error(`No ticket found with ID ${ticketID} for upsert to search index.`);
                return;
            }

            const sanitizedTicket = JSON.parse(JSON.stringify(ticket));
            await searchService.addDocuments("supportTickets", [sanitizedTicket], { waitForCompletion: true });
        } catch (err) {
            supportTicketLog.error({ err }, `Error upserting ticket ${ticketID} to search index`);
        }
    }

    /**
     * Batch version of upsertToSearchIndex — fetches and syncs multiple tickets in a single
     * aggregate query + single addDocuments call, instead of N separate round-trips.
     */
    async bulkUpsertToSearchIndex(ticketIDs: string[]): Promise<void> {
        try {
            if (ticketIDs.length === 0) return;

            const searchService = await SearchService.getInstance();

            const results = await SupportTicket.aggregate([
                { $match: { uuid: { $in: ticketIDs } } },
                ...this.searchIndexAggregationStages,
            ]);

            if (!results || results.length === 0) return;

            const sanitizedResults = JSON.parse(JSON.stringify(results));
            await searchService.addDocuments("supportTickets", sanitizedResults, { waitForCompletion: true });
        } catch (err) {
            supportTicketLog.error({ err }, "Error bulk upserting tickets to search index");
        }
    }

    async removeFromSearchIndex(uuid: string): Promise<void> {
        try {
            const searchService = await SearchService.getInstance();
            await searchService.deleteDocuments("supportTickets", [uuid]);
        } catch (err) {
            supportTicketLog.error({ err }, `Error removing ticket ${uuid} from search index`);
        }
    }

    /**
     * Posts an internal, Conductor-authored comment on an existing ticket.
     *
     * Attribution mirrors `createSystemTicket`: there is no sender user, so the automation identifies
     * itself through `senderEmail`, which is what the ticket UI falls back to for the display name.
     * Messages are `internal` because these are operational notes for staff, not correspondence with
     * a requester, and they deliberately skip the commenter/assignee email fan-out and the auto-close
     * reset that a human comment triggers — automation must not keep a ticket alive or page people.
     *
     * Best-effort: returns whether the comment was written and never throws, so callers can treat
     * commenting as a nicety that cannot break the path it is annotating.
     */
    async createSystemMessage({ ticketUUID, message }: { ticketUUID: string; message: string }): Promise<boolean> {
        try {
            await SupportTicketMessage.create({
                uuid: v4(),
                ticket: ticketUUID,
                message,
                attachments: [],
                senderEmail: "Conductor (automated)",
                senderIsStaff: true,
                timeSent: new Date().toISOString(),
                type: "internal",
            });
            return true;
        } catch (err) {
            supportTicketLog.error({ err }, `Failed to add system message to ticket ${ticketUUID}`);
            return false;
        }
    }

    async createTicket(data: Partial<SupportTicketInterface> | Partial<Omit<SupportTicketInterface, "attachments"> & { attachments?: string[] }>): Promise<SupportTicketInterface> {
        try {
            const ticket = await SupportTicket.create(data);
            await this.upsertToSearchIndex(ticket.uuid);
            return ticket;
        } catch (err) {
            throw err;
        }
    }

    /**
     * Creates a support ticket authored by Conductor itself (no human requester), for situations
     * where the system detects work that needs manual resolution (e.g. a failed/rejected store order).
     *
     * The ticket is routed to the "store" queue when present, otherwise the default queue. It follows
     * the same auto-assign + internal-notification flow as a user-submitted ticket, but is attributed
     * to "Conductor System" via the feed `blame` field rather than a user/guest. Notifications and
     * auto-assignment are best-effort: a failure there never prevents the ticket from being created.
     *
     * Returns the created ticket, or `null` if no destination queue could be resolved or creation
     * failed — callers must treat ticket creation as best-effort and never let it break core paths.
     */
    async createSystemTicket({
        title,
        description,
        category = "bookstore",
        priority = "high",
        metadata,
    }: {
        title: string;
        description: string;
        category?: string;
        priority?: "low" | "medium" | "high" | "severe";
        metadata?: Record<string, any>;
    }): Promise<SupportTicketInterface | null> {
        try {
            const queueService = new SupportQueueService();
            const queue = (await queueService.getQueueBySlug("store")) ?? (await queueService.getDefaultQueue());
            if (!queue) {
                supportTicketLog.error("Cannot create system ticket: no 'store' queue and no default queue configured.");
                return null;
            }

            const uuid = v4();
            const ticket = await this.createTicket({
                uuid,
                uuidShort: uuid.slice(-7),
                queue_id: queue.id,
                title,
                description,
                category,
                priority,
                timeOpened: new Date().toISOString(),
                guestAccessKey: randomBytes(32).toString("hex"),
                feed: [this._createFeedEntry_SystemCreated()],
                metadata,
            });

            // Auto-assign to the queue's configured staff, if enabled. Defensive: never break creation.
            if (queue.auto_assign_enabled && queue.auto_assign_uuids?.length) {
                try {
                    await this.autoAssignNewTicket(ticket, queue.auto_assign_uuids);
                } catch (err) {
                    logger.error({ err }, "createSystemTicket failed");
                }
            }

            // Notify the support team (fire-and-forget; nicety isolation: never break creation).
            this._notifySystemTicketCreated(ticket, queue).catch(() => { /* swallowed in helper */ });

            return ticket;
        } catch (err) {
            logger.error({ err }, "createSystemTicket failed");
            return null;
        }
    }

    /**
     * Sends the internal support-team email + Slack notification for a system-generated ticket.
     * All failures are swallowed: alerting must never break ticket creation.
     */
    private async _notifySystemTicketCreated(ticket: SupportTicketInterface, queue: SupportQueueInterface): Promise<void> {
        const authorString = "Conductor System";
        try {
            const org = await Organization.findOne({ orgID: process.env.ORG_ID });
            const teamToNotify = org?.supportTicketNotifiers ?? [];
            if (teamToNotify.length > 0) {
                await mailAPI.sendSupportTicketCreateInternalNotification(
                    queue.ticket_descriptor,
                    teamToNotify,
                    ticket.uuid,
                    ticket.title,
                    ticket.description || "",
                    authorString,
                    capitalizeFirstLetter(ticket.category || ""),
                    capitalizeFirstLetter(ticket.priority || ""),
                    ticket.capturedURL ?? undefined,
                    (ticket.metadata as object) ?? {},
                );
            }
        } catch (err) {
            logger.error({ err }, "_notifySystemTicketCreated failed");
        }

        try {
            await new SlackNotificationService().sendSupportTicketCreated({
                queueDescriptor: queue.ticket_descriptor,
                ticketID: ticket.uuid,
                ticketTitle: ticket.title,
                ticketDescription: ticket.description || "",
                authorString,
                category: capitalizeFirstLetter(ticket.category || ""),
                priority: capitalizeFirstLetter(ticket.priority || ""),
                capturedURL: ticket.capturedURL ?? undefined,
                metadata: (ticket.metadata as Record<string, unknown>) ?? {},
            });
        } catch (err) {
            logger.error({ err }, "_notifySystemTicketCreated failed");
        }
    }

    async saveTicket(ticket: SupportTicketInterface): Promise<SupportTicketInterface> {
        try {
            await ticket.save();
            await this.upsertToSearchIndex(ticket.uuid);
            return ticket;
        } catch (err) {
            throw err;
        }
    }

    async updateTicket(uuid: string, update: Record<string, any>): Promise<void> {
        try {
            await SupportTicket.updateOne({ uuid }, update).orFail();
            await this.upsertToSearchIndex(uuid);
        } catch (err) {
            throw err;
        }
    }

    async deleteTicket(uuid: string): Promise<void> {
        try {
            const ticket = await SupportTicket.findOne({ uuid }, { privacy: 1 });
            if (ticket?.privacy) {
                // Files first: if storage cleanup fails, the privacy record still exists to retry against
                await this.deleteTicketFiles(uuid);
            } else {
                // Ordinary tickets kept files before this cleanup existed; don't block their deletion on it
                await this.deleteTicketFiles(uuid).catch(err =>
                    supportTicketLog.warn({ err }, `File cleanup failed for deleted ticket ${uuid}`)
                );
            }
            await SupportTicketMessage.deleteMany({ ticket: uuid });
            await SupportTicket.deleteOne({ uuid });
            await this.removeFromSearchIndex(uuid);
        } catch (err) {
            throw err;
        }
    }

    private async deleteTicketFiles(ticketUUID: string): Promise<void> {
        const bucket = process.env.AWS_SUPPORTFILES_BUCKET;
        if (!bucket) {
            // Production must fail loudly: skipping would orphan files the ticket record points to
            if (process.env.NODE_ENV === "production") throw new Error("Missing file storage config");
            supportTicketLog.warn(`No support file bucket configured; skipped file cleanup for ticket ${ticketUUID}`);
            return;
        }

        const client = new S3Client({ region: process.env.AWS_SUPPORTFILES_REGION || process.env.AWS_REGION });
        let token: string | undefined;
        do {
            const listed = await client.send(new ListObjectsV2Command({
                Bucket: bucket,
                Prefix: `${ticketUUID}/`,
                ContinuationToken: token,
            }));
            const objects = (listed.Contents ?? []).flatMap(o => (o.Key ? [{ Key: o.Key }] : []));
            if (objects.length > 0) {
                // DeleteObjects reports per-key failures in the body, not as a thrown error
                const res = await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects } }));
                if (res.Errors?.length) {
                    throw new Error(`Failed to delete ${res.Errors.length} file(s) for ticket ${ticketUUID}`);
                }
            }
            token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
        } while (token);
    }

    /**
     * Builds the privacy subdoc for a new Privacy Inquiry ticket. Staff may back-log requests that
     * arrived another way (original date + channel); public submissions always use now + the form.
     * Appeals must come from the original requester (or staff) and target a closed denial.
     */
    async buildPrivacyFields({
        input,
        isInternal,
        requesterUUID,
    }: {
        input: NonNullable<z.infer<typeof CreateTicketValidator>["body"]["privacy"]>;
        isInternal: boolean;
        requesterUUID?: string;
    }): Promise<PrivacyTicketFields> {
        const { requestType, appealOf, appealAccessKey, actingForOther, products, schoolRecord } = input;
        const now = new Date();
        const dateReceived = isInternal && input.dateReceived ? input.dateReceived : now;

        if (requestType === "appeal") {
            if (!appealOf) throw new PrivacyTicketError("Appeals must reference the original request");
            const original = await SupportTicket.findOne({ uuid: { $eq: appealOf } });
            const isOwner =
                isInternal ||
                (!!appealAccessKey && appealAccessKey === original?.guestAccessKey) ||
                (!!requesterUUID && requesterUUID === original?.userUUID);
            if (!original || !isOwner) throw new PrivacyTicketError("Original request not found");
            if (original.status !== "closed" || !isPrivacyDenial(original.privacy?.responseOutcome)) {
                throw new PrivacyTicketError("Only denied or partly denied requests can be appealed");
            }
            if (original.privacy?.requestType === "appeal") {
                throw new PrivacyTicketError("Appeal decisions can't be appealed again");
            }
            const openAppeal = original.privacy?.appealUUIDs?.length
                ? await SupportTicket.exists({ uuid: { $in: original.privacy.appealUUIDs }, status: { $ne: "closed" } })
                : null;
            if (openAppeal) {
                throw new PrivacyTicketError("An appeal of this request is already open");
            }
        }

        return {
            dateReceived,
            requestType,
            intakeChannel: isInternal && input.intakeChannel ? input.intakeChannel : "support_form",
            actingForOther,
            products,
            schoolRecord,
            dueDate: getPrivacyDueDate(dateReceived, requestType),
            ...(requestType === "appeal" && { appealOf }),
            ...(requesterUUID && {
                identityVerification: { method: "signed_in_session", date: now },
            }),
        };
    }

    /**
     * Privacy tickets stay in the privacy queue (required fields, close rules, retention); misfiled
     * ones close as Withdrawn. Tickets moving in get default privacy fields to correct.
     */
    privacyFieldsForQueueMove(ticket: SupportTicketInterface, targetSlug: string): PrivacyTicketFields | undefined {
        const toPrivacy = targetSlug.toLowerCase() === PRIVACY_QUEUE_SLUG;
        if (ticket.privacy && !toPrivacy) {
            throw new PrivacyTicketError(
                `#${ticket.uuidShort} is a privacy inquiry and can't leave the privacy queue; close it as Withdrawn instead`
            );
        }
        if (!ticket.privacy && toPrivacy) {
            return getDefaultPrivacyFields(ticket.timeOpened, !!ticket.userUUID);
        }
        return undefined;
    }

    async linkPrivacyAppeal(originalUUID: string, appealUUID: string, actor: string): Promise<void> {
        const original = await SupportTicket.findOne({ uuid: originalUUID }, { "privacy.redactedAt": 1 });
        await SupportTicket.updateOne(
            { uuid: originalUUID },
            {
                $addToSet: { "privacy.appealUUIDs": appealUUID },
                $push: {
                    feed: {
                        action: `Decision appealed in ticket #${appealUUID.slice(-7)}`,
                        // Redacted tickets must not regain the requester's name
                        blame: original?.privacy?.redactedAt ? "Requester" : actor,
                        date: new Date().toISOString(),
                    },
                },
            },
        );
        await this.upsertToSearchIndex(originalUUID);
    }

    /**
     * Privacy status rules: closed inquiries stay closed (a reopen would resend the outcome, reset the
     * retention clock, and expose redacted shells; corrections go through an appeal or a new request),
     * and closing needs the required response fields. `privacy` overrides the ticket's own fields for
     * changes not yet saved (in-memory edits, a move into the privacy queue).
     */
    assertPrivacyStatusChange(
        ticket: SupportTicketInterface,
        status: SupportTicketStatusEnum,
        privacy: Partial<PrivacyTicketFields> | undefined = ticket.privacy,
    ): void {
        if (status === ticket.status) return;
        if (privacy && ticket.status === "closed") {
            throw new PrivacyTicketError(
                `#${ticket.uuidShort} is a closed privacy inquiry and can't be reopened; file an appeal or a new request instead`
            );
        }
        if (status !== "closed") return;
        const missing = getPrivacyCloseErrors(privacy);
        if (missing.length > 0) {
            throw new PrivacyTicketError(`#${ticket.uuidShort} required to close: ${missing.join(", ")}`);
        }
    }

    /**
     * Applies staff edits to a privacy ticket in memory only; the caller saves once the rest of the
     * request validates, then calls {@link notifyPrivacyExtension} if this returns true. An extension
     * moves the due date and resets reminders; it must be recorded before the current due date passes.
     */
    applyPrivacyFields(
        ticket: SupportTicketInterface,
        input: PrivacyUpdateFieldsType,
        actor: string,
    ): boolean {
        if (!ticket.privacy) throw new PrivacyTicketError("Not a privacy inquiry ticket");
        const changed = Object.keys(input).filter(k => input[k as keyof PrivacyUpdateFieldsType] !== undefined);
        if (changed.length === 0) return false;
        const { extension, denialBasis, ...fields } = input;
        const now = new Date();

        for (const [key, value] of Object.entries(fields)) {
            if (value !== undefined) ticket.set(`privacy.${key}`, value);
        }
        if (denialBasis !== undefined) ticket.set("privacy.denialBasis", denialBasis ?? undefined);

        if ((fields.dateReceived || fields.requestType) && !ticket.privacy.extension?.newDueDate) {
            ticket.set("privacy.dueDate", getPrivacyDueDate(ticket.privacy.dateReceived, ticket.privacy.requestType));
            ticket.set("privacy.remindersSent", []);
        }

        if (extension) {
            if (ticket.privacy.dueDate.getTime() < now.getTime()) {
                throw new PrivacyTicketError("Extensions must be recorded before the current due date");
            }
            if (extension.newDueDate.getTime() <= ticket.privacy.dueDate.getTime()) {
                throw new PrivacyTicketError("New due date must be after the current due date");
            }
            ticket.set("privacy.extension", extension);
            ticket.set("privacy.dueDate", extension.newDueDate);
            ticket.set("privacy.remindersSent", []);
        }

        ticket.feed.push({
            action: extension
                ? `Response deadline extended to ${extension.newDueDate.toISOString().slice(0, 10)}: ${extension.reason}`
                : `Privacy fields updated: ${changed.join(", ")}`,
            blame: actor,
            date: now.toISOString(),
        });
        return !!extension;
    }

    /** Emails the requester about a saved extension; notifiedAt is only stamped once the email goes out. */
    async notifyPrivacyExtension(ticket: SupportTicketInterface): Promise<void> {
        const extension = ticket.privacy?.extension;
        if (!extension) return;
        try {
            const email = await this._getTicketAuthorEmail(ticket);
            if (!email) return;
            await mailAPI.sendPrivacyExtensionNotification(
                email,
                ticket.uuid,
                extension.newDueDate,
                extension.reason,
                this._requesterLinkParams(ticket),
            );
            await SupportTicket.updateOne({ uuid: ticket.uuid }, { $set: { "privacy.extension.notifiedAt": new Date() } });
        } catch (err) {
            supportTicketLog.error({ err }, `Failed to send privacy extension notice for ticket ${ticket.uuid}`);
        }
    }

    /**
     * Runs after any close of a privacy ticket: sends the outcome (with an appeal link on denials)
     * and minimizes fulfilled deletion requests. Best-effort per step so close never rolls back.
     */
    async onPrivacyTicketClosed(uuid: string): Promise<void> {
        const ticket = await SupportTicket.findOne({ uuid });
        const privacy = ticket?.privacy;
        if (!ticket || !privacy?.responseOutcome) return;

        try {
            const email = await this._getTicketAuthorEmail(ticket);
            if (email) {
                const params = this._requesterLinkParams(ticket);
                const appealURL = isPrivacyDenial(privacy.responseOutcome) && privacy.requestType !== "appeal"
                    ? `https://commons.libretexts.org/support/contact?${new URLSearchParams({
                        queue: "privacy",
                        appealOf: ticket.uuid,
                        accessKey: ticket.guestAccessKey,
                    }).toString()}`
                    : undefined;
                await mailAPI.sendPrivacyResponseNotification(
                    email,
                    ticket.uuid,
                    PrivacyOutcomeLabels[privacy.responseOutcome],
                    privacy.responseSummary ?? "",
                    params,
                    appealURL,
                );
            }
        } catch (err) {
            supportTicketLog.error({ err }, `Failed to send privacy response for ticket ${uuid}`);
        }

        if (shouldRedactOnClose(privacy) && !privacy.redactedAt) {
            try {
                await this.redactPrivacyTicket(ticket);
            } catch (err) {
                supportTicketLog.error({ err }, `Failed to redact privacy ticket ${uuid}`);
            }
        }
    }

    /**
     * Keeps only what proves a fulfilled deletion request was handled: basic metadata, requester
     * email/UUID, and access key (so an appeal of a partial denial can still be opened).
     * PII on the ticket is stripped and saved first; messages and files go after, and redactedAt is
     * only stamped once everything is gone, so a failure leaves the ticket for the daily retry.
     */
    private async redactPrivacyTicket(ticket: SupportTicketInterface): Promise<void> {
        const author = await this._getTicketAuthor(ticket);
        // The creation entry carries a signed-in requester's name even after their account is deleted
        const creationBlame = ticket.userUUID
            ? ticket.feed.find(f => f.action === "Ticket was created")?.blame
            : undefined;
        const requesterNames = [
            author && `${author.firstName} ${author.lastName}`,
            ticket.guest && `${ticket.guest.firstName} ${ticket.guest.lastName}`,
            creationBlame,
        ].filter((n): n is string => !!n?.trim());

        ticket.title = "Deletion request";
        ticket.description = "";
        ticket.capturedURL = undefined;
        ticket.deviceInfo = undefined;
        ticket.attachments = [];
        ticket.ccedEmails = [];
        if (ticket.guest) {
            ticket.guest.firstName = "";
            ticket.guest.lastName = "";
            ticket.guest.organization = "";
        }
        ticket.set("privacy.actingForOther.note", undefined);
        // Mutate in place: spreading a Mongoose subdoc drops its getter-backed fields
        for (const f of ticket.feed) {
            if (requesterNames.includes(f.blame)) f.blame = "Requester";
            if (f.action.startsWith("Attachment uploaded") || f.action.startsWith("CC'd user")) {
                f.action = f.action.split(":")[0];
            }
        }
        await this.saveTicket(ticket);

        await SupportTicketMessage.deleteMany({ ticket: ticket.uuid });
        await this.deleteTicketFiles(ticket.uuid);

        ticket.set("privacy.redactedAt", new Date());
        ticket.feed.push({
            action: "Ticket content redacted after deletion request was fulfilled",
            blame: "Conductor System",
            date: new Date().toISOString(),
        });
        await this.saveTicket(ticket);
    }

    /** Retries redactions that failed partway; runs with the daily retention job. */
    private async retryPendingRedactions(): Promise<void> {
        const pending = await SupportTicket.find({
            "privacy.requestType": "deletion",
            "privacy.responseOutcome": { $in: ["fulfilled", "partly_fulfilled"] },
            "privacy.redactedAt": { $exists: false },
            status: "closed",
        });
        for (const ticket of pending) {
            try {
                await this.redactPrivacyTicket(ticket);
            } catch (err) {
                supportTicketLog.error({ err }, `Retry of privacy redaction failed for ticket ${ticket.uuid}`);
            }
        }
    }

    async sendPrivacyDeadlineReminders(now = new Date()): Promise<number> {
        const tickets = await SupportTicket.find({
            "privacy.dueDate": { $exists: true },
            status: { $ne: "closed" },
        });

        const due = tickets.filter(t =>
            getPrivacyReminderState(t.privacy!.dueDate, t.privacy!.remindersSent, now).shouldSend
        );
        if (due.length === 0) return 0;
        const supportTeam = (await Organization.findOne({ orgID: process.env.ORG_ID }))?.supportTicketNotifiers ?? [];

        let sent = 0;
        for (const ticket of due) {
            const privacy = ticket.privacy!;
            const { reached } = getPrivacyReminderState(privacy.dueDate, privacy.remindersSent, now);

            try {
                const assignees = ticket.assignedUUIDs?.length
                    ? await User.find({ uuid: { $in: ticket.assignedUUIDs } })
                    : [];
                const emails = assignees.length ? assignees.map(a => a.email) : supportTeam;
                if (emails.length === 0) continue;

                await mailAPI.sendPrivacyDeadlineReminder(emails, ticket.uuid, ticket.title, privacy.dueDate);
                await SupportTicket.updateOne({ uuid: ticket.uuid }, { $set: { "privacy.remindersSent": reached } });
                sent++;
            } catch (err) {
                supportTicketLog.error({ err }, `Failed to send privacy reminder for ticket ${ticket.uuid}`);
            }
        }
        return sent;
    }

    async purgeExpiredPrivacyTickets(now = new Date()): Promise<number> {
        await this.retryPendingRedactions();

        const cutoff = subMonths(now, PRIVACY_RETENTION_MONTHS).toISOString();
        const tickets = await SupportTicket.find(
            { "privacy.requestType": { $exists: true }, status: "closed", timeClosed: { $lt: cutoff } },
            { uuid: 1 },
        );

        let purged = 0;
        for (const { uuid } of tickets) {
            try {
                await this.deleteTicket(uuid);
                purged++;
            } catch (err) {
                supportTicketLog.error({ err }, `Failed to purge privacy ticket ${uuid}`);
            }
        }
        supportTicketLog.info(`Purged ${purged} of ${tickets.length} expired privacy tickets`);
        return purged;
    }

    private _requesterLinkParams(ticket: SupportTicketInterface): string {
        return ticket.userUUID ? "" : new URLSearchParams({ accessKey: ticket.guestAccessKey }).toString();
    }

    async resetAutoClose(uuid: string): Promise<SupportTicketInterface> {
        try {
            const ticket = await SupportTicket.findOneAndUpdate(
                { uuid },
                {
                    autoCloseTriggered: false,
                    autoCloseDate: null,
                },
            ).populate("queue").orFail();
            await this.upsertToSearchIndex(uuid);
            return ticket;
        } catch (err) {
            throw err;
        }
    }

    async initAutoClose(uuids: string[], autoCloseDate: string): Promise<void> {
        try {
            await SupportTicket.updateMany(
                { uuid: { $in: uuids } },
                {
                    autoCloseTriggered: true,
                    autoCloseDate,
                },
            );
            await this.bulkUpsertToSearchIndex(uuids);
        } catch (err) {
            throw err;
        }
    }

    async autoCloseTicket(ticket: SupportTicketInterface, feedEntry: SupportTicketFeedEntryInterface): Promise<void> {
        try {
            await SupportTicket.updateOne(
                { uuid: ticket.uuid },
                {
                    status: "closed",
                    autoCloseTriggered: false,
                    autoCloseDate: null,
                    timeClosed: new Date().toISOString(),
                    feed: [...ticket.feed, feedEntry],
                },
            );
            await this.upsertToSearchIndex(ticket.uuid);
        } catch (err) {
            throw err;
        }
    }

    _removeAccessKeysFromResponse(
        ticket: SupportTicketInterface,
        allowGuestAccessKey = false,
    ): SupportTicketInterface {
        if (!allowGuestAccessKey) ticket.guestAccessKey = "REDACTED";
        if (ticket.ccedEmails && Array.isArray(ticket.ccedEmails)) {
            ticket.ccedEmails.forEach((c) => {
                c.accessKey = "REDACTED";
            });
        }
        return ticket;
    };

    _redactStatusFromResponse(
        ticket: SupportTicketInterface,
    ): SupportTicketInterface {
        ticket.status = "unknown";
        return ticket;
    };


    private _createFeedEntry_Assigned(
        assigner: string,
        assignees: string[],
    ): SupportTicketFeedEntryInterface {
        return {
            action: `Ticket was assigned to ${assignees.join(", ")}`,
            blame: assigner,
            date: new Date().toISOString(),
        };
    };

    private _createFeedEntry_AutoAssigned(
        assignees: string[],
    ): SupportTicketFeedEntryInterface {
        return {
            action: `Ticket was automatically assigned to ${assignees.join(", ")}`,
            blame: "LibreTexts Support (Auto-Assignment)",
            date: new Date().toISOString(),
        };
    };

    private _createFeedEntry_SystemCreated(): SupportTicketFeedEntryInterface {
        return {
            action: `Ticket was created`,
            blame: "Conductor System",
            date: new Date().toISOString(),
        };
    };

    private async sendAssignmentEmails(
        ticket: SupportTicketInterface,
        newAssigneeEmails: string[],
        assignerName: string,
    ) {
        // Send notification emails to new assignees
        const ticketAuthor = await this._getTicketAuthor(ticket);
        const ticketAuthorEmail = await this._getTicketAuthorEmail(ticket, ticketAuthor);
        const ticketAuthorString = this._getTicketAuthorString(
            ticketAuthorEmail,
            ticketAuthor,
            ticket.guest,
        );

        await mailAPI.sendSupportTicketAssignedNotification(
            ticket.queue?.ticket_descriptor || "Unknown Request Type",
            newAssigneeEmails,
            ticket.uuid,
            ticket.title,
            assignerName,
            ticketAuthorString,
            capitalizeFirstLetter(ticket.category || ""),
            capitalizeFirstLetter(ticket.priority || ""),
            ticket.description || "",
        );
    }

    // TODO: eventually these methods should be made private once we refactor existing code to use SupportTicketService
    _createFeedEntryPriorityChanged(
        changer: string,
        newPriority: string,
    ): SupportTicketFeedEntryInterface {
        return {
            action: `Priority changed to ${newPriority}`,
            blame: changer,
            date: new Date().toISOString(),
        };
    };

    _createFeedEntry_CategoryChanged(
        changer: string,
        newCategory: string,
    ): SupportTicketFeedEntryInterface {
        return {
            action: `Category changed to ${newCategory}`,
            blame: changer,
            date: new Date().toISOString(),
        };
    };

    _createFeedEntry_QueueChanged(
        changer: string,
        newQueue: string,
    ): SupportTicketFeedEntryInterface {
        return {
            action: `Queue changed to ${newQueue}`,
            blame: changer,
            date: new Date().toISOString(),
        };
    };

    _createFeedEntry_Closed(
        closer: string,
    ): SupportTicketFeedEntryInterface {
        return {
            action: `Ticket was closed`,
            blame: closer,
            date: new Date().toISOString(),
        };
    }

    async _getTicketAuthor(ticket: SupportTicketInterface): Promise<UserInterface | undefined> {
        const hasUser = !!ticket.userUUID;
        if (hasUser) {
            return await User.findOne({ uuid: ticket.userUUID }) || undefined;
        }
        return undefined;
    }

    async _getTicketAuthorEmail(ticket: SupportTicketInterface, user?: UserInterface): Promise<string | undefined> {
        const hasUser = !!ticket.userUUID;
        if (hasUser) {
            if (user) return user.email;
            const foundUser = await this._getTicketAuthor(ticket);
            return foundUser?.email;
        }
        if (ticket.guest) {
            return ticket.guest.email;
        }
        return undefined;
    }

    _getTicketAuthorString(
        requesterEmail?: string,
        foundUser?: UserInterface,
        guest?: { firstName: string; lastName: string },
    ): string {
        const ticketAuthor = foundUser
            ? `${foundUser.firstName} ${foundUser.lastName}`
            : guest
                ? `${guest.firstName} ${guest.lastName}`
                : "Unknown";
        const authorString = `${ticketAuthor} (${requesterEmail || "Unknown Email"})`;
        return authorString;
    };

    private get searchIndexAggregationStages() {
        return [
            ...this.lookupUserDataStages("assignedUUIDs"),
            ...this.lookupUserDataStages("userUUID"),
            {
                $project: {
                    _id: 0,
                    uuid: 1,
                    uuidShort: 1,
                    queue_id: 1,
                    title: 1,
                    description: 1,
                    status: 1,
                    priority: 1,
                    category: 1,
                    assignedUUIDs: 1,
                    userUUID: 1,
                    timeOpened: 1,
                    timeClosed: 1,
                    capturedURL: 1,
                    apps: 1,
                    guest: 1,
                    deviceInfo: 1,
                    autoCloseTriggered: 1,
                    autoCloseSilenced: 1,
                    assignedUsers: 1,
                    user: 1,
                    "privacy.dueDate": 1,
                    "privacy.requestType": 1,
                },
            },
        ];
    }

    private lookupUserDataStages = (localField: "assignedUUIDs" | "userUUID") => {
        return [
            {
                $lookup: {
                    from: "users",
                    localField: localField,
                    foreignField: "uuid",
                    as: localField === "assignedUUIDs" ? "assignedUsers" : "user",
                    pipeline: [
                        {
                            $project: {
                                ...SanitizedUserSelectProjection,
                            },
                        },
                    ],
                },
            },
            ...(localField === "userUUID"
                ? [
                    {
                        $set: {
                            user: {
                                $arrayElemAt: ["$user", 0],
                            },
                        },
                    },
                ]
                : []),
        ];
    };
}
