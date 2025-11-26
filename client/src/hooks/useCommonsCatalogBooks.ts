import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api";

export type UseCommonsCatalogBooksParams = {
  limit?: number;
  enabled?: boolean;
};

const useCommonsCatalogBooks = ({
  limit = 10000,
  enabled = true,
}: UseCommonsCatalogBooksParams) => {
  const queryClient = useQueryClient();
  const useCommonsCatalogQueryKey = ["commonsCatalogBooks"];

  const queryData = useQuery({
    queryKey: useCommonsCatalogQueryKey,
    queryFn: async () => {
      const res = await api.getCommonsCatalog({ limit });
      return res.data.books;
    },
    staleTime: Infinity, // Don't refetch unless manually invalidated
    refetchOnWindowFocus: false,
    enabled: enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: useCommonsCatalogQueryKey });

  return {
    useCommonsCatalogQueryKey,
    invalidate,
    ...queryData,
  };
};

export default useCommonsCatalogBooks;
