import { Dropdown } from "semantic-ui-react";
import { useEffect, useState } from "react";
import {
  AssetFilters,
  AssetFiltersAction,
  CentralIdentityLicense,
  GenericKeyTextValueObj,
} from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";
import { catalogAssetTypeOptions } from "../../util/CatalogOptions";
import COMMON_MIME_TYPES, {
  getPrettyNameFromMimeType,
} from "../../../utils/common-mime-types";

interface CatalogAssetFiltersProps {
  filters: AssetFilters;
  onFilterChange: (type: AssetFiltersAction["type"], payload: string) => void;
}

const CatalogAssetFilters: React.FC<CatalogAssetFiltersProps> = ({
  filters,
  onFilterChange,
}) => {
  const DROPDOWN_CLASSES = "icon !min-w-56 !text-center";
  const MENU_CLASSES = "max-w-sm max-h-52 overflow-y-auto overflow-x-clip";
  const { handleGlobalError } = useGlobalError();

  const [licenseOptions, setLicenseOptions] = useState<
    GenericKeyTextValueObj<string | undefined>[]
  >([]);
  const [orgOptions, setOrgOptions] = useState<
    GenericKeyTextValueObj<string | undefined>[]
  >([]);
  const [fileTypeOptions, setFileTypeOptions] = useState<
    GenericKeyTextValueObj<string | undefined>[]
  >(catalogAssetTypeOptions);
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
        setOrgOptions(orgs);
      }

      if (res.data.licenses) {
        setLicenseOptions(
          res.data.licenses.map((l: string) => {
            return {
              key: crypto.randomUUID(),
              text: l,
              value: l,
            };
          })
        );
      }

      if (res.data.fileTypes) {
        setFileTypeOptions(
          res.data.fileTypes.map((ft: string) => {
            return {
              key: crypto.randomUUID(),
              text: getPrettyNameFromMimeType(ft),
              value: ft,
            };
          })
        );
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
        <Dropdown
          text={`License ${filters.license ? " - " : ""}${
            filters.license ?? ""
          }`}
          icon="legal"
          floating
          labeled
          button
          className={DROPDOWN_CLASSES}
          loading={loading}
          basic
        >
          <Dropdown.Menu className={MENU_CLASSES}>
            {licenseOptions.length > 0 &&
              licenseOptions.map((license) => (
                <Dropdown.Item
                  key={license.key}
                  onClick={() => onFilterChange("license", license.value ?? "")}
                >
                  {license.text}
                </Dropdown.Item>
              ))}
            {licenseOptions.length === 0 && (
              <Dropdown.Item disabled>No licenses available</Dropdown.Item>
            )}
          </Dropdown.Menu>
        </Dropdown>
        <Dropdown
          text={`Organization ${filters.org ? " - " : ""}${filters.org ?? ""}`}
          icon="university"
          floating
          labeled
          button
          className={DROPDOWN_CLASSES}
          loading={loading}
          basic
          search
          selection
          options={orgOptions.map((o) => ({
            key: o.key,
            text: o.text,
            value: o.value,
          }))}
          onChange={(_, data) => {
            onFilterChange("org", data.value?.toString() ?? "");
          }}
        />
        <Dropdown
          text={
            filters.fileType ? `File Type - ${filters.fileType}` : "File Type"
          }
          icon="file alternate outline"
          floating
          labeled
          button
          className={DROPDOWN_CLASSES}
          loading={loading}
          basic
        >
          <Dropdown.Menu className={MENU_CLASSES}>
            {fileTypeOptions.length > 0 &&
              fileTypeOptions
                .sort((a, b) => a.text.localeCompare(b.text))
                .map((ft) => (
                  <Dropdown.Item
                    key={ft.key}
                    onClick={() =>
                      onFilterChange("fileType", ft.value?.toString() ?? "")
                    }
                  >
                    {ft.text}
                  </Dropdown.Item>
                ))}
            {fileTypeOptions.length === 0 && (
              <Dropdown.Item disabled>No file types available</Dropdown.Item>
            )}
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </div>
  );
};

export default CatalogAssetFilters;
