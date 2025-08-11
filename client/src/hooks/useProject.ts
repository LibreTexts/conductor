import { useQuery } from "@tanstack/react-query"
import { Project, ProjectClassification } from "../types"
import api from "../api";
import useGlobalError from "../components/error/ErrorHooks";
import { useEffect, useMemo } from "react";

const useProject = (id: string) => {
    const { handleGlobalError } = useGlobalError();
    const { data, error, isLoading, isError } = useQuery<Project>({
        queryKey: ['project', id],
        queryFn: async () => {
            const res = await api.getProject(id);
            return res.data.project || undefined;
        },
        enabled: !!id
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

    return { project: data, error, isLoading, isError, isMiniRepo }
}

export default useProject;