import { useQuery } from "@tanstack/react-query";
import { ClientConfig } from "../types";
import api from "../api";

const useClientConfig = () => {
    const { data, isFetching } = useQuery<ClientConfig | null>({
        queryKey: ["client-config"],
        queryFn: async () => {
            try {
                const res = await api.getClientConfig();
                if (!res.data) throw new Error("No data returned from the server.");
                return res.data?.data ?? null;
            } catch (error) {
                console.error(error); // fail silently
                return null;
            }
        },
        staleTime: 1000 * 60 * 3, // 3 minutes
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    return { clientConfig: data, loading: isFetching };
};

export default useClientConfig;
