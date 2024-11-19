import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProjectDiscussionThread } from "../../types";
import api from "../../api";
import useGlobalError from "../../components/error/ErrorHooks";
import { useNotifications } from "../../context/NotificationContext";

type UseProjectDiscussionsProps = {
  id: string;
};

const useProjectDiscussions = ({ id }: UseProjectDiscussionsProps) => {
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  const { data, isFetching } = useQuery<ProjectDiscussionThread[]>({
    queryKey: ["project-discussions", id],
    queryFn: async () => {
      if (!id) return [];
      const res = await api.getDiscussionThreads(id);
      return res.data.threads || [];
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });

  const createThread = useMutation({
    mutationFn: async (data: { projectID: string; title: string }) => {
      const res = await api.createDiscussionThread(data.projectID, data.title);
      return res.data;
    },
    onSuccess: () => {
      addNotification({
        message: "Thread created successfully",
        type: "success",
      });
      queryClient.invalidateQueries(["project-discussions", id]);
    },
    onError: (err: any) => {
      handleGlobalError(err);
    },
  });

  const deleteThread = useMutation({
    mutationFn: async (data: { threadID: string }) => {
      const res = await api.deleteDiscussionThread(data.threadID);
      return res.data;
    },
    onSuccess: () => {
      addNotification({
        message: "Thread deleted successfully",
        type: "success",
      });
      queryClient.invalidateQueries(["project-discussions", id]);
    },
    onError: (err: any) => {
      handleGlobalError(err);
    },
  });

  return { threads: data, loading: isFetching, createThread, deleteThread };
};

export default useProjectDiscussions;
