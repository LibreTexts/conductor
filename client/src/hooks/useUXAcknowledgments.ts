import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api";
import { UXAcknowledgmentMap, UXAcknowledgmentStatus } from "../types";

export const UX_ACKNOWLEDGMENTS_QUERY_KEY = ["ux-acknowledgments"] as const;

type RecordVars = {
  key: string;
  status?: UXAcknowledgmentStatus;
  data?: Record<string, unknown>;
};

/**
 * Fetches the current user's full UX acknowledgment map once and caches it, so
 * any number of banners/dialogs across the app read from a single request.
 * Prefer the per-key `useUXAcknowledgment` hook in consumers; use this directly
 * only when you need the whole map or the raw `record` mutation.
 *
 * This is a "nicety" feature: it must never break core UI. A failed fetch
 * resolves to an empty map (treated as "nothing acknowledged") and no error
 * toast is surfaced; callers should handle record promise rejections (or use `useUXAcknowledgment`).
 */
const useUXAcknowledgments = () => {
  const queryClient = useQueryClient();

  const query = useQuery<UXAcknowledgmentMap>({
    queryKey: UX_ACKNOWLEDGMENTS_QUERY_KEY,
    queryFn: async () => {
      try {
        const res = await api.getUserUXAcknowledgments();
        if (res.data.err) throw new Error(res.data.errMsg);
        return res.data.acknowledgments ?? {};
      } catch (err) {
        console.error(err); // nicety: fail silently, never break core UI
        return {};
      }
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    // Intentionally no `meta.errorMessage`: this feature must not raise a toast.
  });

  const mutation = useMutation({
    mutationFn: async (vars: RecordVars) => {
      const res = await api.recordUserUXAcknowledgment(vars.key, {
        status: vars.status,
        data: vars.data,
      });
      if (res.data.err) throw new Error(res.data.errMsg);
      return res.data;
    },
    onMutate: async (vars) => {
      // Prevent any in-flight refetch from clobbering the optimistic write.
      await queryClient.cancelQueries({ queryKey: UX_ACKNOWLEDGMENTS_QUERY_KEY });
      const previous = queryClient.getQueryData<UXAcknowledgmentMap>(
        UX_ACKNOWLEDGMENTS_QUERY_KEY,
      );
      const now = new Date().toISOString();
      const existing = previous?.[vars.key];
      const status = vars.status ?? "seen";
      queryClient.setQueryData<UXAcknowledgmentMap>(UX_ACKNOWLEDGMENTS_QUERY_KEY, {
        ...(previous ?? {}),
        [vars.key]: {
          status,
          firstSeenAt: existing?.firstSeenAt ?? now,
          lastSeenAt: now,
          dismissedAt: status === "dismissed" ? now : existing?.dismissedAt,
          completedAt: status === "completed" ? now : existing?.completedAt,
          viewCount: (existing?.viewCount ?? 0) + 1,
          dismissCount:
            (existing?.dismissCount ?? 0) + (status === "dismissed" ? 1 : 0),
          data: vars.data ?? existing?.data,
        },
      });
      return { previous, status };
    },
    onSuccess: () => {
      // Reconcile the optimistic entry with the authoritative server record.
      queryClient.invalidateQueries({ queryKey: UX_ACKNOWLEDGMENTS_QUERY_KEY });
    },
    onError: (err, _vars, ctx) => {
      console.error(err);
      // Only roll back a plain "seen" increment. Rolling back a
      // dismiss/complete (or refetching from the server, which didn't persist)
      // would re-show a prompt the user just closed, so we keep the optimistic
      // state for those even when the server call failed.
      if (ctx?.status === "seen" && ctx.previous) {
        queryClient.setQueryData(UX_ACKNOWLEDGMENTS_QUERY_KEY, ctx.previous);
      }
    },
  });

  return {
    acknowledgments: query.data ?? {},
    // `ready` gates rendering to avoid flash-of-banner: true once the first
    // fetch has settled (success OR silent failure).
    ready: !query.isLoading && query.isFetched,
    isLoading: query.isLoading,
    record: mutation.mutateAsync,
    recording: mutation.isPending,
    queryKey: UX_ACKNOWLEDGMENTS_QUERY_KEY,
  };
};

export default useUXAcknowledgments;
