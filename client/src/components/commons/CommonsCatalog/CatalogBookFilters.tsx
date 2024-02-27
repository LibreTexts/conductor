import { Dropdown } from "semantic-ui-react";
import { useEffect, useState } from "react";
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

interface CatalogBookFiltersProps {
  filters: BookFilters;
  onFilterChange: (type: BookFiltersAction["type"], payload: string) => void;
}

const CatalogBookFilters: React.FC<CatalogBookFiltersProps> = ({
  filters,
  onFilterChange,
}) => {
  const DROPDOWN_CLASSES = "icon !min-w-56 !text-center";
  const MENU_CLASSES = "max-w-sm max-h-52 overflow-y-auto overflow-x-clip";
  const { handleGlobalError } = useGlobalError();

  const [subjectOptions, setSubjectOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [locationOptions, setLocationOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >(catalogLocationOptions);
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
        setAuthorOptions(
          res.data.authors.map((a: string) => {
            return {
              key: a,
              text: a,
              value: a,
            };
          })
        );
      }

      if (res.data.subjects && Array.isArray(res.data.subjects)) {
        setSubjectOptions(
          res.data.subjects.map((s: string) => {
            return {
              key: s,
              text: s,
              value: s,
            };
          })
        );
      }
      if (res.data.affiliations && Array.isArray(res.data.affiliations)) {
        setAffOptions(
          res.data.affiliations.map((a: string) => {
            return {
              key: a,
              text: a,
              value: a,
            };
          })
        );
      }
      if (res.data.courses && Array.isArray(res.data.courses)) {
        setCourseOptions(
          res.data.courses.map((c: string) => {
            return {
              key: c,
              text: c,
              value: c,
            };
          })
        );
      }
      if (res.data.publishers && Array.isArray(res.data.publishers)) {
        setPubOptions(
          res.data.publishers.map((p: string) => {
            return {
              key: p,
              text: p,
              value: p,
            };
          })
        );
      }
      if (Array.isArray(res.data.cids)) {
        setCIDOptions(
          res.data.cids.map((cid: string) => {
            return {
              key: cid,
              text: cid,
              value: cid,
            };
          })
        );
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

  return (
    <div
      aria-busy={loading}
      className="flex flex-row w-full justify-between items-center"
    >
      <div className="flex flex-row mt-2 mb-4 flex-wrap items-center gap-y-2 ">
        <Dropdown
          text={filters.library ? `Library - ${filters.library}` : "Library"}
          icon="university"
          floating
          labeled
          button
          className={DROPDOWN_CLASSES}
          loading={loading}
          basic
        >
          <Dropdown.Menu className={MENU_CLASSES}>
            {libraryOptions.length > 0 &&
              libraryOptions.map((library) => (
                <Dropdown.Item
                  key={library.key}
                  onClick={() => onFilterChange("library", library.value)}
                >
                  {library.text}
                </Dropdown.Item>
              ))}
            {libraryOptions.length === 0 && (
              <Dropdown.Item>No libraries available</Dropdown.Item>
            )}
          </Dropdown.Menu>
        </Dropdown>
        <Dropdown
          text={filters.subject ? `Subject - ${filters.subject}` : "Subject"}
          icon="filter"
          floating
          labeled
          button
          className={DROPDOWN_CLASSES}
          loading={loading}
          basic
        >
          <Dropdown.Menu className={MENU_CLASSES}>
            {subjectOptions.length > 0 &&
              subjectOptions.map((subject) => (
                <Dropdown.Item
                  key={subject.key}
                  onClick={() => onFilterChange("subject", subject.value)}
                >
                  {subject.text}
                </Dropdown.Item>
              ))}
            {subjectOptions.length === 0 && (
              <Dropdown.Item>No subjects available</Dropdown.Item>
            )}
          </Dropdown.Menu>
        </Dropdown>
        <Dropdown
          text={
            filters.location ? `Location - ${filters.location}` : "Location"
          }
          icon="globe"
          floating
          labeled
          button
          className={DROPDOWN_CLASSES}
          loading={loading}
          basic
        >
          <Dropdown.Menu className={MENU_CLASSES}>
            {locationOptions.length > 0 &&
              locationOptions.map((location) => (
                <Dropdown.Item
                  key={location.key}
                  onClick={() => onFilterChange("location", location.value)}
                >
                  {location.text}
                </Dropdown.Item>
              ))}
            {locationOptions.length === 0 && (
              <Dropdown.Item>No locations available</Dropdown.Item>
            )}
          </Dropdown.Menu>
        </Dropdown>
        <Dropdown
          text={filters.license ? `License - ${filters.license}` : "License"}
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
                  onClick={() => onFilterChange("license", license.value)}
                >
                  {license.text}
                </Dropdown.Item>
              ))}
            {licenseOptions.length === 0 && (
              <Dropdown.Item>No licenses available</Dropdown.Item>
            )}
          </Dropdown.Menu>
        </Dropdown>
        <Dropdown
          text={filters.author ? `Author - ${filters.author}` : "Author"}
          icon="user"
          floating
          labeled
          button
          className={DROPDOWN_CLASSES}
          loading={loading}
          basic
        >
          <Dropdown.Menu className={MENU_CLASSES}>
            {authorOptions.length > 0 &&
              authorOptions.map((author) => (
                <Dropdown.Item
                  key={author.key}
                  onClick={() => onFilterChange("author", author.value)}
                >
                  {author.text}
                </Dropdown.Item>
              ))}
            {authorOptions.length === 0 && (
              <Dropdown.Item>No authors available</Dropdown.Item>
            )}
          </Dropdown.Menu>
        </Dropdown>
        <Dropdown
          text={filters.course ? `Course - ${filters.course}` : "Course"}
          icon="users"
          floating
          labeled
          button
          className={DROPDOWN_CLASSES}
          loading={loading}
          basic
        >
          <Dropdown.Menu className={MENU_CLASSES}>
            {courseOptions.length > 0 &&
              courseOptions.map((course) => (
                <Dropdown.Item
                  key={course.key}
                  onClick={() => onFilterChange("course", course.value)}
                >
                  {course.text}
                </Dropdown.Item>
              ))}
            {courseOptions.length === 0 && (
              <Dropdown.Item>No courses available</Dropdown.Item>
            )}
          </Dropdown.Menu>
        </Dropdown>
        <Dropdown
          text={
            filters.affiliation
              ? `Affiliation - ${filters.affiliation}`
              : "Affiliation"
          }
          icon="filter"
          floating
          labeled
          button
          className={DROPDOWN_CLASSES}
          loading={loading}
          basic
        >
          <Dropdown.Menu className={MENU_CLASSES}>
            {affOptions.length > 0 &&
              affOptions.map((affiliation) => (
                <Dropdown.Item
                  key={affiliation.key}
                  onClick={() =>
                    onFilterChange("affiliation", affiliation.value)
                  }
                >
                  {affiliation.text}
                </Dropdown.Item>
              ))}
            {affOptions.length === 0 && (
              <Dropdown.Item>No affiliations available</Dropdown.Item>
            )}
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </div>
  );
};

export default CatalogBookFilters;
