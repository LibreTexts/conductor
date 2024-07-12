import { useQuery } from "@tanstack/react-query";
import { Announcement } from "../types";
import api from "../api";

const useSystemAnnouncement = () => {
  const { data, isFetching } = useQuery<Announcement | null>({
    queryKey: ["system-announcement"],
    queryFn: async () => {
      try {
        const res = await api.getSystemAnnouncement();
        if (!res.data) throw new Error("No data returned from the server.");
        return res.data?.sysAnnouncement ?? null;
      } catch (error) {
        console.error(error); // fail silently
        return null;
      }
    },
    staleTime: 1000 * 60 * 3, // 3 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  return { sysAnnouncement: data, loading: isFetching };
};

export default useSystemAnnouncement;
