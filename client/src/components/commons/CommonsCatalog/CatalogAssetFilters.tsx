import { Button, Dropdown, Icon } from "semantic-ui-react";
import { useEffect, useState } from "react";
import axios from "axios";
import { CentralIdentityLicense, GenericKeyTextValueObj } from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";
import { catalogAssetTypeOptions } from "../../util/CatalogOptions";

type NameVersionObj = {
  name: string;
  version?: string;
};

type SelectedCatalogAssetFilters = {
  license?: NameVersionObj[];
  orgs?: string[];
  fileTypes?: string[];
};

type ReducedLicense = Omit<CentralIdentityLicense, "versions"> & {
  version?: string;
};

const CatalogAssetFilters = () => {
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
  const [selectedFilters, setSelectedFilters] =
    useState<SelectedCatalogAssetFilters>({});

  useEffect(() => {
    getOrgs();
    getLicenseOptions();
  }, []);

  useEffect(() => {
    console.log(selectedFilters);
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
        if (Array.isArray(curr.versions)) {
          if(curr.versions.length === 0) {
            acc.push(curr);
            return acc;
          }
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

  const handleLicenseChange = (value: string, version?: string) => {
    const found = selectedFilters.license?.find(
      (lic) => lic.name === value && lic.version === version
    );
    if (found) {
      setSelectedFilters({
        ...selectedFilters,
        license: selectedFilters.license?.filter(
          (lic) => lic.name !== value && lic.version !== version
        ),
      });
      return;
    }
    setSelectedFilters({
      ...selectedFilters,
      license: [...(selectedFilters.license ?? []), { name: value, version }],
    });
  };

  const handleOrgChange = (value: string) => {
    const found = selectedFilters.orgs?.find((org) => org === value);
    if (found) {
      setSelectedFilters({
        ...selectedFilters,
        orgs: selectedFilters.orgs?.filter((org) => org !== value),
      });
      return;
    }
    setSelectedFilters({
      ...selectedFilters,
      orgs: [...(selectedFilters.orgs ?? []), value],
    });
  };

  const handleFileTypeChange = (value: string) => {
    const found = selectedFilters.fileTypes?.find((ft) => ft === value);
    if (found) {
      setSelectedFilters({
        ...selectedFilters,
        fileTypes: selectedFilters.fileTypes?.filter((ft) => ft !== value),
      });
      return;
    }
    setSelectedFilters({
      ...selectedFilters,
      fileTypes: [...(selectedFilters.fileTypes ?? []), value],
    });
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
                handleLicenseChange(license.value.name, license.value.version)
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
              onClick={() => handleOrgChange(org.value)}
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
              onClick={() => handleFileTypeChange(ft.value)}
            >
              {ft.text}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
      {Object.keys(selectedFilters).length > 0 && (
        <Button
          circular
          className="!ml-8"
          onClick={() => setSelectedFilters({})}
        >
          <Icon name="x" />
          Clear {Object.keys(selectedFilters).length} filters
        </Button>
      )}
    </div>
  );
};

export default CatalogAssetFilters;
