import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MasterCatalogV2Response } from "../types";
import api from "../api";

export const MASTER_CATALOG_V2_QUERY_KEY = ["masterCatalogBooks"] as const;

const useMasterCatalogV2 = () => {
  const queryClient = useQueryClient();

  const queryData = useQuery<MasterCatalogV2Response>({
    queryKey: MASTER_CATALOG_V2_QUERY_KEY,
    queryFn: async () => {
      const res = await api.getMasterCatalogV2();
      return res.data;
    },
    staleTime: Infinity, // Don't refetch unless manually invalidated
    refetchOnWindowFocus: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: MASTER_CATALOG_V2_QUERY_KEY });
  };

  return {
    invalidate,
    ...queryData,
  };
};

export default useMasterCatalogV2;
