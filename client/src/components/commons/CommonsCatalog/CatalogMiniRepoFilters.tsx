import CatalogFilterDropdown from "./CatalogFilterDropdown";
import { MiniRepoFiltersAction, ProjectFilters } from "../../../types";
import { upperFirst } from "../../../utils/misc";
import useProjectFilterOptions from "../../../hooks/useProjectFilterOptions";

interface CatalogMiniRepoFiltersProps {
  filters: Record<string, string>;
  onFilterChange: (
    type: MiniRepoFiltersAction["type"],
    payload: string
  ) => void;
}

const CatalogMiniRepoFilters: React.FC<CatalogMiniRepoFiltersProps> = ({
  filters,
  onFilterChange,
}) => {
  // Mini repos use same filter options as projects
  const { data, isLoading } = useProjectFilterOptions();

  return (
    <div
      aria-busy={isLoading}
      className="flex flex-row w-full justify-between items-center ml-1"
    >
      <div className="flex flex-row my-4 flex-wrap items-center gap-2">
        <CatalogFilterDropdown
          text={`Status ${
            filters.status ? ` - ${upperFirst(filters.status)}` : ""
          }`}
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

export default CatalogMiniRepoFilters;
