import { Document, model, Schema } from "mongoose";



export interface StoreOrderInterface extends Document {
    id: string; // stripe checkout session id;
    status: "pending" | "completed" | "failed";
    error: string; // Error message if the order fails
    luluJobID?: string;
    luluJobStatus?: string;
    luluJobError?: string; // Error message if the Lulu job fails
    createdAt?: Date; // Automatically set by Mongoose
    updatedAt?: Date; // Automatically set by Mongoose
}

/**
 * StoreOrder is a lightweight model to track orders made through the store,
 * particularly to assist with reconciling orders with Lulu's print-on-demand service.
 * The vast majority of order information is/should be stored in Stripe,
 * but this model helps us quickly store and retrieve specialized order information
 */
const StoreOrderSchema = new Schema<StoreOrderInterface>({
    id: {
        type: String,
        required: true,
        unique: true,
    },
    status: {
        type: String,
        enum: ["pending", "completed", "failed"],
        default: "pending",
    },
    error: String,
    luluJobID: String,
    luluJobStatus: String,
    luluJobError: String
}, {
    timestamps: true
})

const StoreOrder = model<StoreOrderInterface>('StoreOrder', StoreOrderSchema);
export default StoreOrder;