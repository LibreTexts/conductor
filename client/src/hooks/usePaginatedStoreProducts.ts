import { useInfiniteQuery } from '@tanstack/react-query';
import { StoreProduct } from '../types';
import api from '../api';

interface UsePaginatedProductsOptions {
  itemsPerPage: number;
  searchQuery?: string;
  category?: string;
}

interface ProductPage {
  products: StoreProduct[];
  cursor?: string;
  hasMore: boolean;
}

export function usePaginatedStoreProducts({
  itemsPerPage,
  searchQuery,
  category
}: UsePaginatedProductsOptions) {
  const browseQuery = useInfiniteQuery<ProductPage>({
    queryKey: ["store-products-browse", category, itemsPerPage, searchQuery],
    queryFn: async ({ pageParam }) => {
      const products = await api.getStoreProducts({
        limit: itemsPerPage,
        category: category ? category === 'all' ? undefined : category : undefined,
        starting_after: pageParam,
        query: searchQuery || undefined
      });

      if (products.data.err) {
        throw new Error(products.data.errMsg);
      }

      return {
        products: products.data.products,
        cursor: products.data.meta.cursor,
        hasMore: products.data.meta.has_more
      };
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.cursor : undefined,
  });

  const allProducts = browseQuery.data?.pages.flatMap(page => page.products) || [];
  const lastPage = browseQuery.data?.pages[browseQuery.data.pages.length - 1];

  return {
    data: allProducts,
    isFetching: browseQuery.isFetching,
    hasMore: lastPage?.hasMore || false,
    loadMore: browseQuery.fetchNextPage,
  };
}