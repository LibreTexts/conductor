import axios, { AxiosInstance } from "axios";
import { debugError } from "../../debug.js";

export interface SlackSupportTicketCreatedPayload {
    queueDescriptor: string;
    ticketID: string;
    ticketTitle: string;
    ticketDescription?: string;
    authorString: string;
    category?: string;
    priority?: string;
    capturedURL?: string;
    metadata?: Record<string, unknown>;
}

export default class SlackNotificationService {
    private instance: AxiosInstance;

    constructor() {
        this.instance = axios.create({
            headers: { "Content-Type": "application/json" },
            timeout: 4000,
        });
    }

    public isConfigured(): boolean {
        if (process.env.ORG_ID !== "libretexts") return false;
        if (!process.env.SLACK_SUPPORT_WEBHOOK_URL) return false;
        return true;
    }

    public async sendSupportTicketCreated(payload: SlackSupportTicketCreatedPayload): Promise<void> {
        if (!this.isConfigured()) return;

        try {
            const conductorDomain = process.env.CONDUCTOR_DOMAIN ?? "commons.libretexts.org";
            const ticketURL = `https://${conductorDomain}/support/ticket/${payload.ticketID}`;
            const shortID = payload.ticketID.slice(-7);

            const fields: { type: "mrkdwn"; text: string }[] = [
                { type: "mrkdwn", text: `*Requester:*\n${payload.authorString}` },
                { type: "mrkdwn", text: `*Priority:*\n${payload.priority || "—"}` },
            ];
            if (payload.category) {
                fields.push({ type: "mrkdwn", text: `*Category:*\n${payload.category}` });
            }
            if (payload.capturedURL) {
                fields.push({ type: "mrkdwn", text: `*Related URL:*\n<${payload.capturedURL}|link>` });
            }

            const blocks: unknown[] = [
                {
                    type: "header",
                    text: { type: "plain_text", text: `New ${payload.queueDescriptor} (#${shortID})` },
                },
                {
                    type: "section",
                    text: { type: "mrkdwn", text: `*${this.escape(payload.ticketTitle)}*` },
                },
                { type: "section", fields },
            ];

            if (payload.ticketDescription) {
                blocks.push({
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Description:*\n${this.truncate(this.escape(payload.ticketDescription), 2800)}`,
                    },
                });
            }

            if (payload.metadata && Object.keys(payload.metadata).length > 0) {
                const metaLines = Object.entries(payload.metadata)
                    .map(([k, v]) => `• *${this.escape(k)}:* ${this.escape(String(v))}`)
                    .join("\n");
                blocks.push({
                    type: "section",
                    text: { type: "mrkdwn", text: `*Additional Metadata:*\n${this.truncate(metaLines, 2800)}` },
                });
            }

            blocks.push({
                type: "actions",
                elements: [
                    {
                        type: "button",
                        text: { type: "plain_text", text: "View Ticket" },
                        url: ticketURL,
                    },
                ],
            });

            await this.instance.post(process.env.SLACK_SUPPORT_WEBHOOK_URL as string, {
                text: `New ${payload.queueDescriptor} (#${shortID}): ${payload.ticketTitle}`,
                blocks,
            });
        } catch (err) {
            debugError(err);
        }
    }

    private escape(value: string): string {
        return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    private truncate(value: string, max: number): string {
        return value.length > max ? `${value.slice(0, max - 1)}…` : value;
    }
}
