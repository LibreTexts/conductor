import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  BookFilters,
  BookFiltersAction,
  GenericKeyTextValueObj,
} from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import {
  catalogLocationOptions,
  prependClearOption,
} from "../../util/CatalogOptions";
import api from "../../../api";
import { libraryOptions } from "../../util/LibraryOptions";
import CatalogFilterDropdown from "./CatalogFilterDropdown";

interface CatalogBookFiltersProps {
  filters: BookFilters;
  onFilterChange: (type: BookFiltersAction["type"], payload: string) => void;
}

const CatalogBookFilters: React.FC<CatalogBookFiltersProps> = ({
  filters,
  onFilterChange,
}) => {
  const { handleGlobalError } = useGlobalError();

  const [subjectOptions, setSubjectOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [licenseOptions, setLicenseOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [authorOptions, setAuthorOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [courseOptions, setCourseOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [pubOptions, setPubOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [affOptions, setAffOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [cidOptions, setCIDOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getFilterOptions();
    getLicenseOptions();
  }, []);

  /**
   * Retrieve the list(s) of dynamic
   * filter options from the server.
   */
  async function getFilterOptions() {
    try {
      setLoading(true);

      const res = await axios.get("/commons/filters");
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (res.data.authors && Array.isArray(res.data.authors)) {
        const opts = res.data.authors.map((a: string) => {
          return {
            key: a,
            text: a,
            value: a,
          };
        });
        setAuthorOptions(prependClearOption(opts));
      }

      if (res.data.subjects && Array.isArray(res.data.subjects)) {
        const opts = res.data.subjects.map((s: string) => {
          return {
            key: s,
            text: s,
            value: s,
          };
        });
        setSubjectOptions(prependClearOption(opts));
      }
      if (res.data.affiliations && Array.isArray(res.data.affiliations)) {
        const opts = res.data.affiliations.map((a: string) => {
          return {
            key: a,
            text: a,
            value: a,
          };
        });
        setAffOptions(prependClearOption(opts));
      }
      if (res.data.courses && Array.isArray(res.data.courses)) {
        const opts = res.data.courses.map((c: string) => {
          return {
            key: c,
            text: c,
            value: c,
          };
        });
        setCourseOptions(prependClearOption(opts));
      }
      if (res.data.publishers && Array.isArray(res.data.publishers)) {
        const opts = res.data.publishers.map((p: string) => {
          return {
            key: p,
            text: p,
            value: p,
          };
        });
        setPubOptions(prependClearOption(opts));
      }
      if (Array.isArray(res.data.cids)) {
        const opts = res.data.cids.map((cid: string) => {
          return {
            key: cid,
            text: cid,
            value: cid,
          };
        });
        setCIDOptions(prependClearOption(opts));
      }
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
        // { key: "empty", text: "Clear...", value: "" },
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

      setLicenseOptions(prependClearOption(newLicenseOptions));
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      aria-busy={loading}
      className="flex flex-row w-full justify-between items-center"
    >
      <div className="flex flex-row mt-2 mb-4 flex-wrap items-center gap-y-2 ">
        <CatalogFilterDropdown
          text={filters.library ? `Library - ${filters.library}` : "Library"}
          icon="university"
          options={libraryOptions}
          filterKey="library"
          onFilterSelect={(key, val) =>
            onFilterChange(key as keyof BookFilters, val)
          }
          loading={loading}
        />
        <CatalogFilterDropdown
          text={filters.subject ? `Subject - ${filters.subject}` : "Subject"}
          icon="filter"
          options={subjectOptions}
          filterKey="subject"
          onFilterSelect={(key, val) =>
            onFilterChange(key as keyof BookFilters, val)
          }
          loading={loading}
        />
        <CatalogFilterDropdown
          text={
            filters.location ? `Location - ${filters.location}` : "Location"
          }
          icon="globe"
          options={prependClearOption(catalogLocationOptions)}
          filterKey="location"
          onFilterSelect={(key, val) =>
            onFilterChange(key as keyof BookFilters, val)
          }
          loading={loading}
        />
        <CatalogFilterDropdown
          text={filters.license ? `License - ${filters.license}` : "License"}
          icon="legal"
          options={licenseOptions}
          filterKey="license"
          onFilterSelect={(key, val) =>
            onFilterChange(key as keyof BookFilters, val)
          }
          loading={loading}
        />
        <CatalogFilterDropdown
          text={filters.author ? `Author - ${filters.author}` : "Author"}
          icon="user"
          options={authorOptions}
          filterKey="author"
          onFilterSelect={(key, val) =>
            onFilterChange(key as keyof BookFilters, val)
          }
          loading={loading}
        />
        <CatalogFilterDropdown
          text={filters.course ? `Course - ${filters.course}` : "Course"}
          icon="users"
          options={courseOptions}
          filterKey="course"
          onFilterSelect={(key, val) =>
            onFilterChange(key as keyof BookFilters, val)
          }
          loading={loading}
        />
        <CatalogFilterDropdown
          text={
            filters.affiliation
              ? `Affiliation - ${filters.affiliation}`
              : "Affiliation"
          }
          icon="filter"
          options={affOptions}
          filterKey="affiliation"
          onFilterSelect={(key, val) =>
            onFilterChange(key as keyof BookFilters, val)
          }
          loading={loading}
        />
      </div>
    </div>
  );
};

export default CatalogBookFilters;
