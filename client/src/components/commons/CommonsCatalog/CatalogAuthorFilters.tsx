import {
  AuthorFilters,
  AuthorFiltersAction,
  GenericKeyTextValueObj,
} from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";
import CatalogFilterDropdown from "./CatalogFilterDropdown";
import { useQuery } from "@tanstack/react-query";

type AuthorFilterData = {
  orgOptions: GenericKeyTextValueObj<string>[];
};

interface CatalogAuthorFilters {
  filters: AuthorFilters;
  onFilterChange: (type: AuthorFiltersAction["type"], payload: string) => void;
}

const CatalogAuthorFilters: React.FC<CatalogAuthorFilters> = ({
  filters,
  onFilterChange,
}) => {
  const { handleGlobalError } = useGlobalError();
  const { data, isFetching: loading } = useQuery<AuthorFilterData>({
    queryKey: ["authorFilterOptions"],
    queryFn: getFilterOptions,
    refetchOnWindowFocus: true,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });

  async function getFilterOptions() {
    try {
      const allFilters: AuthorFilterData = {
        orgOptions: [],
      };

      const res = await api.getAuthorFilterOptions();
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data) {
        throw new Error("Invalid response from server.");
      }

      if (res.data.primaryInstitutions) {
        allFilters.orgOptions = res.data.primaryInstitutions.map(
          (org: string) => {
            return {
              value: org,
              key: crypto.randomUUID(),
              text: org,
            };
          }
        );
      }

      return allFilters;
    } catch (err) {
      handleGlobalError(err);
      return {
        orgOptions: [],
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
          text={`Primary Institution ${
            filters.primaryInstitution ? ` - ${filters.primaryInstitution}` : ""
          }`}
          icon="university"
          options={data?.orgOptions ?? []}
          filterKey="primaryInstitution"
          onFilterSelect={(key, val) =>
            onFilterChange(key as keyof AuthorFilters, val)
          }
        />
      </div>
    </div>
  );
};

export default CatalogAuthorFilters;
