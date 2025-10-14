import { useQuery } from "@tanstack/react-query";
import { SupportQueueMetrics } from "../types";
import api from "../api";

const useSupportQueueMetrics = ({
  slug,
  enabled = true,
}: {
  slug: string;
  enabled?: boolean;
}) => {
  const queryObj = useQuery<SupportQueueMetrics>({
    queryKey: ["supportQueue", "metrics", slug],
    queryFn: async () => {
      if (!slug) {
        throw new Error("No queue slug provided");
      }

      const res = await api.getSupportQueueMetrics(slug);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      return res.data.metrics;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    enabled: !!slug && enabled, // Only run the query if slug is provided
  });

  return queryObj;
};

export default useSupportQueueMetrics;
