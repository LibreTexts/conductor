import { useEffect, useState } from "react";
import {
  AssetFilters,
  AssetFiltersAction,
  GenericKeyTextValueObj,
} from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";
import COMMON_MIME_TYPES, {
  getPrettyNameFromMimeType,
} from "../../../utils/common-mime-types";
import CatalogFilterDropdown from "./CatalogFilterDropdown";
import { prependClearOption } from "../../util/CatalogOptions";

interface CatalogAssetFiltersProps {
  filters: AssetFilters;
  onFilterChange: (type: AssetFiltersAction["type"], payload: string) => void;
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
    } catch (err) {
      handleGlobalError(err);
    }
  }

  return (
    <div
      aria-busy={loading}
      className="flex flex-row w-full justify-between items-center"
    >
      <div className="flex flex-row my-4 flex-wrap items-center gap-2">
        <CatalogFilterDropdown
          text={`License ${filters.license ? " - " : ""}${
            filters.license ?? ""
          }`}
          icon="legal"
          options={licenseOptions}
          filterKey="license"
          onFilterSelect={(key, val) =>
            onFilterChange(key as keyof AssetFilters, val)
          }
          loading={loading}
        />
        <CatalogFilterDropdown
          text={`Organization ${filters.org ? " - " : ""}${filters.org ?? ""}`}
          icon="university"
          options={orgOptions}
          filterKey="org"
          onFilterSelect={(key, val) =>
            onFilterChange(key as keyof AssetFilters, val)
          }
        />
        <CatalogFilterDropdown
          text={
            filters.fileType ? `File Type - ${filters.fileType}` : "File Type"
          }
          icon="file alternate outline"
          options={fileTypeOptions}
          filterKey="fileType"
          onFilterSelect={(key, val) =>
            onFilterChange(key as keyof AssetFilters, val)
          }
          loading={loading}
        />
      </div>
    </div>
  );
};

export default CatalogAssetFilters;
