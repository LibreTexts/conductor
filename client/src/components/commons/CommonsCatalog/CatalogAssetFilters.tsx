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
import COMMON_MIME_TYPES from "../../../utils/common-mime-types";
import { useTypedSelector } from "../../../state/hooks";

type ReducedLicense = Omit<CentralIdentityLicense, "versions"> & {
  version?: string;
};

interface CatalogAssetFiltersProps {
  filters: AssetFilters;
  onFilterChange: (type: AssetFiltersAction['type'], payload: string) => void;
}

const CatalogAssetFilters: React.FC<CatalogAssetFiltersProps> = ({
  filters,
  onFilterChange,
}) => {
  const DROPDOWN_CLASSES = "icon !min-w-56 !text-center";
  const MENU_CLASSES = "max-w-sm max-h-52 overflow-y-auto overflow-x-clip";
  const { handleGlobalError } = useGlobalError();
  const org = useTypedSelector((state) => state.org);

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
    getOrgs();
    getLicenseOptions();
    getFileTypeOptions();
  }, []);

  async function getOrgs(searchQuery?: string) {
    try {
      setLoading(true);

      // If the org has a custom list, use that instead of fetching from the server
      if (org.customOrgList && org.customOrgList.length > 0) {
        const orgs = org.customOrgList.map((org) => {
          return {
            value: org,
            key: org,
            text: org,
          };
        });
        setOrgOptions(orgs);
        return;
      }

      const res = await api.getCentralIdentityOrgs({
        query: searchQuery ?? undefined,
        limit: 500,
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.orgs || !Array.isArray(res.data.orgs)) {
        throw new Error("Invalid response from server.");
      }

      const orgs = res.data.orgs.map((org) => {
        return {
          value: org.name,
          key: org.id.toString(),
          text: org.name,
        };
      });

      setOrgOptions(orgs);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function getLicenseOptions() {
    try {
      setLoading(true);

      const res = await api.getCentralIdentityLicenses();
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      const newLicenseOptions: typeof licenseOptions = [
        // { key: "empty", text: "Clear...", value: undefined },
      ];

      if (!res.data.licenses || !Array.isArray(res.data.licenses)) {
        throw new Error("Invalid response from server.");
      }

      const noDuplicates = new Set<string>();
      res.data.licenses.forEach((license) => {
        noDuplicates.add(license.name);
      });

      noDuplicates.forEach((licenseName) => {
        newLicenseOptions.push({
          key: crypto.randomUUID(),
          text: licenseName,
          value: licenseName,
        });
      });

      // const reduced = res.data.licenses.reduce((acc: any, curr: any) => {
      //   if (Array.isArray(curr.versions) && curr.versions.length > 0) {
      //     acc.push(curr);
      //     curr.versions.forEach((version: any) => {
      //       const newObj = { ...curr, version };
      //       delete newObj.versions;
      //       acc.push(newObj);
      //     });
      //   } else {
      //     acc.push(curr);
      //   }
      //   return acc;
      // }, []);

      setLicenseOptions(newLicenseOptions);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  const getFileTypeOptions = () => {
    const opts = COMMON_MIME_TYPES.reduce((acc, curr) => {
      acc.push({
        key: crypto.randomUUID(),
        text: curr.title + " (Any)",
        value: curr.anySubType,
      });
      curr.mimeTypes.forEach((mt) => {
        acc.push({
          key: crypto.randomUUID(),
          text: mt.name,
          value: mt.value,
        });
      });
      return acc;
    }, [] as GenericKeyTextValueObj<string>[]);
    const sorted = opts.sort((a, b) => a.text.localeCompare(b.text));
    setFileTypeOptions(sorted);
  };

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
              fileTypeOptions.map((ft) => (
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
