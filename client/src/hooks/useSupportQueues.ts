import { useQuery, useQueryClient } from "@tanstack/react-query"
import { SupportQueue } from "../types"
import api from "../api"
import { useCallback } from "react"

const useSupportQueues = ({ withCount }: { withCount: boolean }) => {
    const QUERY_KEY = ['supportQueues', { withCount }];
    const queryClient = useQueryClient();

    const queryObj = useQuery<SupportQueue[]>({
        queryKey: QUERY_KEY,
        queryFn: async () => {
            const res = await api.getSupportQueues({ withCount })
            if (res.data.err) {
                throw new Error(res.data.errMsg)
            }
            return res.data.queues;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
        meta: {
            errorMessage: "Failed to fetch support queues.",
        }
    })

    const isValidQueue = useCallback((slug: string): boolean => {
        return queryObj.data?.some((queue) => queue.slug === slug) ?? false;
    }, [queryObj.data]);

    const getQueueIDBySlug = useCallback((slug: string): string | null => {
        const queue = queryObj.data?.find((queue) => queue.slug === slug);
        return queue ? queue.id : null;
    }, [queryObj.data]);

    const invalidate = () => {
        return queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    }

    return { ...queryObj, isValidQueue, getQueueIDBySlug, QUERY_KEY, invalidate };
}

export default useSupportQueues