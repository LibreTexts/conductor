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
import useCommonsCatalogBooks from "../../../../hooks/useCommonsCatalogBooks";
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
import Tooltip from "../../../../components/util/Tooltip";

type BookWithEnabled = BookWithAutoMatched & { enabled: boolean };

const MasterCatalogPlainView = () => {
  useDocumentTitle("LibreTexts Conductor | Master Catalog");
  const org = useTypedSelector((state) => state.org);
  const { debounce } = useDebounce();
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  const user = useTypedSelector((state) => state.user);
  const queriesEnabled =
    user.isSuperAdmin || user.isCampusAdmin || user.isSupport;

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

  const {
    data: commonsData,
    invalidate,
    useCommonsCatalogQueryKey,
  } = useCommonsCatalogBooks({
    enabled: queriesEnabled,
  });
  const { data, isLoading } = useMasterCatalogV2({
    enabled: queriesEnabled,
  });

  const enabledBookIDs = useMemo(() => {
    return new Set<string>(commonsData?.map((b) => b.bookID) || []);
  }, [commonsData]);

  const autoMatchedBookIDs = useMemo(() => {
    return new Set<string>(
      commonsData?.filter((b) => b.autoMatched).map((b) => b.bookID) || []
    );
  }, [commonsData]);

  const onMutateCallback = async (book: BookWithEnabled) => {
    await queryClient.cancelQueries({ queryKey: useCommonsCatalogQueryKey });
    const previousData = queryClient.getQueryData(useCommonsCatalogQueryKey);

    queryClient.setQueryData(useCommonsCatalogQueryKey, (old: any) => {
      if (!old) return old;

      if (book.enabled) {
        return old.filter((b: any) => b.bookID !== book.bookID);
      } else {
        return [...old, { ...book, enabled: true }];
      }
    });

    return { previousData };
  };

  const onErrorCallback = (err: any, variables: any, context: any) => {
    if (context?.previousData) {
      queryClient.setQueryData(useCommonsCatalogQueryKey, context.previousData);
    }
  };

  const onSettledCallback = () => {
    invalidate();
    addNotification({
      type: "success",
      message: "Changes saved successfully.",
    });
  };

  const affectBook = useMutation({
    mutationFn: async (book: BookWithEnabled) => {
      const apiEndpoint = book.enabled
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

  const masterCatalogBooks = useMemo(() => {
    if (!data) return [];

    const currentBookIDsSet = new Set<string>(
      commonsData?.map((b) => b.bookID) || []
    );

    const bookMap = new Map<string, BookWithEnabled>();

    data.libraries.forEach((library) => {
      library.courses.forEach((course) => {
        course.books.forEach((book) => {
          if (!bookMap.has(book.bookID)) {
            bookMap.set(book.bookID, {
              ...book,
              enabled: currentBookIDsSet.has(book.bookID),
            });
          }
        });
      });

      library.subjects.forEach((subject) => {
        subject.books.forEach((book) => {
          if (!bookMap.has(book.bookID)) {
            bookMap.set(book.bookID, {
              ...book,
              enabled: currentBookIDsSet.has(book.bookID),
            });
          }
        });
      });
    });

    return sortBooks(Array.from(bookMap.values()), sortOption);
  }, [data]);

  const mappedData = useMemo(() => {
    const booksWithEnabled: BookWithEnabled[] = masterCatalogBooks.map(
      (book) => ({
        ...book,
        enabled: enabledBookIDs.has(book.bookID),
        autoMatched: autoMatchedBookIDs.has(book.bookID),
      })
    );

    const filteredBooks = filterBooksBySearchTerm(booksWithEnabled, searchTerm);

    return sortBooks(filteredBooks, sortOption);
  }, [
    masterCatalogBooks,
    enabledBookIDs,
    autoMatchedBookIDs,
    sortOption,
    searchTerm,
  ]);

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
