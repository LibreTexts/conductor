import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AssignableUser } from "../types";
import api from "../api";

export type { AssignableUser };

/**
 * Shared access to the support staff roster. The roster is small and near-static,
 * so it is cached aggressively — every surface that offers assignment (ticket
 * picker, bulk change, queue auto-assignment) reads the same cache entry instead
 * of issuing its own request.
 */
const useAssignableUsers = ({ enabled = true }: { enabled?: boolean } = {}) => {
    const QUERY_KEY = ['assignableUsers'];
    const queryClient = useQueryClient();

    const queryObj = useQuery<AssignableUser[]>({
        queryKey: QUERY_KEY,
        queryFn: async () => {
            const res = await api.getSupportAssignableUsers();
            if (res.data.err) {
                throw new Error(res.data.errMsg);
            }
            return res.data.users;
        },
        enabled,
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 30 * 60 * 1000, // survives navigation between the dashboard and a ticket
        refetchOnWindowFocus: false,
        meta: {
            errorMessage: "Failed to fetch assignable users.",
        }
    })

    const invalidate = () => {
        return queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    }

    return { ...queryObj, QUERY_KEY, invalidate };
}

export default useAssignableUsers
