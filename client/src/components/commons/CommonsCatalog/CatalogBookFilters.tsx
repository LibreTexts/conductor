import React from "react";
import axios from "axios";
import {
  BookFilters,
  BookFiltersAction,
  GenericKeyTextValueObj,
} from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import { catalogLocationOptions } from "../../util/CatalogOptions";
import api from "../../../api";
import { libraryOptions } from "../../util/LibraryOptions";
import CatalogFilterDropdown from "./CatalogFilterDropdown";
import { useQuery } from "@tanstack/react-query";

type BookFilterData = {
  subjectOptions: GenericKeyTextValueObj<string>[];
  licenseOptions: GenericKeyTextValueObj<string>[];
  authorOptions: GenericKeyTextValueObj<string>[];
  courseOptions: GenericKeyTextValueObj<string>[];
  pubOptions: GenericKeyTextValueObj<string>[];
  affOptions: GenericKeyTextValueObj<string>[];
  cidOptions: GenericKeyTextValueObj<string>[];
};

interface CatalogBookFiltersProps {
  filters: BookFilters;
  onFilterChange: (type: BookFiltersAction["type"], payload: string) => void;
}

const CatalogBookFilters: React.FC<CatalogBookFiltersProps> = ({
  filters,
  onFilterChange,
}) => {
  const { handleGlobalError } = useGlobalError();
  const { data, isFetching: loading } = useQuery<BookFilterData>({
    queryKey: ["bookFilterOptions"],
    queryFn: getFilterOptions,
    refetchOnWindowFocus: true,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });

  const { data: licenseOptions, isFetching: licensesLoading } = useQuery<
    GenericKeyTextValueObj<string>[]
  >({
    queryKey: ["licenseOptions"],
    queryFn: getLicenseOptions,
    refetchOnWindowFocus: true,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });

  /**
   * Retrieve the list(s) of dynamic
   * filter options from the server.
   */
  async function getFilterOptions() {
    try {
      const allFilters: BookFilterData = {
        subjectOptions: [],
        licenseOptions: [],
        authorOptions: [],
        courseOptions: [],
        pubOptions: [],
        affOptions: [],
        cidOptions: [],
      };

      const res = await axios.get("/commons/filters");
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (res.data.authors && Array.isArray(res.data.authors)) {
        allFilters.authorOptions = res.data.authors.map((a: string) => {
          return {
            key: a,
            text: a,
            value: a,
          };
        });
      }

      if (res.data.subjects && Array.isArray(res.data.subjects)) {
        allFilters.subjectOptions = res.data.subjects.map((s: string) => {
          return {
            key: s,
            text: s,
            value: s,
          };
        });
      }
      if (res.data.affiliations && Array.isArray(res.data.affiliations)) {
        allFilters.affOptions = res.data.affiliations.map((a: string) => {
          return {
            key: a,
            text: a,
            value: a,
          };
        });
      }
      if (res.data.courses && Array.isArray(res.data.courses)) {
        allFilters.courseOptions = res.data.courses.map((c: string) => {
          return {
            key: c,
            text: c,
            value: c,
          };
        });
      }
      if (res.data.publishers && Array.isArray(res.data.publishers)) {
        allFilters.pubOptions = res.data.publishers.map((p: string) => {
          return {
            key: p,
            text: p,
            value: p,
          };
        });
      }
      if (Array.isArray(res.data.cids)) {
        allFilters.cidOptions = res.data.cids.map((cid: string) => {
          return {
            key: cid,
            text: cid,
            value: cid,
          };
        });
      }

      return allFilters;
    } catch (err) {
      handleGlobalError(err);
      return {
        subjectOptions: [],
        licenseOptions: [],
        authorOptions: [],
        courseOptions: [],
        pubOptions: [],
        affOptions: [],
        cidOptions: [],
      };
    }
  }

  async function getLicenseOptions() {
    try {
      const res = await api.getCentralIdentityLicenses();
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      const opts: GenericKeyTextValueObj<string>[] = [];

      if (!res.data.licenses || !Array.isArray(res.data.licenses)) {
        throw new Error("Invalid response from server.");
      }

      const noDuplicates = new Set<string>();
      res.data.licenses.forEach((license) => {
        noDuplicates.add(license.name);
      });

      noDuplicates.forEach((licenseName) => {
        opts.push({
          key: crypto.randomUUID(),
          text: licenseName,
          value: licenseName,
        });
      });

      return opts;
    } catch (err) {
      handleGlobalError(err);
      return [];
    }
  }

  return (
    <div
      aria-busy={loading}
      className="flex flex-row w-full justify-between items-center ml-1"
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
          options={data?.subjectOptions ?? []}
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
          options={catalogLocationOptions}
          filterKey="location"
          onFilterSelect={(key, val) =>
            onFilterChange(key as keyof BookFilters, val)
          }
          loading={loading}
        />
        <CatalogFilterDropdown
          text={filters.license ? `License - ${filters.license}` : "License"}
          icon="legal"
          options={licenseOptions ?? []}
          filterKey="license"
          onFilterSelect={(key, val) =>
            onFilterChange(key as keyof BookFilters, val)
          }
          loading={licensesLoading}
        />
        <CatalogFilterDropdown
          text={filters.author ? `Author - ${filters.author}` : "Author"}
          icon="user"
          options={data?.authorOptions ?? []}
          filterKey="author"
          onFilterSelect={(key, val) =>
            onFilterChange(key as keyof BookFilters, val)
          }
          loading={loading}
        />
        <CatalogFilterDropdown
          text={filters.course ? `Course - ${filters.course}` : "Course"}
          icon="users"
          options={data?.courseOptions ?? []}
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
          options={data?.affOptions ?? []}
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
