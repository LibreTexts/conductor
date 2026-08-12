import { HydratedDocument, model, Schema } from "mongoose";

export type RawStoreOrderNotification = ({
    status: "IN_PRODUCTION"
} | {
    status: "SHIPPED",
    trackingID: string;
    trackingURLs: string[];
})

export interface RawStoreOrder {
    id: string; // stripe checkout session id;
    status: "pending" | "completed" | "failed" | "canceled";
    error: string; // Error message if the order fails
    customerEmail?: string; // Marked optional for backwards compatibility, but should be set when creating a new order
    amountTotal?: number; // Order total in the smallest currency unit (e.g. cents), mirrored from the Stripe checkout session so the admin list never needs a live Stripe call
    currency?: string; // ISO currency code for amountTotal (e.g. "usd")
    luluJobID?: string;
    luluJobStatus?: string;
    luluJobStatusMessage?: string; // Error message if the Lulu job fails
    luluJobStatusUpdates?: Array<Record<string, any>>; // Array of status updates data from Lulu, if any
    notificationsSent?: Array<RawStoreOrderNotification>;
    supportTicketUUID?: string; // UUID of the system-generated support ticket, if one was opened for a failure/rejection

    createdAt?: Date; // Automatically set by Mongoose
    updatedAt?: Date; // Automatically set by Mongoose
}

export type StoreOrderDocument = HydratedDocument<RawStoreOrder>;

/**
 * StoreOrder is a lightweight model to track orders made through the store,
 * particularly to assist with reconciling orders with Lulu's print-on-demand service.
 * The vast majority of order information is/should be stored in Stripe,
 * but this model helps us quickly store and retrieve specialized order information
 */
const StoreOrderSchema = new Schema<RawStoreOrder>({
    id: {
        type: String,
        required: true,
        unique: true,
    },
    status: {
        type: String,
        enum: ["pending", "completed", "failed", "canceled"],
        default: "pending",
    },
    customerEmail: String, // Optional for backwards compatibility, but should be set when creating a new order
    amountTotal: Number, // Smallest currency unit (e.g. cents), mirrored from the Stripe checkout session
    currency: String, // ISO currency code for amountTotal (e.g. "usd")
    error: String,
    luluJobID: String,
    luluJobStatus: String,
    luluJobStatusMessage: String,
    luluJobStatusUpdates: {
        type: [Object],
    },
    notificationsSent: {
        type: [Object],
    },
    supportTicketUUID: String,
}, {
    timestamps: true
})

const StoreOrder = model<RawStoreOrder>('StoreOrder', StoreOrderSchema);
export default StoreOrder;