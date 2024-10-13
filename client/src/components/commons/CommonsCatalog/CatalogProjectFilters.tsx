import api from "../../../api";
import CatalogFilterDropdown from "./CatalogFilterDropdown";
import { GenericKeyTextValueObj, ProjectFilters, ProjectFiltersAction} from "../../../types";
import { upperFirst } from "../../../utils/misc";
import useGlobalError from "../../error/ErrorHooks";
import { useQuery } from "@tanstack/react-query";

type ProjectFilterData = {
  statusOptions: GenericKeyTextValueObj<string>[];
};

interface CatalogProjectFiltersProps {
  filters: Record<string, string>;
  onFilterChange: (type: ProjectFiltersAction["type"], payload: string) => void;
}

const CatalogProjectFilters: React.FC<CatalogProjectFiltersProps> = ({
  filters,
  onFilterChange,
}) => {
  const { handleGlobalError } = useGlobalError();
  const { data, isFetching: loading } = useQuery<ProjectFilterData>({
    queryKey: ["projectFilterOptions"],
    queryFn: getFilterOptions,
    refetchOnWindowFocus: true,
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
        }))
      }

      return allFilters;
    } catch (err) {
      handleGlobalError(err);
      return {
        statusOptions: [],
      };
    }
  }

  return (
    <div
      aria-busy={loading}
      className="flex flex-row w-full justify-between items-center ml-1"
    >
      <div className="flex flex-row my-4 flex-wrap items-center gap-2">
        <CatalogFilterDropdown
          text={`Status ${filters.status ? ` - ${upperFirst(filters.status)}` : ""}`}
          icon="dashboard"
          options={data?.statusOptions ?? []}
          filterKey="status"
          onFilterSelect={(key, val) =>
            onFilterChange(key as keyof ProjectFilters, val)
          }
        />
      </div>
    </div>
  );
};

export default CatalogProjectFilters;
