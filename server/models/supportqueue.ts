import { model, Schema } from "mongoose";

export interface SupportQueueInterface {
    id: string;
    name: string;
    description: string;
    ticket_descriptor: string; // e.g. "Support Ticket", "Publishing Request"
    slug: string;
    active: boolean;
    color: string;
    icon: string;
    order: number;
    is_default: boolean
    form_fields: Array<{
        id: string;
        field_type: string;
        label: string;
        required: boolean;
        order: number;
        placeholder?: string;
        options?: string[];
    }>;
    ticket_count?: number;
}

const SupportQueueSchema = new Schema<SupportQueueInterface>({
    id: {
        type: String,
        required: true,
        unique: true,
    },
    name: {
        type: String,
        required: true,
        unique: true,
    },
    ticket_descriptor: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
        default: "",
    },
    slug: {
        type: String,
        required: true,
        unique: true,
    },
    active: {
        type: Boolean,
        required: true,
        default: true,
    },
    color: {
        type: String,
        required: true,
        default: "blue",
    },
    icon: {
        type: String,
    },
    order: {
        type: Number,
        required: true,
    },
    is_default: {
        type: Boolean,
        required: true,
        default: false,
    },
    form_fields: {
        type: [
            {
                id: {
                    type: String,
                    required: true,
                },
                field_type: {
                    type: String,
                    required: true,
                    enum: ["text", "textarea", "select", "checkbox", "radio", "email", "number"],
                },
                label: {
                    type: String,
                    required: true,
                    default: "",
                },
                required: {
                    type: Boolean,
                    required: true,
                    default: false,
                },
                order: {
                    type: Number,
                    required: true,
                    default: 0,
                },
                placeholder: {
                    type: String,
                    required: false,
                    default: undefined,
                },
                options: {
                    type: [String],
                    required: false,
                    default: undefined,
                },
            },
        ],
        required: true,
        default: [],
    },
});

SupportQueueSchema.virtual("ticket_count", {
    ref: "SupportTicket",
    localField: "id",
    foreignField: "queue",
    count: true,
})

SupportQueueSchema.virtual("tickets", {
    ref: "SupportTicket",
    localField: "id",
    foreignField: "queue",
})

const SupportQueue = model<SupportQueueInterface>("SupportQueue", SupportQueueSchema);
export default SupportQueue;