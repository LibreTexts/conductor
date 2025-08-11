import { useQuery } from "@tanstack/react-query";
import api from "../api";
import useGlobalError from "../components/error/ErrorHooks";
import { ProjectFilterData } from "../types";
import { upperFirst } from "../utils/misc";

const useProjectFilterOptions = () => {
    const { handleGlobalError } = useGlobalError();
    const { data, isLoading } = useQuery<ProjectFilterData>({
        queryKey: ["projectFilterOptions"],
        queryFn: getFilterOptions,
        refetchOnWindowFocus: false,
        staleTime: 6 * 60 * 60 * 1000, // 6 hours
    });


    async function getFilterOptions() {
        try {
            const allFilters: ProjectFilterData = {
                statusOptions: [],
            };

            const res = await api.getProjectFilterOptions();
            if (res.data.err) {
                throw new Error(res.data.errMsg);
            }
            if (!res.data) {
                throw new Error("Invalid response from server.");
            }

            if (res.data.statuses) {
                allFilters.statusOptions = res.data.statuses.map((status: string) => ({
                    value: status,
                    key: crypto.randomUUID(),
                    text: upperFirst(status),
                }));
            }

            return allFilters;
        } catch (err) {
            handleGlobalError(err);
            return {
                statusOptions: [],
            };
        }
    }

    return { data, isLoading };
};

export default useProjectFilterOptions;