import { z } from "zod";
import SupportTicket, { SupportTicketFeedEntryInterface, SupportTicketInterface, SupportTicketStatusEnum } from "../../models/supporticket";
import User, { SanitizedUserSelectProjection, UserInterface } from "../../models/user";
import { AssignSupportTicketParams, ChangeTicketStatusParams, SearchTicketsParams } from "../../types/SupportTicket";
import { capitalizeFirstLetter, getPaginationOffset } from "../../util/helpers";
import mailAPI from "../mail";
import authAPI from "../auth";
import { BulkUpdateTicketsValidator } from "../validators/support";
import SupportQueueService from "./support-queue-service";
import SupportTicketMessage, { SupportTicketMessageInterface } from "../../models/supporticketmessage";
import { debugError, debugServer } from "../../debug";
import SearchService from "./search-service";

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

    async bulkUpdateTickets({ tickets, assignee, priority, queue, status, callingUserId }: z.infer<typeof BulkUpdateTicketsValidator>['body'] & { callingUserId: string; }) {
        try {
            const queueService = new SupportQueueService();
            const ticketsToUpdate = await SupportTicket.find({ uuid: { $in: tickets } }).orFail();
            const callingUser = await User.findOne({ uuid: callingUserId }).orFail();

            const promiseArray = [];

            if (assignee && assignee.length > 0) {
                const assigneeUpdatePromises = ticketsToUpdate.map(ticket => this.assignTicket({
                    uuid: ticket.uuid,
                    assigned: assignee,
                    assigner: callingUserId,
                }));
                promiseArray.push(...assigneeUpdatePromises);
            }

            if (priority) {
                const priorityUpdatePromises = ticketsToUpdate.map(ticket => this.changeTicketPriority(
                    ticket.uuid,
                    priority,
                    `${callingUser.firstName} ${callingUser.lastName}`,
                ));
                promiseArray.push(...priorityUpdatePromises);
            }

            if (queue) {
                const queueExists = await queueService.getQueueBySlug(queue);
                if (!queueExists) {
                    throw new Error(`Queue with slug ${queue} does not exist.`);
                }

                const queueUpdatePromises = ticketsToUpdate.map(ticket => this.changeTicketQueue(
                    ticket.uuid,
                    queueExists.id,
                ));
                promiseArray.push(...queueUpdatePromises);
            }

            if (status) {
                // @ts-ignore
                const statusUpdatePromises = ticketsToUpdate.map(ticket => this.changeTicketStatus({
                    uuid: ticket.uuid,
                    status,
                    ...(status === "closed" && { callingUserName: `${callingUser.firstName} ${callingUser.lastName}` }),
                }));
                promiseArray.push(...statusUpdatePromises);
            }

            await Promise.all(promiseArray);
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
            const user = await User.findOne({ uuid: userId }).orFail();
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

    async changeTicketQueue(uuid: string, queueId: string) {
        try {
            await SupportTicket.updateOne(
                { uuid },
                {
                    $set: { queue_id: queueId },
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

            let feedEntry: SupportTicketFeedEntryInterface | null = null;
            if (status === "closed" && callingUserName) {
                feedEntry = this._createFeedEntry_Closed(
                    callingUserName
                );
            }

            await SupportTicket.updateOne(
                { uuid },
                {
                    $set: { status },
                    ...(feedEntry ? { $push: { feed: feedEntry } } : {}),
                }
            ).orFail();
            await this.upsertToSearchIndex(uuid);
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
            debugServer(`[SupportTicketService] Starting sync with search index...`);
            const searchService = await SearchService.getInstance();

            const batchSize = 100;
            let skip = 0;
            let hasMore = true;
            let totalSynced = 0;

            const aggregationPipeline = [
                ...this.lookupUserDataStages("assignedUUIDs"),
                ...this.lookupUserDataStages("userUUID"),
                // Exclude MongoDB internal fields that don't serialize well for Meilisearch
                { $project: { _id: 0, __v: 0 } },
            ];

            while (hasMore) {
                const batch = await SupportTicket.aggregate([
                    ...aggregationPipeline,
                    { $skip: skip },
                    { $limit: batchSize },
                ]);

                if (batch.length === 0) {
                    hasMore = false;
                    break;
                }

                try {
                    const task = await searchService.addDocuments("supportTickets", batch);
                    debugServer(`[SupportTicketService] Batch ${Math.floor(skip / batchSize) + 1} enqueued. Task UID: ${task.taskUid}`);
                } catch (batchError: any) {
                    debugError(`[SupportTicketService] Error adding batch starting at ${skip}: ${batchError.message}`);
                    debugError(`[SupportTicketService] Sample ticket from failed batch: ${JSON.stringify(batch[0]?.uuid || 'unknown')}`);
                    throw batchError;
                }
                totalSynced += batch.length;
                debugServer(`[SupportTicketService] Synced batch of ${batch.length} tickets. Total synced so far: ${totalSynced}`);
                skip += batchSize;

                // If we received less than the batch size, we know we've reached the end
                if (batch.length < batchSize) {
                    hasMore = false;
                }
            }

            debugServer(`[SupportTicketService] Completed sync with search index. Total synced: ${totalSynced}`);
        } catch (err) {
            debugError(`[SupportTicketService] Error syncing with search index: ${err}`);
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
                ...this.lookupUserDataStages("assignedUUIDs"),
                ...this.lookupUserDataStages("userUUID"),
                { $project: { _id: 0, __v: 0 } },
            ]);

            if (!results || results.length === 0) {
                debugError(`[SupportTicketService] No ticket found with ID ${ticketID} for upsert to search index.`);
                return;
            }

            const ticket = results[0] as SupportTicketInterface;
            if (!ticket) {
                debugError(`[SupportTicketService] No ticket found with ID ${ticketID} for upsert to search index.`);
                return;
            }

            await searchService.addDocuments("supportTickets", [ticket]);
        } catch (err) {
            debugError(`[SupportTicketService] Error upserting ticket ${ticketID} to search index: ${err}`);
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
                ...this.lookupUserDataStages("assignedUUIDs"),
                ...this.lookupUserDataStages("userUUID"),
                { $project: { _id: 0, __v: 0 } },
            ]);

            if (!results || results.length === 0) return;

            await searchService.addDocuments("supportTickets", results);
        } catch (err) {
            debugError(`[SupportTicketService] Error bulk upserting tickets to search index: ${err}`);
        }
    }

    async removeFromSearchIndex(uuid: string): Promise<void> {
        try {
            const searchService = await SearchService.getInstance();
            await searchService.deleteDocuments("supportTickets", [uuid]);
        } catch (err) {
            debugError(`[SupportTicketService] Error removing ticket ${uuid} from search index: ${err}`);
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
            await SupportTicket.deleteOne({ uuid });
            await this.removeFromSearchIndex(uuid);
        } catch (err) {
            throw err;
        }
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
