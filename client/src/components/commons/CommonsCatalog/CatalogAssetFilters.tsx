import { GenericKeyTextValueObj } from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";
import { getPrettyNameFromMimeType } from "../../../utils/common-mime-types";
import CatalogFilterDropdown from "./CatalogFilterDropdown";
import { CustomFilter } from "../../../types/Search";
import { useTypedSelector } from "../../../state/hooks";
import { useQuery } from "@tanstack/react-query";

type AssetFilterData = {
  licenseOptions: GenericKeyTextValueObj<string>[];
  orgOptions: GenericKeyTextValueObj<string>[];
  fileTypeOptions: GenericKeyTextValueObj<string>[];
  peopleOptions: GenericKeyTextValueObj<string>[];
  assetTagFilters: CustomFilter[];
};

interface CatalogAssetFiltersProps {
  filters: Record<string, string>;
  onFilterChange: (type: string, payload: string) => void;
}

const CatalogAssetFilters: React.FC<CatalogAssetFiltersProps> = ({
  filters,
  onFilterChange,
}) => {
  const { handleGlobalError } = useGlobalError();
  const org = useTypedSelector((state) => state.org);
  const { data, isFetching: loading } = useQuery<AssetFilterData>({
    queryKey: ["assetFilterOptions"],
    queryFn: getFilterOptions,
    refetchOnWindowFocus: true,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });

  async function getFilterOptions() {
    try {
      const allFilters: AssetFilterData = {
        licenseOptions: [],
        orgOptions: [],
        fileTypeOptions: [],
        peopleOptions: [],
        assetTagFilters: [],
      };

      const res = await api.getAssetFilterOptions();
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data) {
        throw new Error("Invalid response from server.");
      }

      if (res.data.orgs) {
        allFilters.orgOptions = res.data.orgs.map((org: string) => {
          return {
            value: org,
            key: crypto.randomUUID(),
            text: org,
          };
        });
      }

      if (res.data.licenses) {
        allFilters.licenseOptions = res.data.licenses.map((l: string) => {
          return {
            key: crypto.randomUUID(),
            text: l,
            value: l,
          };
        });
      }

      if (res.data.fileTypes) {
        const mapped = res.data.fileTypes.map((ft: string) => {
          return {
            key: crypto.randomUUID(),
            text: getPrettyNameFromMimeType(ft),
            value: ft,
          };
        });

        mapped.sort((a, b) => a.text.localeCompare(b.text));
        allFilters.fileTypeOptions = mapped;
      }

      if (res.data.people) {
        allFilters.peopleOptions = res.data.people.map((p) => {
          return {
            key: crypto.randomUUID(),
            text: `${p.firstName} ${p.lastName}`,
            value: `${p.firstName} ${p.lastName}`,
          };
        });
      }

      if (res.data.customFilters) {
        allFilters.assetTagFilters = res.data.customFilters;
      }

      return allFilters;
    } catch (err) {
      handleGlobalError(err);
      return {
        licenseOptions: [],
        orgOptions: [],
        fileTypeOptions: [],
        peopleOptions: [],
        assetTagFilters: [],
      };
    }
  }

  return (
    <div
      aria-busy={loading}
      className="flex flex-row w-full justify-between items-center ml-1"
    >
      <div className="flex flex-row my-4 flex-wrap items-center gap-2">
        {/* <CatalogFilterDropdown
          text={`License ${filters.license ? " - " : ""}${
            filters.license ?? ""
          }`}
          icon="legal"
          options={licenseOptions}
          filterKey="license"
          onFilterSelect={(key, val) => onFilterChange(key, val)}
          loading={loading}
        /> */}
        {data?.assetTagFilters &&
          data?.assetTagFilters.length > 0 &&
          data?.assetTagFilters.map((filter, index) => {
            const filterKey = filter.title;
            return (
              <CatalogFilterDropdown
                key={index}
                text={
                  filters[filterKey]
                    ? `${filterKey} - ${filters[filterKey]}`
                    : filterKey
                }
                icon="tags"
                options={filter.options.map((option) => ({
                  key: crypto.randomUUID(),
                  text: option,
                  value: option,
                }))}
                filterKey={filterKey}
                onFilterSelect={(key, val) => onFilterChange(key, val)}
              />
            );
          })}
        {!org.assetFilterExclusions?.includes("fileType") && (
          <CatalogFilterDropdown
            text={
              filters.fileType ? `File Type - ${filters.fileType}` : "File Type"
            }
            icon="file alternate outline"
            options={data?.fileTypeOptions ?? []}
            filterKey="fileType"
            onFilterSelect={(key, val) => onFilterChange(key, val)}
            loading={loading}
          />
        )}
        {!org.assetFilterExclusions?.includes("org") && (
          <CatalogFilterDropdown
            text={`Organization ${filters.org ? " - " : ""}${
              filters.org ?? ""
            }`}
            icon="university"
            options={data?.orgOptions ?? []}
            filterKey="org"
            onFilterSelect={(key, val) => onFilterChange(key, val)}
          />
        )}
        {!org.assetFilterExclusions?.includes("person") && (
          <CatalogFilterDropdown
            text={`People ${filters.person ? " - " : ""}${
              filters.person ?? ""
            }`}
            icon="user"
            options={data?.peopleOptions ?? []}
            filterKey="person"
            onFilterSelect={(key, val) => onFilterChange(key, val)}
          />
        )}
      </div>
    </div>
  );
};

export default CatalogAssetFilters;
