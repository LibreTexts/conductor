import { useEffect, useState } from "react";
import { GenericKeyTextValueObj } from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";
import COMMON_MIME_TYPES, {
  getPrettyNameFromMimeType,
} from "../../../utils/common-mime-types";
import CatalogFilterDropdown from "./CatalogFilterDropdown";
import { prependClearOption } from "../../util/CatalogOptions";
import { CustomFilter } from "../../../types/Search";

interface CatalogAssetFiltersProps {
  filters: Record<string, string>;
  onFilterChange: (type: string, payload: string) => void;
}

const CatalogAssetFilters: React.FC<CatalogAssetFiltersProps> = ({
  filters,
  onFilterChange,
}) => {
  const { handleGlobalError } = useGlobalError();

  const [licenseOptions, setLicenseOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [orgOptions, setOrgOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [fileTypeOptions, setFileTypeOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [assetTagFilters, setAssetTagFilters] = useState<CustomFilter[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getFilterOptions();
  }, []);

  async function getFilterOptions() {
    try {
      const res = await api.getAssetFilterOptions();
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data) {
        throw new Error("Invalid response from server.");
      }

      if (res.data.orgs) {
        const orgs = res.data.orgs.map((org: string) => {
          return {
            value: org,
            key: crypto.randomUUID(),
            text: org,
          };
        });
        setOrgOptions(prependClearOption(orgs));
      }

      if (res.data.licenses) {
        const opts = res.data.licenses.map((l: string) => {
          return {
            key: crypto.randomUUID(),
            text: l,
            value: l,
          };
        });
        setLicenseOptions(prependClearOption(opts));
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
        setFileTypeOptions(prependClearOption(mapped));
      }

      if (res.data.customFilters) {
        setAssetTagFilters(res.data.customFilters);
      }
    } catch (err) {
      handleGlobalError(err);
    }
  }

  return (
    <div
      aria-busy={loading}
      className="flex flex-row w-full justify-between items-center ml-1"
    >
      <div className="flex flex-row my-4 flex-wrap items-center gap-2">
        <CatalogFilterDropdown
          text={`License ${filters.license ? " - " : ""}${
            filters.license ?? ""
          }`}
          icon="legal"
          options={licenseOptions}
          filterKey="license"
          onFilterSelect={(key, val) => onFilterChange(key, val)}
          loading={loading}
        />
        <CatalogFilterDropdown
          text={`Organization ${filters.org ? " - " : ""}${filters.org ?? ""}`}
          icon="university"
          options={orgOptions}
          filterKey="org"
          onFilterSelect={(key, val) => onFilterChange(key, val)}
        />
        <CatalogFilterDropdown
          text={
            filters.fileType ? `File Type - ${filters.fileType}` : "File Type"
          }
          icon="file alternate outline"
          options={fileTypeOptions}
          filterKey="fileType"
          onFilterSelect={(key, val) => onFilterChange(key, val)}
          loading={loading}
        />
        {assetTagFilters.length > 0 &&
          assetTagFilters.map((filter, index) => {
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
                options={prependClearOption(
                  filter.options.map((option) => ({
                    key: crypto.randomUUID(),
                    text: option,
                    value: option,
                  }))
                )}
                filterKey={filterKey}
                onFilterSelect={(key, val) => onFilterChange(key, val)}
              />
            );
          })}
      </div>
    </div>
  );
};

export default CatalogAssetFilters;
