import { z } from "zod";
import SupportTicket, { SupportTicketFeedEntryInterface, SupportTicketInterface } from "../../models/supporticket";
import User, { UserInterface } from "../../models/user";
import { AssignSupportTicketParams } from "../../types/SupportTicket";
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
            ticket.status = messages.length > 0 ? "in_progress" : "assigned";
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
                const statusUpdatePromises = ticketsToUpdate.map(ticket => this.changeTicketStatus(
                    ticket.uuid,
                    status,
                ));
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

    async changeTicketStatus(
        uuid: string,
        status: string,
    ) {
        try {
            await SupportTicket.updateOne(
                { uuid },
                {
                    $set: { status },
                }
            ).orFail();
        } catch (err) {
            throw err;
        }
    }

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
