import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MasterCatalogV2Response } from "../types";
import api from "../api";

export type UseMasterCatalogV2Params = {
  enabled?: boolean;
};

const useMasterCatalogV2 = ({ enabled = true }: UseMasterCatalogV2Params) => {
  const queryClient = useQueryClient();
  const useMasterCatalogV2QueryKey = ["masterCatalogBooks"];

  const queryData = useQuery<MasterCatalogV2Response>({
    queryKey: useMasterCatalogV2QueryKey,
    queryFn: async () => {
      const res = await api.getMasterCatalogV2();
      return res.data;
    },
    staleTime: Infinity, // Don't refetch unless manually invalidated
    refetchOnWindowFocus: false,
    enabled: enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: useMasterCatalogV2QueryKey });

  return {
    useMasterCatalogV2QueryKey,
    invalidate,
    ...queryData,
  };
};

export default useMasterCatalogV2;
