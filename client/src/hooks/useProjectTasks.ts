import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../api";
import { ProjectTask } from "../types";
import { NormalizedProjectTasks, normalizeProjectTasks } from "../utils/projectTaskHelpers";

export const projectTasksQueryKey = (projectID: string) => ["project-tasks", projectID];

const EMPTY: NormalizedProjectTasks = { tasks: [], allTasks: [], byID: new Map() };

// Module-scoped so React Query memoizes the result between renders.
const selectNormalized = (raw: ProjectTask[]) => normalizeProjectTasks(raw);

/**
 * A project's tasks, normalized for display. Every consumer (the task list, the
 * task detail modal, the action modals) reads the same cache entry, so a mutation
 * that invalidates it updates all of them at once.
 */
const useProjectTasks = (projectID: string, { enabled = true }: { enabled?: boolean } = {}) => {
  const query = useQuery<ProjectTask[], unknown, NormalizedProjectTasks>({
    queryKey: projectTasksQueryKey(projectID),
    queryFn: async () => {
      const res = await api.getProjectTasks(projectID);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      return Array.isArray(res.data.tasks) ? res.data.tasks : [];
    },
    select: selectNormalized,
    enabled: enabled && !!projectID,
    refetchOnWindowFocus: false,
    meta: {
      errorMessage: "Failed to load project tasks.",
    },
  });

  const data = query.data ?? EMPTY;

  const getTaskTitle = useCallback(
    (taskID?: string) => (taskID ? data.byID.get(taskID)?.title ?? "Unknown" : ""),
    [data]
  );

  return {
    ...data,
    getTaskTitle,
    isLoading: query.isInitialLoading,
    isFetched: query.isFetched,
  };
};

export default useProjectTasks;
