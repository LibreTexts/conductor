import { useEffect, useRef, useState } from "react";

/**
 * Longest run `createdAt` is believed for.
 *
 * While a resubmit is in flight the drawer still holds the *previous* job,
 * whose `createdAt` can be weeks old. Counting from it would claim a book had
 * been compiling for 300 hours.
 */
const MAX_PLAUSIBLE_RUN_MS = 24 * 60 * 60 * 1000;

interface UseCompileElapsedOptions {
  /** `job.createdAt`. Used when it yields a plausible duration. */
  startedAt?: string;
  /** Whether a compile is actually running. The counter is null when it is not. */
  running: boolean;
  /** Job identity, so a resubmit restarts the count rather than continuing it. */
  jobID?: string;
}

/**
 * Milliseconds a compile has been running, re-read once a second.
 *
 * Prefers the job's own start time so closing and reopening the drawer does not
 * restart the count. Falls back to when this session first saw the job running
 * when that timestamp is missing, unparseable, in the future, or older than a
 * day — Shapeshift's `createdAt` is passed through to the client verbatim, and a
 * counter that silently disappears is worse than one that undercounts the
 * minutes before the drawer was opened.
 *
 * Null only when nothing is running.
 */
export const useCompileElapsed = ({
  startedAt,
  running,
  jobID,
}: UseCompileElapsedOptions): number | null => {
  const [now, setNow] = useState(() => Date.now());

  // Gated on `running`: the status bar stays mounted for every status and holds
  // the last job's timestamp, so an ungated interval would tick once a second
  // for as long as the drawer is open, for nothing.
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  // When this session first saw *this* job running. Written during render
  // rather than in an effect so the first paint already has an anchor.
  const anchor = useRef<{ key: string; at: number } | null>(null);
  const key = jobID ?? startedAt ?? "current";
  if (!running) {
    anchor.current = null;
  } else if (anchor.current?.key !== key) {
    anchor.current = { key, at: Date.now() };
  }

  if (!running) return null;

  const started = startedAt ? new Date(startedAt).valueOf() : Number.NaN;
  const fromJob = Number.isNaN(started) ? null : now - started;
  if (fromJob !== null && fromJob >= 0 && fromJob <= MAX_PLAUSIBLE_RUN_MS) {
    return fromJob;
  }

  return Math.max(0, now - (anchor.current?.at ?? now));
};

/** `4m 12s`, `1h 3m 7s`. Leading zero units are dropped. */
export const formatElapsed = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (hours > 0 || minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
};

/** The elapsed fact as it is printed, or null when nothing is running. */
export const useElapsedLabel = (
  options: UseCompileElapsedOptions,
): string | null => {
  const elapsed = useCompileElapsed(options);
  return elapsed === null ? null : `running ${formatElapsed(elapsed)}`;
};
