import { useQuery } from "@tanstack/react-query";
import api from "../api";

/**
 * A task's discussion messages. Keyed by task ID alone, so refreshing the task
 * list does not refetch the open thread.
 */
const useTaskMessages = (taskID?: string) => {
  const query = useQuery<any[]>({
    queryKey: ["project-task-messages", taskID],
    queryFn: async () => {
      const res = await api.getTaskMessages(taskID!);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      return Array.isArray(res.data.messages) ? res.data.messages : [];
    },
    enabled: !!taskID,
    refetchOnWindowFocus: false,
    meta: {
      errorMessage: "Failed to load task messages.",
    },
  });

  return {
    messages: query.data ?? [],
    isFetched: query.isFetched,
    refetch: query.refetch,
  };
};

export default useTaskMessages;
