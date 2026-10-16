import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TeamMemberLibraryAccess } from "../types";
import useGlobalError from "../components/error/ErrorHooks";
import api from "../api";
import { useEffect } from "react";


const useProjectTeamLibraryAccess = (projectID: string, libreLibrary: string | undefined) => {
    const { handleGlobalError } = useGlobalError();
    const queryClient = useQueryClient();

    const TEAM_LIBRARY_ACCESS_QUERY_KEY = ["teamLibraryAccess", projectID, libreLibrary];

    const { data, error, isLoading, isError, ...restQuery } = useQuery<TeamMemberLibraryAccess[] | null>(
        TEAM_LIBRARY_ACCESS_QUERY_KEY,
        async () => (await api.checkTeamLibraryAccess(projectID, libreLibrary)).data,
        {
            enabled: !!projectID && !!libreLibrary,
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30_000 // avoid hammering backend if switching between libraries quickly (e.g. CreateWorkbenchModal)
        }
    );

    useEffect(() => {
        if (isError) {
            handleGlobalError(new Error(`Failed to check team library access: ${(error as any)?.message || "Unknown error"}`));
        }
    }, [isError, error])

    const invalidate = () => queryClient.invalidateQueries({ queryKey: TEAM_LIBRARY_ACCESS_QUERY_KEY });

    return {
        access: data,
        error,
        isLoading,
        isError,
        ...restQuery,
        invalidate,
        queryKey: TEAM_LIBRARY_ACCESS_QUERY_KEY
    };
};

export default useProjectTeamLibraryAccess;