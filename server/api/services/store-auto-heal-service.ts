import { randomUUID } from "crypto";
import { childLogger } from "../../logger.js";
import StoreOrder, { RawStoreOrderAutoHealBook, StoreOrderDocument } from "../../models/storeorder.js";
import ShapeshiftService from "./shapeshift-service.js";
import storeService from "./store-service.js";
import { findProjectForBookID, submitCompileForBook } from "../shapeshift.js";
import { upsertStoreOrderToSearchIndex } from "./store-order-search-service.js";
import {
    AUTO_HEAL_ACTIVE_STATES,
    AUTO_HEAL_LOCK_MS,
    AUTO_HEAL_WORKING_STATES,
    getAutoHealConfirmMs,
    getAutoHealTickMs,
    shouldAutoHeal,
} from "./store-auto-heal-config.js";

const autoHealLog = childLogger("store-auto-heal");

/**
 * Automatic recovery for store orders whose Lulu print job was rejected.
 *
 * Almost every rejection has the same fix: recompile the book in Shapeshift, resubmit the identical
 * order payload. This reconciler does that once per order, and a support ticket is opened only if it
 * does not work -- which is the whole saving, since an operator no longer touches the common case.
 *
 * Everything it needs is on the StoreOrder document (`autoHeal`), and this loop is the only thing
 * that writes it. Nothing is held in memory between ticks, so a backend restart mid-compile costs
 * nothing: the next tick reads the same state and carries on, and an attempt whose absolute
 * `deadlineAt` passed while the process was down is abandoned on the first tick after boot.
 *
 * The Lulu webhook path deliberately does none of this work inline. It records the intent
 * (`state: "queued"`) and returns, which keeps the webhook fast and keeps `store-service.ts` free of
 * any import of this module.
 *
 * The invariant the whole design serves: a failed order is either being actively recovered or has a
 * support ticket. It is never quietly neither. Every state an attempt can sit in is one the loop
 * still selects, and every exit that is not a confirmed recovery ends in a ticket.
 */

/** The actor string every compile submitted by this reconciler is attributed to. */
const AUTO_HEAL_ACTOR = "system:store-auto-heal";

/**
 * How many orders one tick will advance.
 *
 * Each order costs Stripe, Shapeshift, and Lulu calls, so a backlog is drained over several ticks
 * rather than in one long pass that could outlive its own locks.
 */
const MAX_ORDERS_PER_TICK = 25;

/**
 * Backstop on the boot-time handoff sweep.
 *
 * Unlike a tick, this one must get through everything in flight rather than pacing itself, so the
 * bound is generous and exists only so a pathological data state cannot spin at startup.
 */
const MAX_DRAIN_ORDERS = 500;

let reconcilerTimer: NodeJS.Timeout | null = null;
let tickInFlight = false;

/**
 * The claim one tick holds on one order.
 *
 * `leaseID` is the part that matters. `lockedUntil` alone only stops a second instance from picking
 * the order up; it does nothing to stop the *first* instance from writing after its claim has
 * expired and been handed to someone else. Every write below is conditional on this ID, so a worker
 * that lost its claim mid-step writes nothing at all rather than landing a stale transition on top
 * of whoever owns the order now.
 */
type Lease = {
    order: StoreOrderDocument;
    leaseID: string;
};

/**
 * The filter every reconciler write starts from: this order, still held by this lease.
 *
 * Both terms are explicit `$eq` comparisons. Neither value reaches here from a request -- the order
 * ID comes off a document the reconciler just claimed and the lease ID is a locally generated
 * `randomUUID()` -- but a bare scalar in a Mongo filter is an operator-injection shape whether or
 * not the value is reachable, and it costs nothing to write the safe form everywhere.
 */
function ownedBy(orderID: string, leaseID: string): Record<string, unknown> {
    return {
        id: { $eq: orderID },
        "autoHeal.leaseID": { $eq: leaseID },
    };
}

/**
 * Extends this lease over the order, and reports whether it is still ours to extend.
 *
 * Called between the external calls of a step that makes several. A fixed TTL is only safe for a
 * step whose duration it actually covers, and a compile submission per book is not that step: on a
 * large or slow order it can outlive the lease, at which point another replica claims the order and
 * both submit. Renewing turns "the lease must be longer than the worst case" into "the lease must
 * be longer than one external call", which is a bound worth trusting.
 *
 * `matchedCount` rather than `modifiedCount`: the question is whether we still own the order, not
 * whether the timestamp happened to change.
 */
async function renewLease(orderID: string, leaseID: string): Promise<boolean> {
    const result = await StoreOrder.updateOne(
        ownedBy(orderID, leaseID),
        { $set: { "autoHeal.lockedUntil": new Date(Date.now() + AUTO_HEAL_LOCK_MS) } },
    );
    return result.matchedCount > 0;
}

/**
 * Claims one order for this tick, or returns `null` when there is nothing left to do.
 *
 * The claim is a single atomic write, so two instances cannot pick up the same order and both act
 * on it. `lockedUntil` is a TTL rather than a flag: an instance killed mid-tick releases its claim
 * by expiry instead of stranding the order forever, and the fresh `leaseID` written with it
 * invalidates every pending write the previous owner might still make.
 *
 * `excludeIDs` carries the orders this tick has already advanced. Each step releases its own lock
 * as its last write, so without it the sort would hand back the same oldest order every iteration:
 * one order would absorb the entire per-tick budget in redundant polls, and every newer order would
 * wait out the older one's deadline without a single compile being submitted.
 */
async function claimNextOrder(excludeIDs: string[]): Promise<Lease | null> {
    const now = new Date();
    const leaseID = randomUUID();

    const order = await StoreOrder.findOneAndUpdate(
        {
            ...(excludeIDs.length > 0 ? { id: { $nin: excludeIDs } } : {}),
            "autoHeal.state": { $in: [...AUTO_HEAL_ACTIVE_STATES] },
            $or: [
                { "autoHeal.lockedUntil": { $exists: false } },
                { "autoHeal.lockedUntil": null },
                { "autoHeal.lockedUntil": { $lt: now } },
            ],
        },
        {
            $set: {
                "autoHeal.lockedUntil": new Date(now.getTime() + AUTO_HEAL_LOCK_MS),
                "autoHeal.leaseID": leaseID,
            },
        },
        { new: true, sort: { "autoHeal.startedAt": 1 } },
    );

    return order ? { order, leaseID } : null;
}

/** Releases this tick's claim so the next tick can pick the order up immediately. */
async function releaseLock(orderID: string, leaseID: string): Promise<void> {
    await StoreOrder.updateOne(ownedBy(orderID, leaseID), { $unset: { "autoHeal.lockedUntil": "" } });
}

/**
 * Opens the ticket an abandoned attempt owes a human, and closes the attempt out once it lands.
 *
 * The attempt is not marked `abandoned` until the ticket UUID is actually on the order. Ticket
 * creation swallows its own failures by design, so marking the attempt terminal first and hoping
 * would drop the order out of the reconciler's selection with nothing recorded anywhere: a failed
 * order, no ticket, no retry, no trace. `ticket_pending` is a state the loop still selects, so a
 * ticket service that is down for ten minutes costs ten minutes rather than the order.
 *
 * The caller must hold the lease and the lock, and this releases the lock on the way out. Ticket
 * creation dedupes by reading `supportTicketUUID` and then writing it, which is not atomic, so two
 * replicas running this at once on the same order would each find no ticket and each create one.
 * The lease is what makes that impossible: an order is only ever ticketed by whoever holds it.
 */
async function openPendingTicket(orderID: string, leaseID: string): Promise<void> {
    const ticketUUID = await storeService.openDeferredFailureTicket(orderID);

    if (!ticketUUID) {
        const bumped = await StoreOrder.findOneAndUpdate(
            { ...ownedBy(orderID, leaseID), "autoHeal.state": { $eq: "ticket_pending" } },
            { $inc: { "autoHeal.ticketAttempts": 1 }, $unset: { "autoHeal.lockedUntil": "" } },
            { new: true },
        );
        autoHealLog.warn(
            { orderID, attempts: bumped?.autoHeal?.ticketAttempts },
            "Could not open the deferred failure ticket; the order stays selected and the next tick retries",
        );
        return;
    }

    await StoreOrder.updateOne(
        { ...ownedBy(orderID, leaseID), "autoHeal.state": { $eq: "ticket_pending" } },
        {
            $set: { "autoHeal.state": "abandoned", "autoHeal.finishedAt": new Date() },
            $unset: { "autoHeal.lockedUntil": "" },
        },
    );

    autoHealLog.info({ orderID, ticketUUID }, "Handed the order to a human; the deferred failure ticket is open");

    // Best-effort: reflect the new auto-heal state in the admin index (fire-and-forget).
    void upsertStoreOrderToSearchIndex(orderID);
}

/**
 * Gives up on an attempt and hands the order to a human.
 *
 * This is the only path that opens the ticket the webhook deferred, so every exit that is not a
 * confirmed recovery must come through here. Otherwise a failed order would sit `failed` with nobody
 * told about it, which is strictly worse than the behavior this feature replaced.
 *
 * Conditional on the attempt still being at work. An admin submitting a print job by hand retires
 * the attempt as `superseded` deliberately without a ticket, and a tick that had already decided to
 * give up must not overwrite that and open one anyway.
 */
async function abandon(order: StoreOrderDocument, reason: string, leaseID: string): Promise<void> {
    autoHealLog.warn({ orderID: order.id, reason }, "Abandoning automatic recovery attempt");

    // The lock is renewed here rather than released. Ticket creation runs next and dedupes with a
    // non-atomic read-then-write, so handing the order back before it finishes would let another
    // replica claim it and open a second ticket for the same failure.
    const result = await StoreOrder.updateOne({
        ...ownedBy(order.id, leaseID),
        "autoHeal.state": { $in: [...AUTO_HEAL_WORKING_STATES] },
    }, {
        $set: {
            "autoHeal.state": "ticket_pending",
            "autoHeal.stoppedReason": reason,
            "autoHeal.lockedUntil": new Date(Date.now() + AUTO_HEAL_LOCK_MS),
        },
    });

    if (result.matchedCount === 0) {
        autoHealLog.info(
            { orderID: order.id },
            "The attempt was already resolved elsewhere; leaving it and its ticketing alone",
        );
        return;
    }

    void upsertStoreOrderToSearchIndex(order.id);
    await openPendingTicket(order.id, leaseID);
}

/**
 * Retires an attempt that is no longer needed, without opening a ticket.
 *
 * Distinct from {@link abandon}, which is a failure. Nothing is wrong here, so telling a human about
 * it would be noise.
 */
async function standDown(order: StoreOrderDocument, reason: string, leaseID: string): Promise<void> {
    autoHealLog.info({ orderID: order.id, reason }, "Standing down the automatic recovery attempt");

    await StoreOrder.updateOne({
        ...ownedBy(order.id, leaseID),
        "autoHeal.state": { $in: [...AUTO_HEAL_ACTIVE_STATES] },
    }, {
        $set: {
            "autoHeal.state": "superseded",
            "autoHeal.stoppedReason": reason,
            "autoHeal.finishedAt": new Date(),
        },
        $unset: { "autoHeal.lockedUntil": "" },
    });

    void upsertStoreOrderToSearchIndex(order.id);
}

/**
 * Submits a Shapeshift compile for every book on the order.
 *
 * The payload is rebuilt through `buildPrintJobParams` rather than read off the failed Lulu job,
 * because that builder is the one the manual resubmit already uses and it reports, as warnings,
 * exactly the conditions under which a payload cannot be sent verbatim. Any warning means the order
 * genuinely needs a human, so the attempt ends here rather than recompiling books toward a
 * resubmission that would be refused anyway.
 *
 * This is the longest step, and the only one whose duration scales with the order: a submission per
 * book, each an HTTP call. So it does not trust one fixed lease to cover the whole loop. The lease
 * is renewed before every submission and each accepted job ID is pushed as soon as it exists, which
 * makes the step both safe to interrupt and safe to resume -- a book already carrying a job ID is
 * skipped rather than compiled twice, and a worker that loses the lease mid-loop stops instead of
 * racing whoever holds it now.
 */
async function advanceQueued(order: StoreOrderDocument, leaseID: string): Promise<void> {
    const built = await storeService.buildPrintJobParams(order.id);
    if (!built) {
        await abandon(order, "The order could not be read back while rebuilding its print job payload.", leaseID);
        return;
    }
    if (built.warnings.length > 0) {
        await abandon(order, `The print job payload cannot be rebuilt automatically: ${built.warnings.join(" ")}`, leaseID);
        return;
    }

    const bookIDs = [...new Set(built.params.line_items.map((item) => item.external_id).filter(Boolean))];
    if (bookIDs.length === 0) {
        await abandon(order, "No books resolved from the order, so there is nothing to recompile.", leaseID);
        return;
    }

    // A previous pass may have submitted some of these already, either because it lost the lease
    // partway or because the process went down between two books. Those keep their job IDs.
    const alreadySubmitted = new Set(
        (order.autoHeal?.books ?? [])
            .filter((b) => !!b.shapeshiftJobID)
            .map((b) => b.bookID),
    );

    const submitted: string[] = [];
    for (const bookID of bookIDs) {
        if (alreadySubmitted.has(bookID)) continue;

        // Check ownership before spending an external call, not after. Losing the lease here is not
        // an error -- another replica is working the order and will submit this book itself.
        if (!await renewLease(order.id, leaseID)) {
            autoHealLog.warn(
                { orderID: order.id, bookID },
                "Lost the claim on a queued order while submitting recompiles; another instance owns it now",
            );
            return;
        }

        const project = await findProjectForBookID(bookID);
        if (!project) {
            // Partial recompiles are not worth submitting: the resubmission would carry freshly
            // compiled files for some books and the same stale ones for the rest, and Lulu would
            // reject it for the same reason as before.
            await abandon(order, `No Conductor project owns book ${bookID}, so it cannot be recompiled automatically.`, leaseID);
            return;
        }

        const result = await submitCompileForBook(project, bookID, AUTO_HEAL_ACTOR);
        if (!result.ok) {
            await abandon(order, `Could not start a recompile of book ${bookID}: ${result.errMsg}`, leaseID);
            return;
        }

        // Recorded immediately. A job that exists in Shapeshift but not on the order is a compile
        // nothing is tracking, and the next pass would submit a second one for the same book.
        const recorded = await StoreOrder.updateOne({
            ...ownedBy(order.id, leaseID),
            "autoHeal.state": { $eq: "queued" },
        }, {
            $push: { "autoHeal.books": { bookID, shapeshiftJobID: result.jobId, status: "pending" } },
            $set: { "autoHeal.lockedUntil": new Date(Date.now() + AUTO_HEAL_LOCK_MS) },
        });

        if (recorded.matchedCount === 0) {
            autoHealLog.warn(
                { orderID: order.id, bookID, shapeshiftJobID: result.jobId },
                "Lost the claim on a queued order just after submitting a recompile; the job is running untracked",
            );
            return;
        }

        submitted.push(bookID);
    }

    const advanced = await StoreOrder.updateOne({
        ...ownedBy(order.id, leaseID),
        "autoHeal.state": { $eq: "queued" },
    }, {
        $set: { "autoHeal.state": "compiling" },
        $unset: { "autoHeal.lockedUntil": "" },
    });

    if (advanced.matchedCount === 0) {
        autoHealLog.warn(
            { orderID: order.id },
            "Lost the claim on a queued order before it could move to compiling; another instance owns it now",
        );
        return;
    }

    autoHealLog.info(
        { orderID: order.id, submitted, resumed: [...alreadySubmitted] },
        "Submitted recompiles for every book on the order",
    );

    void upsertStoreOrderToSearchIndex(order.id);
}

/**
 * Reads each recompile back and moves the attempt on once they have all finished.
 *
 * A `null` from `getJob` covers both a job Shapeshift does not know and a transport failure, and
 * neither is evidence of anything, so it counts as still running. That is safe precisely because the
 * deadline -- not this function -- is what stops an attempt: a job that never reports, or one stuck
 * `inprogress`, is bounded by `deadlineAt` rather than polled forever.
 */
async function advanceCompiling(order: StoreOrderDocument, leaseID: string): Promise<void> {
    const service = new ShapeshiftService();
    const books = order.autoHeal?.books ?? [];
    const updated: RawStoreOrderAutoHealBook[] = [];

    for (const book of books) {
        if (book.status !== "pending" || !book.shapeshiftJobID) {
            updated.push(book);
            continue;
        }

        const job = await service.getJob(book.shapeshiftJobID);
        if (job?.status === "finished") {
            updated.push({ ...book, status: "finished" });
        } else if (job?.status === "failed") {
            updated.push({ ...book, status: "failed", error: "Shapeshift reported the compile as failed." });
        } else {
            updated.push(book);
        }
    }

    // Nothing to wait for. Falling through would hold the order here until its deadline and then
    // produce a ticket blaming a Shapeshift timeout that never happened, 45 minutes late.
    // "advanceQueued" makes this unreachable today; it is here so a hand-edited document, or a
    // future writer of "books", fails immediately and truthfully instead of stalling in silence.
    if (updated.length === 0) {
        await abandon(order, "The recovery attempt reached the compile step with no books recorded, so there is nothing to wait for.", leaseID);
        return;
    }

    const failed = updated.find((b) => b.status === "failed");
    if (failed) {
        await StoreOrder.updateOne(ownedBy(order.id, leaseID), { $set: { "autoHeal.books": updated } });
        await abandon(order, `The recompile of book ${failed.bookID} failed in Shapeshift.`, leaseID);
        return;
    }

    const allFinished = updated.every((b) => b.status === "finished");
    await StoreOrder.updateOne({
        ...ownedBy(order.id, leaseID),
        "autoHeal.state": { $eq: "compiling" },
    }, {
        $set: {
            "autoHeal.books": updated,
            ...(allFinished ? { "autoHeal.state": "resubmitting" } : {}),
        },
        $unset: { "autoHeal.lockedUntil": "" },
    });

    if (allFinished) {
        autoHealLog.info({ orderID: order.id }, "All recompiles finished; resubmitting the order to Lulu");
    }
}

/**
 * Resubmits the order through the same path the admin "Resubmit" button uses.
 *
 * `fromAutoHeal` is what stops `_recordLuluJobOnOrder` from reading this submission as an admin
 * stepping in and retiring the very attempt that made it.
 *
 * This is the one step that spends real money and ships real books, so it is deliberately
 * at-most-once rather than at-least-once. `resubmitStartedAt` is claimed before the call and never
 * cleared, so a worker that dies mid-submission does not hand the order to a second worker who would
 * submit again: two accepted Lulu jobs means two sets of books arriving at a customer's door, which
 * is far worse than the support ticket the stalled attempt will produce instead.
 *
 * The order deliberately stays `failed` afterwards. Lulu accepting a submission says nothing about
 * whether it will pass validation, so the failure is cleared only once a PRODUCTION_DELAYED or later
 * webhook arrives -- the existing contract in `processLuluOrderUpdate`, and the same thing that
 * flips this attempt to `succeeded`.
 */
async function advanceResubmitting(order: StoreOrderDocument, leaseID: string): Promise<void> {
    const claimed = await StoreOrder.findOneAndUpdate(
        {
            ...ownedBy(order.id, leaseID),
            "autoHeal.state": { $eq: "resubmitting" },
            "autoHeal.resubmitStartedAt": { $exists: false },
        },
        { $set: { "autoHeal.resubmitStartedAt": new Date() } },
        { new: true },
    );

    if (!claimed) {
        const current = await StoreOrder.findOne({ id: { $eq: order.id } }).lean();
        const startedAt = current?.autoHeal?.resubmitStartedAt;

        // A submission that started longer ago than a whole lease and never wrote its result is a
        // worker that died mid-call. Nothing will ever retry it, by design, so say so now instead of
        // letting the order sit until its deadline and then blaming a timeout.
        if (
            current?.autoHeal?.state === "resubmitting"
            && startedAt
            && Date.now() - new Date(startedAt).getTime() > AUTO_HEAL_LOCK_MS
        ) {
            await abandon(
                order,
                "An automatic resubmission to Lulu was started but never reported back, so Conductor cannot tell whether Lulu received it. Check Lulu for a print job on this order before resubmitting by hand.",
                leaseID,
            );
            return;
        }

        // Otherwise another instance is submitting right now, or already has. Leave it alone.
        await releaseLock(order.id, leaseID);
        return;
    }

    const result = await storeService.resubmitLuluJob(order.id, { fromAutoHeal: true });

    if ("error" in result) {
        await abandon(order, `Lulu did not accept the automatic resubmission: ${result.detail || result.error}`, leaseID);
        return;
    }

    // A second clock, not an extension of the first. `deadlineAt` covers the recompile, which may
    // legitimately have consumed most of it, and Lulu's verdict on the new job is a wait Conductor
    // has not started measuring until now.
    const now = new Date();
    await StoreOrder.updateOne({
        ...ownedBy(order.id, leaseID),
        "autoHeal.state": { $eq: "resubmitting" },
    }, {
        $set: {
            "autoHeal.state": "resubmitted",
            "autoHeal.resubmittedLuluJobID": result.id.toString(),
            "autoHeal.resubmittedAt": now,
            "autoHeal.confirmationDeadlineAt": new Date(now.getTime() + getAutoHealConfirmMs()),
        },
        $unset: { "autoHeal.lockedUntil": "" },
    });

    autoHealLog.info(
        { orderID: order.id, luluJobID: result.id },
        "Resubmitted the order to Lulu automatically; awaiting Lulu's verdict on the new job",
    );

    void upsertStoreOrderToSearchIndex(order.id);
}

/**
 * Waits on Lulu's verdict for the job this attempt submitted.
 *
 * There is nothing to do here but wait, and yet the state is deliberately one the reconciler still
 * selects. Everything that resolves it arrives by webhook -- `processLuluOrderUpdate` flips the
 * attempt to `succeeded` on a confirmed status and tickets on a failed one -- and a webhook that is
 * never delivered would otherwise leave the order failed, unticketed, and unwatched forever, which
 * is the one outcome this feature must never produce. Staying selected is what lets
 * `confirmationDeadlineAt` eventually turn Lulu's silence into a ticket.
 */
async function advanceResubmitted(order: StoreOrderDocument, leaseID: string): Promise<void> {
    await releaseLock(order.id, leaseID);
}

/**
 * The moment this attempt is out of time, which is not the same clock at every step.
 *
 * Up to and including the resubmission it is `deadlineAt`, measured from the failure that started
 * the attempt. Afterwards it is `confirmationDeadlineAt`, measured from the resubmission itself,
 * because a recompile that legitimately ran for 40 of the 45 minutes must not leave Lulu five
 * minutes to answer.
 */
function effectiveDeadline(autoHeal: NonNullable<StoreOrderDocument["autoHeal"]>): Date | null {
    // The fallback matters at deploy time. An attempt resubmitted by the previous version carries no
    // confirmation deadline, and treating that as "no deadline" would reproduce the exact hole this
    // clock exists to close. "deadlineAt" is almost certainly in the past for such an order, which
    // tickets it on the first tick -- the right call for a resubmission nobody was watching.
    if (autoHeal.state === "resubmitted" && autoHeal.confirmationDeadlineAt) {
        return new Date(autoHeal.confirmationDeadlineAt);
    }
    return autoHeal.deadlineAt ? new Date(autoHeal.deadlineAt) : null;
}

/** What the ticket says when the clock, rather than an error, ended the attempt. */
function timeoutReason(autoHeal: NonNullable<StoreOrderDocument["autoHeal"]>): string {
    if (autoHeal.state === "resubmitted") {
        return `Conductor recompiled this order's books and resubmitted it to Lulu (job ${autoHeal.resubmittedLuluJobID || "unknown"}), but Lulu never confirmed the new print job. Check the job in Lulu before resubmitting.`;
    }
    return `Automatic recovery ran out of time while ${autoHeal.state}, so the order was never resubmitted.`;
}

/**
 * Advances one claimed order by one step.
 *
 * Order of checks matters. An order that stopped being failed needs no recovery and no ticket,
 * whatever step it was on. A pending ticket is the tail of an attempt that already ended, so it must
 * not be re-judged against a deadline it is already past. Only then does the clock apply.
 */
async function advanceOrder({ order, leaseID }: Lease): Promise<void> {
    const autoHeal = order.autoHeal;
    if (!autoHeal) return;

    // The order stopped being failed while the attempt was running: Lulu accepted the original job
    // after all, or an admin resolved or cancelled the order. Resubmitting now would put a second
    // print job on a healthy order, which means a second set of books physically shipped to the
    // customer -- far worse than the ticket this attempt was avoiding.
    if (order.status !== "failed") {
        await standDown(order, `The order is no longer failed (now '${order.status}'), so it does not need recovering.`, leaseID);
        return;
    }

    // The attempt is over and only the handoff is outstanding. Retry it until the ticket exists.
    if (autoHeal.state === "ticket_pending") {
        await openPendingTicket(order.id, leaseID);
        return;
    }

    const deadline = effectiveDeadline(autoHeal);
    if (deadline && deadline.getTime() <= Date.now()) {
        await abandon(order, timeoutReason(autoHeal), leaseID);
        return;
    }

    switch (autoHeal.state) {
        case "queued":
            await advanceQueued(order, leaseID);
            return;
        case "compiling":
            await advanceCompiling(order, leaseID);
            return;
        case "resubmitting":
            await advanceResubmitting(order, leaseID);
            return;
        case "resubmitted":
            await advanceResubmitted(order, leaseID);
            return;
        default:
            // Terminal, or a state written by a newer version of this service. Release the claim
            // rather than holding it until the TTL expires.
            await releaseLock(order.id, leaseID);
    }
}

/**
 * Advances every order with a recovery attempt in flight.
 *
 * Exported for the reconciler loop and for manual invocation from a migration or a REPL. Never
 * throws: one order that blows up must not stop the rest of the batch, and there is no caller in a
 * position to do anything with the error.
 */
export async function runAutoHealTick(): Promise<void> {
    // One step per order per tick. Anything an order is waiting on -- a Shapeshift compile, Lulu
    // accepting a resubmission -- takes far longer than the interval, so advancing it twice in the
    // same tick buys nothing and costs an external call each time.
    const advanced: string[] = [];

    for (let processed = 0; processed < MAX_ORDERS_PER_TICK; processed++) {
        let lease: Lease | null = null;
        try {
            lease = await claimNextOrder(advanced);
            if (!lease) return;
            advanced.push(lease.order.id);
            await advanceOrder(lease);
        } catch (err) {
            autoHealLog.error({ err, orderID: lease?.order.id }, "Auto-heal tick failed for an order");
            if (lease) {
                // Hand the order straight back rather than letting it sit out the lock TTL. A
                // failure here is usually transient (a Stripe or Shapeshift blip), and the deadline
                // is what stops it retrying indefinitely.
                await releaseLock(lease.order.id, lease.leaseID).catch(() => undefined);
            }
        }
    }

    autoHealLog.info(`Auto-heal tick hit its per-tick limit of ${MAX_ORDERS_PER_TICK} orders; the rest will be picked up next tick.`);
}

/**
 * Hands every in-flight attempt straight to a human, on an instance that will not be advancing them.
 *
 * Switching the feature off has to be safe to do with orders mid-attempt. Those orders are `failed`
 * with their ticket deliberately withheld, and once the loop stops nothing enforces their deadline,
 * so leaving them alone would hide failed orders for good. A kill switch that buries failures is
 * worse than no kill switch, so flipping it off opens the tickets the attempts were holding back.
 *
 * Claims each order the same way a tick does. Ticket creation dedupes non-atomically, and every
 * replica runs this sweep at boot, so without the claim a rolling restart across three tasks would
 * open three tickets for the same order.
 */
async function drainAttemptsOnInactiveInstance(): Promise<void> {
    const drained: string[] = [];

    // Bounded only as a backstop. Each order is added to the exclusion list whether or not its
    // handoff succeeded, so the loop terminates on its own.
    for (let processed = 0; processed < MAX_DRAIN_ORDERS; processed++) {
        let lease: Lease | null = null;
        try {
            lease = await claimNextOrder(drained);
            if (!lease) break;
            drained.push(lease.order.id);

            if (drained.length === 1) {
                autoHealLog.warn("Auto-heal is inactive with attempts still in flight; opening the tickets they were holding back");
            }

            if (lease.order.autoHeal?.state === "ticket_pending") {
                await openPendingTicket(lease.order.id, lease.leaseID);
                continue;
            }
            await abandon(lease.order, "Automatic recovery was switched off while this attempt was running, so the order needs manual resolution.", lease.leaseID);
        } catch (err) {
            autoHealLog.error({ err, orderID: lease?.order.id }, "Failed to hand off an in-flight recovery attempt");
            if (lease) await releaseLock(lease.order.id, lease.leaseID).catch(() => undefined);
        }
    }

    if (drained.length > 0) {
        autoHealLog.info({ count: drained.length }, "Handed off every in-flight recovery attempt");
    }
}

/**
 * Starts the reconciler loop.
 *
 * Gated on the same {@link shouldAutoHeal} the webhook path uses to defer a ticket in the first
 * place, so an instance that defers is always an instance that drains. An inactive instance does not
 * simply return: anything already in flight is handed to a human on the way out. `unref()` keeps
 * the timer from holding the process open during a shutdown, and the in-flight guard keeps a tick
 * that runs long from overlapping the next one.
 */
export function startAutoHealReconciler(): void {
    if (!shouldAutoHeal()) {
        autoHealLog.info("Store order auto-heal is not active on this instance");
        void drainAttemptsOnInactiveInstance()
            .catch((err) => autoHealLog.error({ err }, "Auto-heal hand-off sweep failed"));
        return;
    }
    if (reconcilerTimer) return;

    const intervalMs = getAutoHealTickMs();
    reconcilerTimer = setInterval(() => {
        if (tickInFlight) return;
        tickInFlight = true;
        void runAutoHealTick()
            .catch((err) => autoHealLog.error({ err }, "Auto-heal reconciler tick failed"))
            .finally(() => { tickInFlight = false; });
    }, intervalMs);
    reconcilerTimer.unref();

    autoHealLog.info({ intervalMs }, "Store order auto-heal reconciler started");
}

/** Stops the reconciler. Exists for tests and for a clean shutdown path. */
export function stopAutoHealReconciler(): void {
    if (!reconcilerTimer) return;
    clearInterval(reconcilerTimer);
    reconcilerTimer = null;
}
