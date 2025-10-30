import { useQuery } from "@tanstack/react-query"
import { ConductorBaseResponse, GenericKeyTextValueObj } from "../types"
import axios from "axios"

export type SupportTicketFiltersResponse = {
    filters: {
        assignee?: GenericKeyTextValueObj<string>[];
        priority: GenericKeyTextValueObj<string>[];
        category: GenericKeyTextValueObj<string>[];
        status: GenericKeyTextValueObj<string>[];
    }
} & ConductorBaseResponse

const useSupportTicketFilters = () => {
    const queryObj = useQuery<SupportTicketFiltersResponse>({
        queryKey: ['supportTicketFilters'],
        queryFn: async () => {
            const res = await axios.get<SupportTicketFiltersResponse>("/support/ticket/filters");
            if (res.data.err) {
                throw new Error(res.data.errMsg)
            }
            return res.data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
        meta: {
            errorMessage: "Failed to fetch ticket filters.",
        }
    })

    return queryObj
}

export default useSupportTicketFilters;