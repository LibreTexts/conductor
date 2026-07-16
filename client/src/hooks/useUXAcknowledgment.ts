import { useMemo } from "react";
import useUXAcknowledgments from "./useUXAcknowledgments";
import { UXAcknowledgmentStatus } from "../types";

/**
 * Per-key convenience hook for the UX record-keeping system. Reads from the
 * shared acknowledgment cache (one request for the whole app) and returns the
 * derived state for a single acknowledgment id, plus a bound `acknowledge`.
 *
 * Usage (dismissible banner):
 *   const { shouldShow, acknowledge } = useUXAcknowledgment(UX_ACKNOWLEDGMENT_KEYS.SOME_BANNER);
 *   if (!shouldShow) return null;
 *   return <Banner onDismiss={() => acknowledge("dismissed")} />;
 *
 * Usage (welcome dialog):
 *   const { shouldShow, acknowledge } = useUXAcknowledgment(UX_ACKNOWLEDGMENT_KEYS.COAUTHOR_WELCOME);
 *   useEffect(() => { if (shouldShow) openDialog({ onClose: () => acknowledge("completed") }); }, [shouldShow]);
 *
 * `acknowledge` never rejects to the caller (nicety feature: must not break UI).
 */
const useUXAcknowledgment = (key: string) => {
  const { acknowledgments, ready, isLoading, record, recording } =
    useUXAcknowledgments();

  const entry = acknowledgments[key];

  const derived = useMemo(
    () => ({
      hasSeen: !!entry,
      isDismissed: entry?.status === "dismissed",
      isCompleted: entry?.status === "completed",
      status: entry?.status ?? null,
      entry: entry ?? null,
    }),
    [entry],
  );

  const acknowledge = (
    status: UXAcknowledgmentStatus = "seen",
    data?: Record<string, unknown>,
  ) => record({ key, status, data }).catch(() => {}); // never rejects to caller

  // Only decide once ready, so an un-acknowledged prompt doesn't flash before
  // the acknowledgment map has loaded.
  const shouldShow = ready && !derived.isDismissed && !derived.isCompleted;

  return {
    ...derived,
    ready,
    isLoading,
    acknowledge,
    recording,
    shouldShow,
  };
};

export default useUXAcknowledgment;
