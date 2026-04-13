import CatalogFilterDropdown from "./CatalogFilterDropdown";
import { ProjectFilters, ProjectFiltersAction } from "../../../types";
import { Stack } from "@libretexts/davis-react";
import { upperFirst } from "../../../utils/misc";
import useProjectFilterOptions from "../../../hooks/useProjectFilterOptions";

interface CatalogProjectFiltersProps {
  filters: Record<string, string>;
  onFilterChange: (type: ProjectFiltersAction["type"], payload: string) => void;
}

const CatalogProjectFilters: React.FC<CatalogProjectFiltersProps> = ({
  filters,
  onFilterChange,
}) => {
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

export default CatalogProjectFilters;
