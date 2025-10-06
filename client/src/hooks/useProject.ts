import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Project, ProjectClassification } from "../types"
import api from "../api";
import useGlobalError from "../components/error/ErrorHooks";
import { useEffect, useMemo } from "react";

const useProject = (id: string) => {
    const { handleGlobalError } = useGlobalError();
    const queryClient = useQueryClient();

    const useProjectQueryKey = ['project', id];

    const { data, error, isLoading, isError } = useQuery<Project>({
        queryKey: useProjectQueryKey,
        queryFn: async () => {
            const res = await api.getProject(id);
            return res.data.project || undefined;
        },
        enabled: !!id,
        refetchOnWindowFocus: false
    })

    useEffect(() => {
        if (isError) {
            handleGlobalError(new Error(`Failed to load project data: ${(error as any)?.message || "Unknown error"}`));
        }
    }, [isError, error])

    const isMiniRepo = useMemo(() => {
        if (!data || !data.classification) return false;
        return data.classification === ProjectClassification.MINI_REPO;
    }, [data])

    const bookID = useMemo(() => {
        if (!data?.libreLibrary || !data?.libreCoverID) return null;
        return `${data.libreLibrary}-${data.libreCoverID}`;
    }, [data?.libreLibrary, data?.libreCoverID])

    const activeBatchJob = useMemo(() => {
        if (!data || !data.batchUpdateJobs) {
            return null;
        }

        const active = data.batchUpdateJobs.find((job) =>
            ["pending", "running"].includes(job.status)
        );

        return active || null;
    }, [data]);

    const refreshActiveJobStatusMutation = useMutation({
        mutationFn: async () => {
            queryClient.invalidateQueries(useProjectQueryKey);
            queryClient.invalidateQueries(["textbook-structure-detailed", id]);
        },
        onError: (error) => {
            handleGlobalError(error);
        },
    });

    return {
        project: data,
        error,
        isLoading,
        isError,
        isMiniRepo,
        useProjectQueryKey,
        bookID,
        activeBatchJob,
        mutations: {
            refreshActiveJobStatus: refreshActiveJobStatusMutation
        }
    }
};

export default useProject;