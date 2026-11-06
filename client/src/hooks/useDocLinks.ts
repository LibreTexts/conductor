import { useQuery } from "@tanstack/react-query";
import api from "../api";
import { buildInsightURL, DocLinks } from "../utils/docLinks";

/**
 * Full Insight URLs for in-app help links, keyed by doc key. One request per
 * session, shared by every caller. Help links are a nicety: on any failure this
 * resolves to an empty map (links hide) rather than erroring, which would also
 * trigger the global error toast.
 */
const useDocLinks = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const { data, isLoading } = useQuery<DocLinks>({
    queryKey: ["kb-doc-links"],
    queryFn: async () => {
      try {
        const res = await api.getKBDocLinks();
        const links: DocLinks = {};
        for (const [key, slug] of Object.entries(res.data?.links ?? {})) {
          if (slug) links[key as keyof DocLinks] = buildInsightURL(slug);
        }
        return links;
      } catch (error) {
        console.error(error); // fail silently
        return {};
      }
    },
    enabled,
    staleTime: 1000 * 60 * 30, // 30 minutes
    cacheTime: Infinity,
    refetchOnWindowFocus: false,
  });

  return { docLinks: data ?? {}, loading: isLoading };
};

export default useDocLinks;
