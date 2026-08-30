import { HydratedDocument, model, Schema } from "mongoose";

export type RawStoreOrderNotification = ({
    status: "IN_PRODUCTION"
} | {
    status: "SHIPPED",
    trackingID: string;
    trackingURLs: string[];
})

/**
 * Audit record of a print job submitted manually by a superadmin through the
 * "Submit Order Details Manually" flow, where the Lulu payload was hand-edited
 * rather than derived verbatim from the Stripe checkout session.
 *
 * `payload` contains customer PII (shipping address, email), exactly like the rest of
 * this document. It must never be added to the storeOrders search index projection.
 */
export type RawManualPrintJobSubmission = {
    submittedBy: string; // Central Identity UUID of the submitting superadmin
    submittedAt: Date;
    payload: Record<string, any>; // The params as submitted to Lulu, including the server-forced external_id
    luluJobID?: string; // Set only when Lulu accepted the job
    success: boolean;
    error?: string; // Set only when the submission failed
}

/**
 * One book being recompiled as part of an order's automatic recovery attempt.
 *
 * `shapeshiftJobID` is absent only when the compile submission itself failed, which abandons the
 * whole attempt — a partial recompile would resubmit stale files for the remaining books.
 */
export type RawStoreOrderAutoHealBook = {
    bookID: string;
    shapeshiftJobID?: string;
    status: "pending" | "finished" | "failed";
    error?: string;
}

/**
 * State of the one automatic recovery attempt an order gets after Lulu rejects or errors on its
 * print job: recompile every book in Shapeshift, then resubmit the same payload the manual
 * "Resubmit" button would send.
 *
 * Advanced ONLY by the reconciler in `store-auto-heal-service.ts`. Keeping it on the document
 * rather than in memory is what makes it survive a backend restart. `deadlineAt` is absolute, so
 * neither a restart nor an outage can extend the window; `lockedUntil` is a short TTL claim so two
 * instances cannot both act on the same order.
 */
export type RawStoreOrderAutoHeal = {
    /**
     * `abandoned` and `superseded` are both terminal and both mean the attempt stopped early, but
     * they are not interchangeable: `abandoned` is a failure that opens the support ticket the
     * webhook deferred, while `superseded` means the attempt was no longer needed (an admin
     * submitted a job by hand, or the order stopped being failed) and no ticket is warranted.
     *
     * `ticket_pending` is the step between giving up and `abandoned`: the attempt is over, but the
     * support ticket it owes a human does not exist yet. The reconciler keeps selecting it and
     * retrying, because ticket creation is best-effort and an order that went terminal without one
     * would be a failure nobody is ever told about.
     */
    state: "queued" | "compiling" | "resubmitting" | "resubmitted" | "ticket_pending" | "succeeded" | "abandoned" | "superseded";
    triggeredByLuluJobID: string; // The Lulu job whose failure started this attempt
    startedAt: Date;
    deadlineAt: Date; // Absolute cutoff for the recompile-and-resubmit work
    books: Array<RawStoreOrderAutoHealBook>;
    lockedUntil?: Date;
    /**
     * Identifies the reconciler tick that currently owns this attempt.
     *
     * Rewritten on every claim, and required by every write the reconciler makes. `lockedUntil`
     * alone only stops a second instance from picking the order up; this is what stops the first
     * instance from landing a write after its claim expired and moved on to someone else.
     */
    leaseID?: string;
    /**
     * Set immediately before the one Lulu submission this attempt is allowed, and never cleared.
     *
     * Makes the submission at-most-once. A worker that dies mid-call leaves this behind so no other
     * worker resubmits: a duplicate Lulu job means a duplicate physical shipment, which is worse
     * than the support ticket the stalled attempt produces instead.
     */
    resubmitStartedAt?: Date;
    resubmittedAt?: Date;
    resubmittedLuluJobID?: string; // Set once Lulu accepts the automatic resubmission
    confirmationDeadlineAt?: Date; // How long Lulu has to confirm the resubmitted job; see getAutoHealConfirmMs
    ticketAttempts?: number; // Failed attempts to open the deferred ticket, while state is "ticket_pending"
    stoppedReason?: string; // Why the attempt stopped early; quoted in the support ticket when abandoned
    finishedAt?: Date; // Set only on a terminal state, and for "abandoned" only once the ticket exists
}

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
    luluJobStatusUpdates?: Array<Record<string, any>>; // Array of status updates data from Lulu for the CURRENT job, if any
    ignoredLuluJobStatusUpdates?: Array<Record<string, any>>; // Webhook payloads deliberately not applied (superseded job, or an out-of-order redelivery). Kept for forensics only — never a source of order or shipping state.
    notificationsSent?: Array<RawStoreOrderNotification>;
    supportTicketUUID?: string; // UUID of the system-generated support ticket, if one was opened for a failure/rejection
    manualPrintJobSubmissions?: Array<RawManualPrintJobSubmission>; // Audit trail of hand-edited print job submissions
    luluJobFailCount?: number; // Distinct Lulu job failures recorded for this order (redelivered webhooks excluded)
    autoHeal?: RawStoreOrderAutoHeal; // The order’s one automatic recovery attempt, if it got one

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
    ignoredLuluJobStatusUpdates: {
        type: [Object],
    },
    notificationsSent: {
        type: [Object],
    },
    supportTicketUUID: String,
    manualPrintJobSubmissions: {
        type: [Object],
    },
    luluJobFailCount: Number,
    autoHeal: {
        type: Object,
    },
}, {
    timestamps: true
})

/**
 * Serves the auto-heal reconciler's claim query, which runs every 30 seconds for the life of the
 * process: filter on `autoHeal.state`, sort on `autoHeal.startedAt`.
 *
 * Partial on purpose. Orders that have ever had a recovery attempt are a rounding error against
 * every order the store has processed, so this index stays a handful of entries wide no matter how
 * large the collection grows. Without it the claim is a full scan of documents that are not small
 * (`luluJobStatusUpdates` and `manualPrintJobSubmissions` accumulate whole payloads), twice a
 * minute, forever.
 */
StoreOrderSchema.index(
    { "autoHeal.state": 1, "autoHeal.startedAt": 1 },
    { partialFilterExpression: { "autoHeal.state": { $exists: true } } },
);

const StoreOrder = model<RawStoreOrder>('StoreOrder', StoreOrderSchema);
export default StoreOrder;