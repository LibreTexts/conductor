import { useQuery } from "@tanstack/react-query";
import { ClientConfig } from "../types";
import api from "../api";
import { useMemo } from "react";

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
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    const isProduction = useMemo(() => {
        // Default to true if data is not available to avoid flashing incorrect state
        if (!data || !data.env || isFetching) return true;
        return data.env === "production";
    }, [data, isFetching]);

    return { clientConfig: data, loading: isFetching, isProduction };
};

export default useClientConfig;
