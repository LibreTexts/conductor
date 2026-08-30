import type { BadgeVariant } from "@libretexts/davis-react";
import { StoreOrderAutoHealState } from "../../../../types";

/**
 * How an order's automatic recovery attempt is described to an operator.
 *
 * Shared by the order table and the order detail view so both call the same attempt the same
 * thing. The underlying states are internal ("superseded", "resubmitting"), and nothing about
 * them tells an admin which ones opened a support ticket and which ones deliberately did not.
 */

/**
 * What the admin views say about an order Conductor is trying to recover on its own.
 *
 * A failed order with no support ticket looks abandoned without this: the ticket is deliberately
 * held back while the recompile-and-resubmit attempt runs, so the row has to explain itself.
 * Returns `null` for an order that never had an attempt, which leaves the row unchanged.
 */
export function autoHealLabel(state?: StoreOrderAutoHealState): string | null {
  switch (state) {
    case "queued":
    case "compiling":
      return "Recompiling";
    case "resubmitting":
    case "resubmitted":
      return "Resubmitted";
    case "ticket_pending":
      return "Opening support ticket";
    case "succeeded":
      return "Auto-recovered";
    case "abandoned":
      return "Auto-recovery failed";
    case "superseded":
      return "Auto-recovery stopped";
    default:
      return null;
  }
}

export function autoHealVariant(state?: StoreOrderAutoHealState): BadgeVariant {
  if (state === "succeeded") return "success";
  if (state === "abandoned") return "danger";
  if (state === "superseded") return "default";
  if (state === "ticket_pending") return "danger";
  return "warning";
}
