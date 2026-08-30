import { LULU_FAILURE_STATUSES, LuluPrintJobStatus } from "../../types/Lulu.js";

/**
 * Configuration for the store order auto-heal attempt.
 *
 * Lives in its own module, with no imports beyond the Lulu status types, so that both the Lulu
 * webhook path (`store-service.ts`, which only records the intent) and the reconciler
 * (`store-auto-heal-service.ts`, which does the work and imports the store service) can read it
 * without the two importing each other.
 */

/**
 * Lulu failure statuses that earn an automatic recovery attempt.
 *
 * A deliberate subset of {@link LULU_FAILURE_STATUSES}: CANCELED is excluded because it normally
 * means somebody cancelled the job on purpose, and recompiling and resubmitting it would resurrect
 * an order that was meant to die. A CANCELED job keeps the original behavior — fail the order and
 * open the ticket immediately.
 */
export const AUTO_HEAL_TRIGGER_STATUSES: ReadonlySet<string> = new Set<LuluPrintJobStatus>([
    "REJECTED",
    "ERROR",
]);

/** Kill switch. Defaults to enabled; set `STORE_AUTO_HEAL_ENABLED=false` to turn it off. */
export function isAutoHealEnabled(): boolean {
    return process.env.STORE_AUTO_HEAL_ENABLED?.toLowerCase() !== "false";
}

/**
 * Whether this instance both defers failure tickets to a recovery attempt and runs the loop that
 * advances them.
 *
 * Deliberately one predicate rather than two. The Lulu webhook route carries no tenant guard, so an
 * instance that deferred a ticket on a rule the reconciler did not share would leave the order
 * `failed`, unticketed, and with nobody enforcing its deadline -- a failure nobody is told about,
 * which is strictly worse than the immediate ticket this feature replaced.
 */
export function shouldAutoHeal(): boolean {
    return process.env.ORG_ID === "libretexts" && isAutoHealEnabled();
}

/**
 * How long an attempt has, measured from the failure that started it, before the reconciler gives
 * up and opens the ticket.
 *
 * Deliberately generous: a large book's compile legitimately runs for tens of minutes, and giving
 * up early produces exactly the ticket this feature exists to avoid. 45 minutes matches the window
 * the compile drawer already assumes (`OPTIMISTIC_JOB_MAX_AGE_MS` in `useShapeshift.ts`).
 */
export function getAutoHealTimeoutMs(): number {
    const minutes = Number(process.env.STORE_AUTO_HEAL_TIMEOUT_MINUTES);
    return (Number.isFinite(minutes) && minutes > 0 ? minutes : 45) * 60 * 1000;
}

/**
 * How long Lulu gets to confirm the print job an attempt resubmitted, before Conductor stops
 * waiting and opens the ticket.
 *
 * A separate clock from the compile deadline, and started only once the resubmission lands. Lulu
 * accepting a submission is not a verdict: the job reports CREATED immediately and can still be
 * rejected, so the attempt is not finished until a PRODUCTION_DELAYED or later status arrives by
 * webhook. If that webhook is lost or the job simply never progresses, this is the only thing
 * standing between the order and sitting failed, unticketed, forever.
 */
export function getAutoHealConfirmMs(): number {
    const minutes = Number(process.env.STORE_AUTO_HEAL_CONFIRM_MINUTES);
    return (Number.isFinite(minutes) && minutes > 0 ? minutes : 60) * 60 * 1000;
}

/** How often the reconciler looks for work. */
export function getAutoHealTickMs(): number {
    const seconds = Number(process.env.STORE_AUTO_HEAL_TICK_SECONDS);
    return (Number.isFinite(seconds) && seconds > 0 ? seconds : 30) * 1000;
}

/**
 * How long one reconciler tick holds its claim on an order.
 *
 * Sized to outlast the slowest thing one step can do rather than the typical case, because the
 * claim expiring mid-step is exactly what lets a second instance repeat that step: a second set of
 * Shapeshift compiles, or worse, a second Lulu print job for the same order. The slowest step is a
 * resubmission (read the live Stripe session, rebuild the payload, submit to Lulu), with a compile
 * submission on a many-book order not far behind.
 *
 * Erring long costs almost nothing. Every step releases its own claim on the way out, so this only
 * governs an instance that died mid-step, and five minutes of waiting is immaterial against the
 * 45 minute deadline the attempt is working within.
 */
export const AUTO_HEAL_LOCK_MS = 5 * 60 * 1000;

/**
 * Auto-heal states where the attempt is still doing something a deadline should bound.
 *
 * "resubmitted" belongs here despite the work being finished: Lulu has not delivered its verdict
 * yet, and until it does the order is failed with its ticket deliberately withheld.
 */
export const AUTO_HEAL_WORKING_STATES = ["queued", "compiling", "resubmitting", "resubmitted"] as const;

/**
 * Every auto-heal state the reconciler still selects.
 *
 * The working states plus "ticket_pending", which is an attempt that has already given up and is
 * waiting only on its support ticket to be created. It stays selected because ticket creation
 * swallows its own failures, and an order that drops out of this list with no ticket is a failed
 * order nobody is ever told about.
 */
export const AUTO_HEAL_ACTIVE_STATES = [...AUTO_HEAL_WORKING_STATES, "ticket_pending"] as const;
