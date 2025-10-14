import { differenceInMinutes, subDays } from "date-fns";
import SupportTicket, { SupportTicketInterface } from "../../models/supporticket";
import SupportQueue from "../../models/supportqueue";
import { TypedReqUser } from "../../types";

export default class SupportQueueService {
    async getQueues({ withCount = false } = {}) {
        const results = await SupportQueue.aggregate([
            { $match: { active: true } },
            { $sort: { order: 1 } },
            ...(withCount ? [
                {
                    $lookup: {
                        from: "supporttickets",
                        localField: "id",
                        foreignField: "queue_id",
                        as: "tickets"
                    }
                },
                {
                    $addFields: {
                        ticket_count: { $size: "$tickets" }
                    }
                },
                {
                    $project: { tickets: 0 } // Exclude the tickets array
                }
            ] : [])
        ])

        return results;
    }

    async getQueueBySlug(slug: string, { withCount = false } = {}): Promise<SupportTicketInterface | null> {
        const results = await SupportQueue.aggregate([
            { $match: { slug: slug.toLowerCase(), active: true } },
            ...(withCount ? [
                {
                    $lookup: {
                        from: "supporttickets",
                        localField: "id",
                        foreignField: "queue_id",
                        as: "tickets"
                    }
                },
                {
                    $addFields: {
                        ticket_count: { $size: "$tickets" }
                    }
                },
                {
                    $project: { tickets: 0 } // Exclude the tickets array
                }
            ] : []),
            { $limit: 1 }
        ]);

        return results[0] || null;
    }

    async getQueueById(id: string) {
        return await SupportQueue.findOne({ id, active: true }).lean();
    }

    async getDefaultQueue() {
        return await SupportQueue.findOne({ is_default: true, active: true }).lean();
    }

    async getMetrics(slug: string) {
        const queue = await this.getQueueBySlug(slug);
        if (!queue) return null;

        const totalOpenTickets = await SupportTicket.countDocuments({
            queue_id: queue.id,
            status: { $in: ["open", "in_progress"] },
        });

        // Get average time between ticket open date and ticket close date
        const closedTickets = await SupportTicket.find({ queue_id: queue.id, status: "closed" });
        const totalClosedTickets = closedTickets.length;
        let totalClosedTicketMins = 0;
        closedTickets
            .filter((t) => t.timeOpened && t.timeClosed)
            .forEach((ticket) => {
                const timeOpened = new Date(ticket.timeOpened);
                const timeClosed = new Date(ticket.timeClosed as string);

                totalClosedTicketMins += differenceInMinutes(timeClosed, timeOpened);
            });
        const avgMinsToClose = Math.ceil(
            totalClosedTicketMins / totalClosedTickets,
        );

        const sevenDaysAgo = subDays(new Date(), 7);

        const lastSevenTicketCount = await SupportTicket.countDocuments({
            queue_id: queue.id,
            timeOpened: { $gte: sevenDaysAgo.toISOString() },
        });

        return {
            total_open_tickets: totalOpenTickets,
            avg_mins_to_close: isNaN(avgMinsToClose) ? 0 : avgMinsToClose,
            tickets_opened_last_7_days: lastSevenTicketCount,
        }
    }

    canReadTicketCount(userRoles: TypedReqUser["roles"]) {
        return userRoles?.some((item) => item.org === "libretexts" && item.role === "support");
    }
}