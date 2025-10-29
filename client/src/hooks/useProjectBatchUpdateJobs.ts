import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Project, ProjectBookBatchUpdateJob, ProjectClassification } from "../types"
import api from "../api";
import useGlobalError from "../components/error/ErrorHooks";
import { useEffect, useMemo } from "react";

const useProjectBatchUpdateJobs = (id: string) => {
    const { handleGlobalError } = useGlobalError();
    const queryClient = useQueryClient();

    // Uses the same base key as useProject so invalidations to the entire project
    // will also refresh the batch update jobs data.
    const useProjectBatchUpdateJobsQueryKey = ['project', id, 'batch-update-jobs'];

    const { data, error, isLoading, isError } = useQuery<ProjectBookBatchUpdateJob[]>({
        queryKey: useProjectBatchUpdateJobsQueryKey,
        queryFn: async () => {
            const res = await api.getProjectBatchUpdateJobs(id);
            return res.data.batch_update_jobs || undefined;
        },
        enabled: !!id,
        refetchOnWindowFocus: false
    })

    useEffect(() => {
        if (isError) {
            handleGlobalError(new Error(`Failed to load batch update jobs: ${(error as any)?.message || "Unknown error"}`));
        }
    }, [isError, error])

    const activeBatchJob = useMemo(() => {
        if (!data || data.length === 0) {
            return null;
        }

        const active = data.find((job) =>
            ["pending", "running"].includes(job.status)
        );

        return active || null;
    }, [data]);

    const refreshActiveJobStatusMutation = useMutation({
        mutationFn: async () => {
            queryClient.invalidateQueries({ queryKey: useProjectBatchUpdateJobsQueryKey });
            queryClient.invalidateQueries({ queryKey: ["textbook-structure-detailed", id] });
        },
        onError: (error) => {
            handleGlobalError(error);
        },
    });

    return {
        batchUpdateJobs: data,
        error,
        isLoading,
        isError,
        useProjectBatchUpdateJobsQueryKey,
        activeBatchJob,
        mutations: {
            refreshActiveJobStatus: refreshActiveJobStatusMutation
        }
    }
};

export default useProjectBatchUpdateJobs;