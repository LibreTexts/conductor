import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api";

export type UseCommonsCatalogBooksParams = {
  limit?: number;
};

export const COMMONS_CATALOG_QUERY_KEY = ["commonsCatalogBooks"] as const;

const useCommonsCatalogBooks = ({
  limit = 10000,
}: UseCommonsCatalogBooksParams) => {
  const queryClient = useQueryClient();

  const queryData = useQuery({
    queryKey: COMMONS_CATALOG_QUERY_KEY,
    queryFn: async () => {
      const res = await api.getCommonsCatalog({ limit });
      return res.data.books;
    },
    staleTime: Infinity, // Don't refetch unless manually invalidated
    refetchOnWindowFocus: false,
    cacheTime: Infinity,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: COMMONS_CATALOG_QUERY_KEY });
  };

  return {
    invalidate,
    ...queryData,
  };
};

export default useCommonsCatalogBooks;
