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
  BookFilters,
  CentralIdentityLicense,
  GenericKeyTextValueObj,
} from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import { catalogLocationOptions } from "../../util/CatalogOptions";
import api from "../../../api";
import { libraryOptions } from "../../util/LibraryOptions";

type CatalogBookFiltersRef = {
  getSelectedFilters: () => BookFilters;
};

const CatalogBookFilters = forwardRef(
  (props: {
    onFiltersChange: (filters: BookFilters) => void;
  }, ref: ForwardedRef<CatalogBookFiltersRef>) => {
    const MENU_CLASSES = "max-w-sm max-h-52 overflow-y-auto overflow-x-clip";
    const { handleGlobalError } = useGlobalError();

    const [showAdvanced, setShowAdvanced] = useState(false);
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
    const [selectedFilters, setSelectedFilters] = useState<BookFilters>({});

    useImperativeHandle(ref, () => ({
      getSelectedFilters: () => {
        return selectedFilters;
      },
    }));

    useEffect(() => {
      getFilterOptions();
      getLicenseOptions();
    }, []);

    useEffect(() => {
      props.onFiltersChange(selectedFilters);
    }, [selectedFilters]);

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
        const newAuthorOptions = [
          { key: "empty", text: "Clear...", value: "" },
        ];
        const newSubjectOptions = [
          { key: "empty", text: "Clear...", value: "" },
        ];
        const newAffOptions = [{ key: "empty", text: "Clear...", value: "" }];
        const newCourseOptions = [
          { key: "empty", text: "Clear...", value: "" },
        ];
        const newPubOptions = [{ key: "empty", text: "Clear...", value: "" }];
        const newCIDOptions = [{ key: "empty", text: "Clear...", value: "" }];

        if (res.data.authors && Array.isArray(res.data.authors)) {
          res.data.authors.forEach((author: string) => {
            newAuthorOptions.push({
              key: author,
              text: author,
              value: author,
            });
          });
        }
        if (res.data.subjects && Array.isArray(res.data.subjects)) {
          res.data.subjects.forEach((subject: string) => {
            newSubjectOptions.push({
              key: subject,
              text: subject,
              value: subject,
            });
          });
        }
        if (res.data.affiliations && Array.isArray(res.data.affiliations)) {
          res.data.affiliations.forEach((affiliation: string) => {
            newAffOptions.push({
              key: affiliation,
              text: affiliation,
              value: affiliation,
            });
          });
        }
        if (res.data.courses && Array.isArray(res.data.courses)) {
          res.data.courses.forEach((course: string) => {
            newCourseOptions.push({
              key: course,
              text: course,
              value: course,
            });
          });
        }
        if (res.data.publishers && Array.isArray(res.data.publishers)) {
          res.data.publishers.forEach((publisher: string) => {
            newPubOptions.push({
              key: publisher,
              text: publisher,
              value: publisher,
            });
          });
        }
        if (Array.isArray(res.data.cids)) {
          res.data.cids.forEach((descriptor: string) => {
            newCIDOptions.push({
              key: descriptor,
              text: descriptor,
              value: descriptor,
            });
          });
        }

        setAuthorOptions(newAuthorOptions);
        setSubjectOptions(newSubjectOptions);
        setAffOptions(newAffOptions);
        setCourseOptions(newCourseOptions);
        setPubOptions(newPubOptions);
        setCIDOptions(newCIDOptions);
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
        const newLicenseOptions = [
          { key: "empty", text: "Clear...", value: "" },
        ];

        // TODO: Handle license versions
        if (res.data.licenses && Array.isArray(res.data.licenses)) {
          res.data.licenses.forEach((license: CentralIdentityLicense) => {
            newLicenseOptions.push({
              key: license.name,
              text: license.name,
              value: license.name,
            });
          });
        }

        setLicenseOptions(newLicenseOptions);
      } catch (err) {
        handleGlobalError(err);
      } finally {
        setLoading(false);
      }
    }

    // const handleLocationChange = (value: string) => {
    //   const found = selectedFilters.location?.find((loc) => loc === value);
    //   if (found) {
    //     setSelectedFilters({
    //       ...selectedFilters,
    //       location: selectedFilters.location?.filter((loc) => loc !== value),
    //     });
    //     return;
    //   }
    //   setSelectedFilters({
    //     ...selectedFilters,
    //     location: [...(selectedFilters.location ?? []), value],
    //   });
    // };

    return (
      <div
        aria-busy={loading}
        className="flex flex-row my-4 mx-2 flex-wrap h-10 items-center gap-y-2"
      >
        <Dropdown
          text="Library"
          icon="university"
          floating
          labeled
          button
          className="icon"
          loading={loading}
          basic
        >
          <Dropdown.Menu className={MENU_CLASSES}>
            {libraryOptions.map((library) => (
              <Dropdown.Item
                key={library.key}
                onClick={() =>
                  setSelectedFilters({
                    ...selectedFilters,
                    bookLibrary: library.value,
                  })
                }
              >
                {library.text}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
        <Dropdown
          text="Subject"
          icon="filter"
          floating
          labeled
          button
          className="icon"
          loading={loading}
          basic
        >
          <Dropdown.Menu className={MENU_CLASSES}>
            {subjectOptions.map((subject) => (
              <Dropdown.Item
                key={subject.key}
                onClick={() =>
                  setSelectedFilters({
                    ...selectedFilters,
                    bookSubject: subject.value,
                  })
                }
              >
                {subject.text}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
        <Dropdown
          text="Location"
          icon="globe"
          floating
          labeled
          button
          className="icon"
          loading={loading}
          basic
        >
          <Dropdown.Menu className={MENU_CLASSES}>
            {locationOptions.map((location) => (
              <Dropdown.Item
                key={location.key}
                onClick={() =>
                  setSelectedFilters({ bookLocation: location.value })
                }
              >
                {location.text}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
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
                    bookLicense: license.value,
                  })
                }
              >
                {license.text}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
        {showAdvanced && (
          <>
            <Dropdown
              text="Author"
              icon="user"
              floating
              labeled
              button
              className="icon"
              loading={loading}
              basic
            >
              <Dropdown.Menu className={MENU_CLASSES}>
                {authorOptions.map((author) => (
                  <Dropdown.Item
                    key={author.key}
                    onClick={() =>
                      setSelectedFilters({
                        ...selectedFilters,
                        bookAuthor: author.value,
                      })
                    }
                  >
                    {author.text}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
            <Dropdown
              text="Course"
              icon="users"
              floating
              labeled
              button
              className="icon"
              loading={loading}
              basic
            >
              <Dropdown.Menu className={MENU_CLASSES}>
                {courseOptions.map((course) => (
                  <Dropdown.Item
                    key={course.key}
                    onClick={() =>
                      setSelectedFilters({
                        ...selectedFilters,
                        bookCourse: course.value,
                      })
                    }
                  >
                    {course.text}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
            <Dropdown
              text="Publisher"
              icon="print"
              floating
              labeled
              button
              className="icon"
              loading={loading}
              basic
            >
              <Dropdown.Menu className={MENU_CLASSES}>
                {pubOptions.map((publisher) => (
                  <Dropdown.Item
                    key={publisher.key}
                    onClick={() =>
                      setSelectedFilters({
                        ...selectedFilters,
                        bookPublisher: publisher.value,
                      })
                    }
                  >
                    {publisher.text}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
            <Dropdown
              text="Affiliation"
              icon="filter"
              floating
              labeled
              button
              className="icon"
              loading={loading}
              basic
            >
              <Dropdown.Menu className={MENU_CLASSES}>
                {affOptions.map((affiliation) => (
                  <Dropdown.Item
                    key={affiliation.key}
                    onClick={() =>
                      setSelectedFilters({
                        ...selectedFilters,
                        bookAffiliation: affiliation.value,
                      })
                    }
                  >
                    {affiliation.text}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
            <Dropdown
              text="C-ID"
              icon="hashtag"
              floating
              labeled
              button
              className="icon"
              loading={loading}
              basic
            >
              <Dropdown.Menu className={MENU_CLASSES}>
                {cidOptions.map((cid) => (
                  <Dropdown.Item
                    key={cid.key}
                    onClick={() =>
                      setSelectedFilters({
                        ...selectedFilters,
                        bookCID: cid.value,
                      })
                    }
                  >
                    {cid.text}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
          </>
        )}
        <p
          className="ml-2 cursor-pointer"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Icon
            name={showAdvanced ? "minus circle" : "plus circle"}
            color="blue"
          />
        </p>
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
  }
);

export default CatalogBookFilters;
