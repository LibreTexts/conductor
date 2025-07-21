import { HydratedDocument, model, Schema } from "mongoose";

export interface RawStoreOrder {
    id: string; // stripe checkout session id;
    status: "pending" | "completed" | "failed" | "canceled";
    error: string; // Error message if the order fails
    luluJobID?: string;
    luluJobStatus?: string;
    luluJobStatusMessage?: string; // Error message if the Lulu job fails
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
    error: String,
    luluJobID: String,
    luluJobStatus: String,
    luluJobStatusMessage: String,
}, {
    timestamps: true
})

const StoreOrder = model<RawStoreOrder>('StoreOrder', StoreOrderSchema);
export default StoreOrder;