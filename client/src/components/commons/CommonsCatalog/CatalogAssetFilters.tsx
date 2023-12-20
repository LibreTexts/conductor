import { Button, Checkbox, Dropdown, Icon } from "semantic-ui-react";
import {
  ForwardedRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import axios from "axios";
import {
  AssetFilters,
  CentralIdentityLicense,
  GenericKeyTextValueObj,
} from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";
import { catalogAssetTypeOptions } from "../../util/CatalogOptions";
import COMMON_MIME_TYPES from "../../../utils/common-mime-types";

type ReducedLicense = Omit<CentralIdentityLicense, "versions"> & {
  version?: string;
};

interface CatalogAssetFiltersProps {
  strictMode?: boolean;
  onStrictModeChange?: (strictMode: boolean) => void;
  selectedFilters: AssetFilters;
  setSelectedFilters: (filters: AssetFilters) => void;
}

type CatalogAssetFiltersRef = {};

const CatalogAssetFilters = forwardRef(
  (
    props: CatalogAssetFiltersProps,
    ref: ForwardedRef<CatalogAssetFiltersRef>
  ) => {
    const MENU_CLASSES = "max-w-sm max-h-52 overflow-y-auto overflow-x-clip";

    const { selectedFilters, setSelectedFilters } = props;

    const { handleGlobalError } = useGlobalError();

    const [licenseOptions, setLicenseOptions] = useState<
      GenericKeyTextValueObj<string>[]
    >([]);
    const [orgOptions, setOrgOptions] = useState<
      GenericKeyTextValueObj<string>[]
    >([]);
    const [fileTypeOptions, setFileTypeOptions] = useState<
      GenericKeyTextValueObj<string>[]
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
        const res = await api.getCentralIdentityOrgs({
          query: searchQuery ?? undefined,
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
          { key: "empty", text: "Clear...", value: "" },
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

    const getFilterText = (key: string) => {
      switch (key) {
        case "assetLicense":
          return "License";
        case "assetLicenseVersion":
          return "License Version";
        case "assetOrg":
          return "Organization";
        case "assetFileType":
          return "File Type";
        default:
          return "";
      }
    };

    return (
      <div
        aria-busy={loading}
        className="flex flex-row w-full justify-between items-center"
      >
        <div className="flex flex-row my-4 mx-2 flex-wrap items-center gap-y-2">
          <Dropdown
            text={`License ${selectedFilters.license ? " - " : ""}${
              selectedFilters.license ?? ""
            }`}
            icon="legal"
            floating
            labeled
            button
            className="icon"
            loading={loading}
            basic
          >
            <Dropdown.Menu className={MENU_CLASSES}>
              {licenseOptions.map((license) => (
                <Dropdown.Item
                  key={license.key}
                  onClick={() =>
                    setSelectedFilters({
                      ...selectedFilters,
                      license: license.value,
                    })
                  }
                >
                  {license.text}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
          <Dropdown
            text={`Organization ${selectedFilters.org ? " - " : ""}${
              selectedFilters.org ?? ""
            }`}
            icon="university"
            floating
            labeled
            button
            className="icon"
            loading={loading}
            basic
          >
            <Dropdown.Menu className={MENU_CLASSES}>
              {orgOptions.map((org) => (
                <Dropdown.Item
                  key={org.key}
                  onClick={() =>
                    setSelectedFilters({
                      ...selectedFilters,
                      org: org.value,
                    })
                  }
                >
                  {org.text}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
          <Dropdown
            text={
              selectedFilters.fileType
                ? `File Type - ${selectedFilters.fileType}`
                : "File Type"
            }
            icon="file alternate outline"
            floating
            labeled
            button
            className="icon"
            loading={loading}
            basic
          >
            <Dropdown.Menu className={MENU_CLASSES}>
              {fileTypeOptions.map((ft) => (
                <Dropdown.Item
                  key={ft.key}
                  onClick={() => {
                    setSelectedFilters({
                      ...selectedFilters,
                      fileType: ft.value,
                    });
                  }}
                >
                  {ft.text}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
          <Checkbox
            label="Strict Search"
            className="!font-semibold ml-2"
            toggle
            checked={props.strictMode}
            onChange={() =>
              props.onStrictModeChange &&
              props.onStrictModeChange(!props.strictMode)
            }
          />
        </div>
        {Object.keys(selectedFilters).length > 0 && (
          <p
            className="underline cursor-pointer mr-2"
            onClick={() => setSelectedFilters({})}
          >
            Clear All
          </p>
        )}
      </div>
    );
  }
);

export default CatalogAssetFilters;
