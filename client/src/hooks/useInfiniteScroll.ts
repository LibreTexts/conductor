import { useCallback, useEffect, useRef } from "react";

interface InfiniteScrollProps {
  next: () => void | Promise<void>;
  hasMore: boolean;
  isLoading: boolean;
  threshold?: number;
}

const useInfiniteScroll = ({
  next,
  hasMore,
  isLoading,
  threshold = 0.8,
}: InfiniteScrollProps) => {
  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback(
    (node: any) => {
      if (isLoading || !node) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore) {
            next();
          }
        },
        { threshold }
      );
      if (node) {
        observer.current.observe(node);
      }
    },
    [isLoading, hasMore, next, threshold]
  );

  useEffect(() => {
    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, []);

  return { lastElementRef };
};

export default useInfiniteScroll;
