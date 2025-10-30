import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ConductorBaseResponse, SupportTicket } from "../types"
import axios from "axios"
import { useMemo } from "react"

export type OpenSupportTicketsResponse = {
    tickets: SupportTicket[];
    total: number;
} & ConductorBaseResponse

type UseSupportTicketsParams = {
    query?: string;
    page?: number;
    items?: number;
    sort?: string;
    assigneeFilters?: string[];
    priorityFilters?: string[];
    categoryFilters?: string[];
    statusFilters?: string[];
    enabled?: boolean;
}

const useSupportTickets = (queue: string, params: UseSupportTicketsParams) => {
    const QUERY_KEY = ['supportTickets', queue, params];
    const queryClient = useQueryClient();

    const queryObj = useQuery<OpenSupportTicketsResponse>({
        queryKey: QUERY_KEY,
        queryFn: async () => {
            const res = await axios.get<OpenSupportTicketsResponse>("/support/ticket/open", {
                params: {
                    queue,
                    ...(params.query && params.query?.length > 3 && { query: params.query }),
                    page: params.page,
                    limit: params.items,
                    sort: params.sort,
                    ...(params.assigneeFilters && { assignee: params.assigneeFilters }),
                    ...(params.priorityFilters && { priority: params.priorityFilters }),
                    ...(params.categoryFilters && { category: params.categoryFilters }),
                    ...(params.statusFilters && { status: params.statusFilters }),
                },
            });
            if (res.data.err) {
                throw new Error(res.data.errMsg)
            }
            return res.data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: true,
        enabled: !!queue && params.enabled, // Only run the query if queue is provided
        meta: {
            errorMessage: "Failed to fetch tickets.",
        }
    })

    const totalPages = useMemo(() => {
        return Math.ceil((queryObj.data?.total || 0) / (params.items || 10))
    }, [queryObj.data?.total, params.items])

    const invalidate = () => {
        return queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    }

    return { ...queryObj, totalPages, invalidate, QUERY_KEY };
}

export default useSupportTickets;