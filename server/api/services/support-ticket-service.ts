import { z } from "zod";
import SupportTicket, { SupportTicketFeedEntryInterface, SupportTicketInterface, SupportTicketStatusEnum } from "../../models/supporticket";
import User, { SanitizedUserSelectProjection, UserInterface } from "../../models/user";
import { AssignSupportTicketParams, ChangeTicketStatusParams, SearchTicketsParams } from "../../types/SupportTicket";
import { capitalizeFirstLetter } from "../../util/helpers";
import mailAPI from "../mail";
import authAPI from "../auth";
import { BulkUpdateTicketsValidator } from "../validators/support";
import SupportQueueService from "./support-queue-service";
import SupportTicketMessage, { SupportTicketMessageInterface } from "../../models/supporticketmessage";

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
    }: SearchTicketsParams): Promise<SupportTicketInterface[]> {
        try {
            // Normalize possibly user-controlled parameters: convert string to array, allow only strings/arrays
            function normalizeToStringArray(val: unknown): string[] | undefined {
                if (typeof val === "string") {
                    return [val];
                } else if (Array.isArray(val) && val.every(v => typeof v === "string")) {
                    return val;
                }
                return undefined;
            }

            const normAssignee = normalizeToStringArray(assignee);
            const normPriority = normalizeToStringArray(priority);
            const normCategory = normalizeToStringArray(category);

            const tickets: SupportTicketInterface[] = [];
            const getSortObj = () => {
                if (sort === "status") {
                    return { status: -1 };
                }
                if (sort === "category") {
                    return { category: 1 };
                }
                return { timeOpened: -1 };
            };

            const sortObj = getSortObj();

            const lookupUserDataStages = (localField: "assignedUUIDs" | "userUUID") => {
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

            if (!query) {
                const foundTickets = await SupportTicket.aggregate([
                    {
                        $match: {
                            status: { $in: statuses },
                            ...(queue_id ? { queue_id: { $eq: queue_id } } : {}),
                        },
                    },
                    ...lookupUserDataStages("assignedUUIDs"),
                    ...lookupUserDataStages("userUUID"),
                    { $sort: sortObj } as any,
                ]);
                tickets.push(...foundTickets);
            } else if (z.string().uuid().safeParse(query).success) {
                const foundTicket = await SupportTicket.aggregate([
                    {
                        $match: {
                            uuid: query,
                            status: { $in: statuses },
                            ...(queue_id ? { queue_id: { $eq: queue_id } } : {}),
                        },
                    },
                    ...lookupUserDataStages("assignedUUIDs"),
                    ...lookupUserDataStages("userUUID"),
                ]);

                tickets.push(...foundTicket);
            } else {
                const fromTicketQuery = await SupportTicket.aggregate([
                    {
                        $search: {
                            compound: {
                                should: [
                                    {
                                        text: {
                                            query,
                                            path: [
                                                "title",
                                                "description",
                                                "guest.email",
                                                "guest.firstName",
                                                "guest.lastName",
                                            ],
                                            fuzzy: {
                                                maxEdits: 2,
                                            },
                                        }
                                    }, {
                                        autocomplete: {
                                            query,
                                            path: "uuid"
                                        }
                                    },
                                    {
                                        text: {
                                            query,
                                            path: "uuidShort"
                                        }
                                    }
                                ],
                                minimumShouldMatch: 1,
                            }
                        },
                    },
                    {
                        $addFields: {
                            score: { $meta: "searchScore" },
                        },
                    },
                    {
                        $match: {
                            status: { $in: statuses },
                            ...(queue_id ? { queue_id: { $eq: queue_id } } : {}),
                        }
                    },
                    ...lookupUserDataStages("assignedUUIDs"),
                    ...lookupUserDataStages("userUUID"),
                    { $sort: sortObj } as any,
                ]);

                const fromUserQuery = User.aggregate([
                    {
                        $search: {
                            text: {
                                query,
                                path: ["firstName", "lastName", "email"],
                                fuzzy: {
                                    maxEdits: 1,
                                },
                            },
                        },
                    },
                    {
                        $addFields: {
                            score: { $meta: "searchScore" },
                        },
                    },
                    {
                        $lookup: {
                            from: "supporttickets",
                            localField: "uuid",
                            foreignField: "userUUID",
                            as: "tickets",
                        },
                    },
                    {
                        $unwind: "$tickets",
                    },
                    {
                        $replaceRoot: { newRoot: "$tickets" },
                    },
                    {
                        $match: {
                            status: { $in: statuses },
                            ...(queue_id ? { queue_id: { $eq: queue_id } } : {}),

                        }
                    },
                    ...lookupUserDataStages("assignedUUIDs"),
                    ...lookupUserDataStages("userUUID"),
                ]);

                const queryResults = await Promise.all([
                    fromTicketQuery,
                    fromUserQuery,
                ]);

                const allResults = [...queryResults[0], ...queryResults[1]];
                tickets.push(...allResults);
            }

            // We could do this in the individual queries, but requires duplicating code and complicating queries
            // so we do it here in memory. Less performant, but more maintainable.
            const filteredAllResults = tickets.filter((t) => {
                if (normAssignee && normAssignee.length > 0 && !t.assignedUUIDs?.some((a: string) => normAssignee.includes(a))) return false;
                if (normCategory && normCategory.length > 0 && (!t.category || !normCategory.includes(t.category))) return false;
                if (normPriority && normPriority.length > 0 && (!t.priority || !normPriority.includes(t.priority))) return false;
                return true;
            });

            const uniqueTickets = filteredAllResults.filter((t, index, self) => {
                // Return only unique results
                return (
                    index ===
                    self.findIndex((t2) => {
                        return t.uuid === t2.uuid;
                    })
                );
            });

            // We have to sort the tickets in memory because we can only alphabetically sort by priority in query
            if (sort === "priority") {
                uniqueTickets.sort((a, b) => {
                    if (a.priority === "high" && b.priority !== "high") return -1;
                    if (a.priority !== "high" && b.priority === "high") return 1;
                    if (a.priority === "medium" && b.priority === "low") return -1;
                    if (a.priority === "low" && b.priority === "medium") return 1;
                    return 0;
                });
            }

            if (!returnAccessKeys) {
                uniqueTickets.forEach(t => {
                    return this._removeAccessKeysFromResponse(t);
                });
            }

            return uniqueTickets;
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
}
