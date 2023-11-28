import { useInView } from "react-cool-inview";

interface useInfiniteScrollOptions {
  rootMargin?: string;
  loading?: boolean;
  threshold?: number;
  preventUnobserve?: boolean;
}

const useInfiniteScroll = (
  callback: () => void,
  options?: useInfiniteScrollOptions
) => {
  const { observe } = useInView({
    rootMargin: options?.rootMargin || "0px 0px 100px 0px",
    threshold: options?.threshold || 0.5,
    onEnter: ({ unobserve }) => {
      if (options?.loading) return; // Prevent multiple requests
      callback();
      if (!options?.preventUnobserve) unobserve();
    },
  });

  return {
    observe,
  };
};

export default useInfiniteScroll;
