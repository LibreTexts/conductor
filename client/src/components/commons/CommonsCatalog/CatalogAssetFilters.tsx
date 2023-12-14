import { Button, Dropdown, Icon } from "semantic-ui-react";
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

type NameVersionObj = {
  name: string;
  version?: string;
};

type ReducedLicense = Omit<CentralIdentityLicense, "versions"> & {
  version?: string;
};

type CatalogAssetFiltersRef = {
  getSelectedFilters: () => AssetFilters;
  resetFilters: () => void;
};

const CatalogAssetFilters = forwardRef(
  (
    props: {
      onFiltersChange: (filters: AssetFilters) => void;
    },
    ref: ForwardedRef<CatalogAssetFiltersRef>
  ) => {
    const MENU_CLASSES = "max-w-sm max-h-52 overflow-y-auto overflow-x-clip";

    const { handleGlobalError } = useGlobalError();

    const [licenseOptions, setLicenseOptions] = useState<
      GenericKeyTextValueObj<NameVersionObj>[]
    >([]);
    const [orgOptions, setOrgOptions] = useState<
      GenericKeyTextValueObj<string>[]
    >([]);
    const [fileTypeOptions, setFileTypeOptions] = useState<
      GenericKeyTextValueObj<string>[]
    >(catalogAssetTypeOptions);
    const [loading, setLoading] = useState(false);
    const [selectedFilters, setSelectedFilters] = useState<AssetFilters>({});

    useImperativeHandle(ref, () => ({
      getSelectedFilters: () => {
        return selectedFilters;
      },
      resetFilters: () => {
        setSelectedFilters({});
      },
    }));

    useEffect(() => {
      getOrgs();
      getLicenseOptions();
      getFileTypeOptions();
    }, []);

    useEffect(() => {
      props.onFiltersChange(selectedFilters);
    }, [selectedFilters]);

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
          { key: "empty", text: "Clear...", value: { name: "" } },
        ];

        if (!res.data.licenses || !Array.isArray(res.data.licenses)) {
          throw new Error("Invalid response from server.");
        }

        const reduced = res.data.licenses.reduce((acc: any, curr: any) => {
          if (Array.isArray(curr.versions) && curr.versions.length > 0) {
            acc.push(curr);
            curr.versions.forEach((version: any) => {
              const newObj = { ...curr, version };
              delete newObj.versions;
              acc.push(newObj);
            });
          } else {
            acc.push(curr);
          }
          return acc;
        }, []);

        reduced.forEach((license: ReducedLicense) => {
          const text =
            license.name + (license.version ? ` (${license.version})` : "");
          newLicenseOptions.push({
            key: text,
            text,
            value: { name: license.name, version: license.version },
          });
        });

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
        className="flex flex-row my-4 mx-2 flex-wrap h-10 items-center gap-y-2"
      >
        <Dropdown
          text="License"
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
                    assetLicense: license.value.name,
                    assetLicenseVersion: license.value.version ?? undefined,
                  })
                }
              >
                {license.text}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
        <Dropdown
          text="Organization"
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
                    assetOrg: org.value,
                  })
                }
              >
                {org.text}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
        <Dropdown
          text="File Type"
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
                    assetFileType: ft.value,
                  });
                }}
              >
                {ft.text}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
        {Object.entries(selectedFilters)
          .filter((e) => (e[1] ? true : false))
          .map(([key, val]) => (
            <Button
              key={key}
              circular
              className="!ml-2"
              onClick={() => {
                const newFilters = { ...selectedFilters };
                delete newFilters[key as keyof AssetFilters];
                setSelectedFilters(newFilters);
              }}
            >
              <Icon name="x" />
              {getFilterText(key)}: {val}
            </Button>
          ))}
        {Object.keys(selectedFilters).length > 0 && (
          <p
            className="underline cursor-pointer ml-2"
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
