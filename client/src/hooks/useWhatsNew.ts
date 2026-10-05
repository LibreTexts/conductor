import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api";
import useUXAcknowledgment from "./useUXAcknowledgment";
import { UX_ACKNOWLEDGMENT_KEYS } from "../utils/uxAcknowledgmentKeys";
import { WhatsNewEntry, WhatsNewWatermark } from "../types";

export const WHATS_NEW_QUERY_KEY = ["whats-new-active"] as const;

/**
 * Per-tab cap so a user who navigates around Conductor in one session sees the
 * modal once, not on every mount. This is a per-viewer convenience only — the
 * durable record is the DB watermark, so a cleared or unavailable
 * sessionStorage costs nothing more than one extra impression.
 */
const SESSION_FLAG = "conductor_whats_new_shown";

function sessionAlreadyShown(entryId: string): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_FLAG) === entryId;
  } catch {
    return false;
  }
}

function markSessionShown(entryId: string) {
  try {
    window.sessionStorage.setItem(SESSION_FLAG, entryId);
  } catch {
    /* private mode / blocked site data: the DB watermark still holds */
  }
}

/**
 * Decides whether the "What's New in Conductor" modal should be shown, and
 * records its dismissal.
 *
 * The acknowledgment system normally stores one permanent flag per prompt, which
 * would mean a new registry key (and a deploy) per release. Instead this uses a
 * single key whose `data` carries a WATERMARK: the id of the newest entry the
 * user dismissed. A newer entry therefore re-opens the modal while an already
 * dismissed one stays closed, with no code change per entry.
 *
 * `useUXAcknowledgment`'s own `shouldShow` is deliberately unused here: it treats
 * "dismissed" as terminal, which is right for a one-off banner and wrong for a
 * recurring notice.
 *
 * This is a nicety feature and must never break core UI. The fetch swallows its
 * errors and resolves to `null`, raises no toast, and `dismiss` never rejects.
 */
const useWhatsNew = () => {
  const {
    entry: ackEntry,
    ready: ackReady,
    acknowledge,
  } = useUXAcknowledgment(UX_ACKNOWLEDGMENT_KEYS.WHATS_NEW);

  const query = useQuery<WhatsNewEntry | null>({
    queryKey: WHATS_NEW_QUERY_KEY,
    queryFn: async () => {
      try {
        const res = await api.getActiveWhatsNew();
        if (res.data.err) throw new Error(res.data.errMsg);
        return res.data.entry ?? null;
      } catch (err) {
        console.error(err); // nicety: fail silently, never break core UI
        return null;
      }
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    // Intentionally no `meta.errorMessage`: this feature must not raise a toast.
  });

  const entry = query.data ?? null;

  const watermark = ackEntry?.data as WhatsNewWatermark | undefined;

  const shouldShow = useMemo(() => {
    // Decide only once both the entry and the acknowledgment map have settled,
    // so the modal never flashes before we know the user already dismissed it.
    if (!ackReady || query.isLoading || !query.isFetched) return false;
    if (!entry) return false;
    if (watermark?.lastEntryId === entry._id) return false;
    if (sessionAlreadyShown(entry._id)) return false;
    return true;
  }, [ackReady, query.isLoading, query.isFetched, entry, watermark]);

  const dismiss = useCallback(() => {
    if (!entry) return;
    markSessionShown(entry._id);
    // `acknowledge` already swallows its own rejection.
    acknowledge("dismissed", {
      lastEntryId: entry._id,
      lastPublishedAt: entry.publishedAt,
    } satisfies WhatsNewWatermark);
  }, [entry, acknowledge]);

  return { entry, shouldShow, dismiss };
};

export default useWhatsNew;
