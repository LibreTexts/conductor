import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProjectDiscussionMessage, ProjectDiscussionThread } from "../../types";
import api from "../../api";
import useGlobalError from "../../components/error/ErrorHooks";
import { useNotifications } from "../../context/NotificationContext";

type UseProjectDiscussionThreadProps = {
  id: string; // Thread ID
};

const useProjectDiscussionThread = ({
  id,
}: UseProjectDiscussionThreadProps) => {
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  const { data, isFetching, refetch } = useQuery<ProjectDiscussionMessage[]>({
    queryKey: ["thread", id],
    queryFn: async () => {
      if (!id) return [];
      const res = await api.getThreadMessages(id);
      return res.data.messages || [];
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });

  const createMessage = useMutation({
    mutationFn: async (data: {message: string, notify: string, notifyUsers?: string[]}) => {
      if(!id) return;
      const res = await api.createThreadMessage(id, data);
      return res.data;
    },
    onSuccess: () => {
      addNotification({
        message: "Message sent successfully",
        type: "success",
      });
      queryClient.invalidateQueries(["thread", id]);
    },
    onError: (err: any) => {
      handleGlobalError(err);
    }
  })

  const deleteMessage = useMutation({
    mutationFn: async (messageID: string) => {
      if (!messageID) return;
      const res = await api.deleteThreadMessage(messageID);
      return res.data;
    },
    onSuccess: () => {
      addNotification({
        message: "Message deleted successfully",
        type: "success",
      });
      queryClient.invalidateQueries(["thread", id]);
    },
    onError: (err: any) => {
      handleGlobalError(err);
    },
  });

  return { messages: data, loading: isFetching, createMessage, deleteMessage, refetch };
};

export default useProjectDiscussionThread;
