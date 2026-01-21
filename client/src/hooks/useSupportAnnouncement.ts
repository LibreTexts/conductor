import { useQuery } from "@tanstack/react-query";
import { Announcement } from "../types";
import api from "../api";

const useSupportAnnouncement = () => {
  const { data, isFetching } = useQuery<Announcement | null>({
    queryKey: ["support-announcement"],
    queryFn: async () => {
      try {
        const res = await api.getSupportAnnouncement();
        if (!res.data) throw new Error("No data returned from the server.");
        return res.data?.announcement ?? null;
      } catch (error) {
        console.error(error); // fail silently
        return null;
      }
    },
    staleTime: 1000 * 60 * 3, // 3 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  return { supportAnnouncement: data, loading: isFetching };
};

export default useSupportAnnouncement;