import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import { useNotifications } from "../context/NotificationContext";
import type {
  BookExport,
  BookExportInfo,
  BookExportKey,
  ShapeshiftJob,
  ShapeshiftJobStatus,
} from "../types/Shapeshift";

/**
 * How often the job is re-read while it is still running.
 *
 * Shapeshift has no push channel for job progress, and a compile takes minutes,
 * so this is a compromise between a responsive status pill and pointless load.
 */
const POLL_INTERVAL_MS = 5000;

const RUNNING_STATUSES: ShapeshiftJobStatus[] = ["created", "inprogress"];

/**
 * How long a just-submitted compile is believed without server confirmation.
 *
 * The optimistic state exists to cover the gap before Shapeshift can answer for
 * a brand new job. It is not a substitute for the real thing, so it expires
 * rather than leaving the drawer claiming progress forever.
 */
const OPTIMISTIC_JOB_MAX_AGE_MS = 45 * 60 * 1000;

const isRunning = (status?: ShapeshiftJobStatus) =>
  !!status && RUNNING_STATUSES.includes(status);

/**
 * What the drawer renders, derived from the job and the book's stored
 * compilation history rather than read from any single field.
 */
export type CompileStatus =
  | "never-compiled"
  | "submitting"
  | "in-progress"
  | "finished"
  | "failed";

export interface UseShapeshiftOptions {
  bookID?: string;
  /**
   * Set false to keep the hook idle. The drawer passes `false` while closed so
   * a project page never polls for a drawer nobody opened.
   */
  enabled?: boolean;
}

export interface UseShapeshiftResult {
  job: ShapeshiftJob | null;
  exports: BookExport[];
  exportInfo: BookExportInfo | null;
  status: CompileStatus;
  availableKeys: BookExportKey[];
  totalSizeBytes: number;
  isCompiling: boolean;
  isLoading: boolean;
  isExportsLoading: boolean;
  error: Error | null;
  compile: () => void;
  downloadAllURL: string;
  refetchExports: () => void;
}

/**
 * Single entry point for Shapeshift compile state for one book: submission,
 * polling, and the export manifest.
 *
 * Lives here rather than inside the drawer so other Conductor surfaces can read
 * the same state without duplicating the polling rules.
 */
export default function useShapeshift({
  bookID,
  enabled = true,
}: UseShapeshiftOptions): UseShapeshiftResult {
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const active = !!bookID && enabled;

  /**
   * The compile this session started, held locally.
   *
   * The server can legitimately answer `job: null` for a job that is genuinely
   * running: the Book row may not exist yet to store the ID against, and
   * Shapeshift may not serve a job the instant it is created. Trusting the
   * response alone drops the drawer back to its never-compiled state moments
   * after a successful submit, so the submitted ID is the source of truth until
   * the server contradicts it.
   */
  const [pendingJob, setPendingJob] = useState<{
    id: string;
    submittedAt: number;
  } | null>(null);

  const jobQuery = useQuery({
    queryKey: ["shapeshift-job", bookID],
    queryFn: async () => {
      const res = await api.getBookCompileJob(bookID as string);
      return { job: res.job ?? null, exportInfo: res.exportInfo ?? null };
    },
    enabled: active,
    // react-query v4 hands the callback the data. `pendingJob` is read from the
    // enclosing render so a locally-known compile keeps the poll alive even
    // while the server still reports no job.
    refetchInterval: (data) =>
      isRunning(data?.job?.status) || pendingJob
        ? POLL_INTERVAL_MS
        : false,
    refetchOnWindowFocus: false,
  });

  const fetchedJob = jobQuery.data?.job ?? null;
  const exportInfo = jobQuery.data?.exportInfo ?? null;

  // The optimistic state is retired as soon as anything real supersedes it: the
  // job comes back terminal, a compile lands via the webhook, or it ages out.
  useEffect(() => {
    if (!pendingJob) return;
    const resolvedTerminal =
      fetchedJob?.id === pendingJob.id && !isRunning(fetchedJob?.status);
    const compiledSince =
      !!exportInfo?.lastCompiled &&
      exportInfo.lastCompiled >= pendingJob.submittedAt;
    const expired = Date.now() - pendingJob.submittedAt > OPTIMISTIC_JOB_MAX_AGE_MS;
    if (resolvedTerminal || compiledSince || expired) setPendingJob(null);
  }, [pendingJob, fetchedJob, exportInfo?.lastCompiled]);

  /**
   * What the UI treats as the current job. Falls back to a locally-constructed
   * record so the status bar can show the job ID and start time before
   * Shapeshift will serve them.
   */
  const job = useMemo<ShapeshiftJob | null>(() => {
    if (fetchedJob) return fetchedJob;
    if (!pendingJob) return null;
    return {
      id: pendingJob.id,
      status: "created",
      createdAt: new Date(pendingJob.submittedAt).toISOString(),
      isHighPriority: false,
      url: "",
    };
  }, [fetchedJob, pendingJob]);

  // Probing the downloads host is only worth doing once there could be
  // something there: a terminal job, or a book compiled at some earlier point.
  const exportsEnabled = active && (!isRunning(job?.status) || !!exportInfo?.lastCompiled);

  const exportsQuery = useQuery({
    queryKey: ["shapeshift-exports", bookID],
    queryFn: async () => {
      const res = await api.getBookExports(bookID as string);
      return res.exports ?? [];
    },
    enabled: exportsEnabled,
    refetchOnWindowFocus: false,
  });

  const exports = useMemo(() => exportsQuery.data ?? [], [exportsQuery.data]);

  const compileMutation = useMutation({
    mutationFn: async () => api.compileBook(bookID as string),
    onSuccess: (data) => {
      if (data?.jobId) {
        setPendingJob({ id: data.jobId, submittedAt: Date.now() });
      }
      queryClient.invalidateQueries({ queryKey: ["shapeshift-job", bookID] });
    },
    onError: () => {
      addNotification({
        type: "error",
        message: "Could not start the compile. Please try again.",
      });
    },
  });

  const status = useMemo<CompileStatus>(() => {
    if (compileMutation.isPending) return "submitting";
    if (isRunning(job?.status)) return "in-progress";
    if (job?.status === "failed") return "failed";
    if (job?.status === "finished" || exportInfo?.lastCompiled) return "finished";
    return "never-compiled";
  }, [compileMutation.isPending, job?.status, exportInfo?.lastCompiled]);

  // Announce the outcome once, on the transition out of a running state.
  //
  // Keyed on the derived status rather than the raw job, because a compile can
  // finish without the job ever coming back: the webhook writes `lastCompiled`
  // and the optimistic record retires, which leaves no job status to compare.
  const previousStatus = useRef<CompileStatus | undefined>(undefined);
  useEffect(() => {
    const previous = previousStatus.current;
    previousStatus.current = status;
    const wasRunning = previous === "in-progress" || previous === "submitting";
    if (!wasRunning) return;

    if (status === "finished") {
      queryClient.invalidateQueries({ queryKey: ["shapeshift-exports", bookID] });
      addNotification({
        type: "success",
        message: "Compile finished. Your exports are ready.",
      });
    } else if (status === "failed") {
      addNotification({
        type: "error",
        message: "The compile failed. You can try again from the drawer.",
      });
    }
  }, [status, bookID, queryClient, addNotification]);

  const availableKeys = useMemo(
    () => exports.filter((e) => e.available).map((e) => e.key),
    [exports],
  );

  const totalSizeBytes = useMemo(
    () => exports.reduce((sum, e) => sum + (e.sizeBytes ?? 0), 0),
    [exports],
  );

  const compile = useCallback(() => {
    if (!bookID) return;
    compileMutation.mutate();
  }, [bookID, compileMutation]);

  const refetchExports = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["shapeshift-exports", bookID] });
  }, [queryClient, bookID]);

  return {
    job,
    exports,
    exportInfo,
    status,
    availableKeys,
    totalSizeBytes,
    isCompiling: compileMutation.isPending,
    isLoading: jobQuery.isLoading,
    isExportsLoading: exportsQuery.isLoading,
    error: (jobQuery.error as Error | null) ?? null,
    compile,
    downloadAllURL: bookID ? api.buildBookExportsDownloadAllURL(bookID) : "",
    refetchExports,
  };
}
