import CatalogFilterDropdown from "./CatalogFilterDropdown";
import { MiniRepoFiltersAction, ProjectFilters } from "../../../types";
import { Stack } from "@libretexts/davis-react";
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
    <div aria-busy={isLoading} className="w-full ml-1">
      <Stack direction="horizontal" gap="sm" wrap={true} className="my-4">
        <CatalogFilterDropdown
          text={`Status ${
            filters.status ? ` - ${upperFirst(filters.status)}` : ""
          }`}
          icon="status"
          options={data?.statusOptions ?? []}
          filterKey="status"
          onFilterSelect={(key, val) =>
            onFilterChange(key as keyof ProjectFilters, val)
          }
        />
      </Stack>
    </div>
  );
};

export default CatalogMiniRepoFilters;
