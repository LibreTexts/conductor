import { Grid, Header, Segment } from "semantic-ui-react";
import { useDocumentTitle } from "usehooks-ts";
import {
  BooksManagerSortOptions,
  BookWithAutoMatched,
} from "../../../../types";
import Button from "../../../../components/NextGenComponents/Button";
import SupportCenterTable from "../../../../components/support/SupportCenterTable";
import { getLicenseText } from "../../../../components/util/LicenseOptions";
import { getLibraryName } from "../../../../components/util/LibraryOptions";
import { useTypedSelector } from "../../../../state/hooks";
import useMasterCatalogV2 from "../../../../hooks/useMasterCatalogV2";
import useCommonsCatalogBooks, {
  COMMONS_CATALOG_QUERY_KEY,
} from "../../../../hooks/useCommonsCatalogBooks";
import { useMemo, useState } from "react";
import Combobox from "../../../../components/NextGenInputs/Combobox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../../api";
import { useNotifications } from "../../../../context/NotificationContext";
import BooksManagerHeader from "./BooksManagerHeader";
import Input from "../../../../components/NextGenInputs/Input";
import { IconSearch } from "@tabler/icons-react";
import useDebounce from "../../../../hooks/useDebounce";
import {
  BOOKS_MANAGER_SORT_OPTIONS,
  filterBooksBySearchTerm,
  sortBooks,
} from "../../../../utils/booksManagerHelpers";

type BookWithEnabled = BookWithAutoMatched & { enabled: boolean };

const MasterCatalogPlainView = () => {
  useDocumentTitle("LibreTexts Conductor | Master Catalog");
  const org = useTypedSelector((state) => state.org);
  const { debounce } = useDebounce();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  const [sortOption, setSortOption] =
    useState<BooksManagerSortOptions>("title_asc");
  const [searchTermUI, setSearchTermUI] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const debouncedSetSearchTerm = useMemo(
    () =>
      debounce((term: string) => {
        setSearchTerm(term);
      }, 400),
    [debounce]
  );

  const { data: commonsData } = useCommonsCatalogBooks({ limit: 10000 });
  const { data, isLoading } = useMasterCatalogV2();

  const onMutateCallback = async (book: BookWithEnabled) => {
    const previousData = queryClient.getQueryData(COMMONS_CATALOG_QUERY_KEY);

    queryClient.setQueryData(COMMONS_CATALOG_QUERY_KEY, (old: any) => {
      if (!old || !Array.isArray(old)) return old;

      // Check current state in cache, not the passed book.enabled value
      const isCurrentlyEnabled = old.some((b: any) => b.bookID === book.bookID);

      if (isCurrentlyEnabled) {
        return old.filter((b: any) => b.bookID !== book.bookID);
      } else {
        return [...old, { ...book, enabled: true }];
      }
    });

    return { previousData };
  };

  const onErrorCallback = (err: any, variables: any, context: any) => {
    if (context?.previousData) {
      queryClient.setQueryData(COMMONS_CATALOG_QUERY_KEY, context.previousData);
    }
  };

  const onSettledCallback = () => {
    addNotification({
      type: "success",
      message: "Changes saved successfully.",
    });
  };

  const affectBook = useMutation({
    mutationFn: async (book: BookWithEnabled) => {
      const currentCommonsData = queryClient.getQueryData(
        COMMONS_CATALOG_QUERY_KEY
      ) as BookWithEnabled[] | undefined;
      const isCurrentlyEnabled = currentCommonsData?.some(
        (b) => b.bookID === book.bookID
      );

      const apiEndpoint = isCurrentlyEnabled
        ? api.disableBookOnCommons
        : api.enableBookOnCommons;
      const res = await apiEndpoint(book.bookID);
      return res.data;
    },
    onMutate: onMutateCallback,
    onError: onErrorCallback,
    onSettled: onSettledCallback,
  });

  const excludeAutoMatchedBook = useMutation({
    mutationFn: async (book: BookWithEnabled) => {
      const res = await api.excludeBookFromAutoCatalogMatching(book.bookID);
      return res.data;
    },
    onMutate: onMutateCallback,
    onError: onErrorCallback,
    onSettled: onSettledCallback,
  });

  const mappedData = useMemo(() => {
    if (!data) return [];

    const enabledBookIDsSet = new Set<string>(
      commonsData?.map((b) => b.bookID) || []
    );

    const autoMatchedBookIDs = new Set<string>(
      commonsData?.filter((b) => b.autoMatched).map((b) => b.bookID) || []
    );

    const bookMap = new Map<string, BookWithEnabled>();

    data.libraries.forEach((library) => {
      library.courses.forEach((course) => {
        course.books.forEach((book) => {
          if (!bookMap.has(book.bookID)) {
            bookMap.set(book.bookID, {
              ...book,
              enabled: enabledBookIDsSet.has(book.bookID),
              autoMatched: autoMatchedBookIDs.has(book.bookID),
            });
          }
        });
      });

      library.subjects.forEach((subject) => {
        subject.books.forEach((book) => {
          if (!bookMap.has(book.bookID)) {
            bookMap.set(book.bookID, {
              ...book,
              enabled: enabledBookIDsSet.has(book.bookID),
              autoMatched: autoMatchedBookIDs.has(book.bookID),
            });
          }
        });
      });
    });

    const filteredBooks = filterBooksBySearchTerm(
      Array.from(bookMap.values()),
      searchTerm
    );

    return sortBooks(filteredBooks, sortOption);
  }, [data, commonsData, sortOption, searchTerm]);

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header">Books Manager</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <BooksManagerHeader isMasterCatalogView={true} />
            <Segment>
              <div className="flex justify-between items-center mb-2 px-1">
                <h2 className="max-w-none text-lg font-medium text-gray-900 ">
                  This is a plain view of the LibreTexts Master Catalog, listing
                  all books available across all libraries, subjects, and
                  courses. Here, you can add or remove books from your
                  organization's custom Commons catalog.
                </h2>
                <div className="flex items-center gap-2 w-1/2 justify-end">
                  <Input
                    name="availableSearch"
                    placeholder="Search by title, author, ID, or URL..."
                    label=""
                    leftIcon={<IconSearch size={16} />}
                    value={searchTermUI}
                    onChange={(e) => {
                      setSearchTermUI(e.target.value);
                      debouncedSetSearchTerm(e.target.value);
                    }}
                    className="mb-1.5 max-w-xl w-full"
                  />
                  <Combobox
                    name="sortBy"
                    label=""
                    placeholder="Sort by..."
                    items={BOOKS_MANAGER_SORT_OPTIONS}
                    multiple={false}
                    value={sortOption}
                    onChange={(newVal) =>
                      setSortOption(newVal as BooksManagerSortOptions)
                    }
                    loading={isLoading}
                  />
                </div>
              </div>
              <div className="">
                <SupportCenterTable<BookWithEnabled>
                  loading={isLoading}
                  data={mappedData}
                  estimatedRowHeight={45}
                  enableVirtualization={true}
                  maxHeight="1000px"
                  onRowClick={(record) => {
                    window.open(`/book/${record.bookID}`, "_blank");
                  }}
                  columns={[
                    {
                      accessor: "title",
                      title: "Title",
                      render(record) {
                        return (
                          <span className="font-semibold">{record.title}</span>
                        );
                      },
                    },
                    {
                      accessor: "bookID",
                      title: "ID",
                    },
                    {
                      accessor: "library",
                      title: "Library",
                      render(record) {
                        return <span>{getLibraryName(record.library)}</span>;
                      },
                    },
                    {
                      accessor: "author",
                      title: "Author",
                      render(record) {
                        return <span>{record.author || "Unknown Author"}</span>;
                      },
                    },
                    {
                      accessor: "course",
                      title: "Course",
                      render(record) {
                        return <span>{record.course}</span>;
                      },
                    },
                    {
                      accessor: "license",
                      title: "License",
                      render(record) {
                        return <span>{getLicenseText(record.license)}</span>;
                      },
                    },
                    {
                      accessor: "actions",
                      title: "Actions",
                      render(record) {
                        if (
                          !org.autoCatalogMatchingDisabled &&
                          record.autoMatched
                        ) {
                          return (
                            <Button
                              variant="secondary"
                              icon="IconMinus"
                              size="small"
                              disabled={org.orgID === "libretexts"}
                              onClick={(e) => {
                                e.stopPropagation();
                                excludeAutoMatchedBook.mutate(record);
                              }}
                            >
                              Exclude Automatic Match
                            </Button>
                          );
                        }
                        return (
                          <Button
                            variant={record.enabled ? "secondary" : "primary"}
                            icon={record.enabled ? "IconMinus" : "IconPlus"}
                            disabled={org.orgID === "libretexts"}
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              affectBook.mutate(record);
                            }}
                          >
                            {record.enabled
                              ? "Remove from Custom Catalog"
                              : "Add to Custom Catalog"}
                          </Button>
                        );
                      },
                    },
                  ]}
                />
                <p className="my-4 text-gray-600 text-center">
                  Total Books: {mappedData.length}
                </p>
              </div>
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default MasterCatalogPlainView;
