import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import { useNotifications } from "../context/NotificationContext";
import useGlobalError from "../components/error/ErrorHooks";
import {
  PUBLISH_STEP_ORDER,
  type PublishStatus,
  type PublishStepKey,
  type PublishStepState,
} from "../types/Publish";

/**
 * How often publishing status is re-read while a step is running.
 *
 * Two of the four steps hand work to systems with no push channel back into
 * Conductor, so progress is polled. Matches the compile drawer's cadence.
 */
const POLL_INTERVAL_MS = 5000;

const IDLE_STEP: PublishStepState = { status: "not-started" };

const EMPTY_STEPS = PUBLISH_STEP_ORDER.reduce(
  (acc, key) => {
    acc[key] = IDLE_STEP;
    return acc;
  },
  {} as Record<PublishStepKey, PublishStepState>
);

/** Human-readable step names, used in success and failure notifications. */
const STEP_LABELS: Record<PublishStepKey, string> = {
  preprocess: "Editor preprocess",
  security: "Make book public",
  move: "Move book",
  visibility: "Set visibility",
  compile: "Compile book",
};

export interface UsePublishBookOptions {
  projectID?: string;
  /**
   * Set false to keep the hook idle. The drawer passes `false` while closed so
   * a project page never polls for a drawer nobody opened.
   */
  enabled?: boolean;
}

export interface UsePublishBookResult {
  status: PublishStatus | null;
  steps: Record<PublishStepKey, PublishStepState>;
  isPublished: boolean;
  isLoading: boolean;
  error: Error | null;
  /** True while the named step's request is in flight. */
  isSubmitting: (step: PublishStepKey) => boolean;
  runPreprocess: () => void;
  runSecurity: () => void;
  runMove: (to: string) => void;
  runVisibility: () => void;
  runCompile: () => void;
  refetch: () => void;
}

/**
 * Single entry point for a project's publishing flow: step state, polling, and
 * the four submissions.
 *
 * Lives here rather than in the drawer so the same rules apply anywhere else
 * that needs to read or advance publishing state.
 */
export default function usePublishBook({
  projectID,
  enabled = true,
}: UsePublishBookOptions): UsePublishBookResult {
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const { handleGlobalError } = useGlobalError();
  const active = !!projectID && enabled;

  const statusQuery = useQuery({
    queryKey: ["publish-status", projectID],
    queryFn: async () => {
      const res = await api.getPublishStatus(projectID as string);
      return res.status;
    },
    enabled: active,
    // react-query v4 hands the callback the data. Polling stops the moment no
    // step is still running, so a settled flow costs nothing.
    refetchInterval: (data) =>
      data && PUBLISH_STEP_ORDER.some((k) => data.steps[k]?.status === "running")
        ? POLL_INTERVAL_MS
        : false,
    refetchOnWindowFocus: false,
  });

  const status = statusQuery.data ?? null;
  const steps = status?.steps ?? EMPTY_STEPS;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["publish-status", projectID] });
  }, [queryClient, projectID]);

  /**
   * Refetching on settle rather than only on success is deliberate: a failed
   * step still wrote its failure to the project, and that record is what the
   * step row shows.
   */
  const stepMutationOptions = {
    onError: (err: unknown) => handleGlobalError(err),
    onSettled: () => invalidate(),
  };

  const preprocessMutation = useMutation({
    mutationFn: async () => api.submitPublishPreprocess(projectID as string),
    ...stepMutationOptions,
  });

  const securityMutation = useMutation({
    mutationFn: async () => api.setPublishBookSecurity(projectID as string),
    ...stepMutationOptions,
  });

  const moveMutation = useMutation({
    mutationFn: async (to: string) =>
      api.movePublishedBook(projectID as string, to),
    ...stepMutationOptions,
  });

  const visibilityMutation = useMutation({
    mutationFn: async () => api.setPublishVisibility(projectID as string),
    ...stepMutationOptions,
  });

  const compileMutation = useMutation({
    mutationFn: async () => api.submitPublishCompile(projectID as string),
    ...stepMutationOptions,
  });

  /**
   * Announce each step once, on its transition out of `running`.
   *
   * Keyed on the step's own status rather than on a mutation result, because
   * preprocess and compile finish long after their request returned — their
   * completion only ever arrives through a poll.
   */
  const previousStatuses = useRef<Partial<Record<PublishStepKey, string>>>({});
  useEffect(() => {
    for (const key of PUBLISH_STEP_ORDER) {
      const current = steps[key]?.status;
      const previous = previousStatuses.current[key];
      previousStatuses.current[key] = current;

      if (previous !== "running" || current === "running") continue;

      if (current === "succeeded") {
        addNotification({
          type: "success",
          message: `${STEP_LABELS[key]} finished.`,
        });
      } else if (current === "failed") {
        addNotification({
          type: "error",
          message:
            steps[key]?.errorMessage ?? `${STEP_LABELS[key]} failed.`,
        });
      }
    }
  }, [steps, addNotification]);

  const pendingByStep = useMemo(
    () =>
      ({
        preprocess: preprocessMutation.isPending,
        security: securityMutation.isPending,
        move: moveMutation.isPending,
        visibility: visibilityMutation.isPending,
        compile: compileMutation.isPending,
      }) as Record<PublishStepKey, boolean>,
    [
      preprocessMutation.isPending,
      securityMutation.isPending,
      moveMutation.isPending,
      visibilityMutation.isPending,
      compileMutation.isPending,
    ]
  );

  const isSubmitting = useCallback(
    (step: PublishStepKey) => pendingByStep[step],
    [pendingByStep]
  );

  const runPreprocess = useCallback(() => {
    if (!projectID) return;
    preprocessMutation.mutate();
  }, [projectID, preprocessMutation]);

  const runSecurity = useCallback(() => {
    if (!projectID) return;
    securityMutation.mutate();
  }, [projectID, securityMutation]);

  const runMove = useCallback(
    (to: string) => {
      if (!projectID || !to) return;
      moveMutation.mutate(to);
    },
    [projectID, moveMutation]
  );

  const runVisibility = useCallback(() => {
    if (!projectID) return;
    visibilityMutation.mutate();
  }, [projectID, visibilityMutation]);

  const runCompile = useCallback(() => {
    if (!projectID) return;
    compileMutation.mutate();
  }, [projectID, compileMutation]);

  return {
    status,
    steps,
    isPublished: status?.isPublished ?? false,
    isLoading: statusQuery.isLoading,
    error: (statusQuery.error as Error | null) ?? null,
    isSubmitting,
    runPreprocess,
    runSecurity,
    runMove,
    runVisibility,
    runCompile,
    refetch: invalidate,
  };
}
