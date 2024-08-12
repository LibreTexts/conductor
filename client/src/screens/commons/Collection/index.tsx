import "../../../components/commons/Commons.css";
import {
  Breadcrumb,
  Dropdown,
  Grid,
  Header,
  Icon,
  Input,
  Popup,
  Segment,
} from "semantic-ui-react";
import Breakpoint from "../../../components/util/Breakpoints";
import { Link, useLocation } from "react-router-dom-v5-compat";
import React, { Fragment, useEffect, useState } from "react";
import useGlobalError from "../../../components/error/ErrorHooks";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTypedSelector } from "../../../state/hooks";
import api from "../../../api";
import { Collection, CollectionResource } from "../../../types";
import CollectionCard from "../../../components/Collections/CollectionCard";
import CollectionTable from "../../../components/Collections/CollectionTable";
import useInfiniteScroll from "../../../hooks/useInfiniteScroll";
import useDebounce from "../../../hooks/useDebounce";
import { checkIsCollection } from "../../../components/util/TypeHelpers";
const limit = 12;
const BASE_PATH = "/collections";

const getIDFromPath = (path?: string): string => {
  if (!path) return "";
  if (path === BASE_PATH) return "";
  const lastValue = path.split("/").pop();
  return lastValue || "";
}

const getDynamicPath = (path?: string): string => {
  // remove BASE_PATH from path
  if (!path) return "";
  const pathWithoutBase = path.replace(BASE_PATH, "");
  return pathWithoutBase
}

const CommonsCollection: React.FC<{}> = () => {
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();
  const { pathname } = useLocation();
  const id = getIDFromPath(pathname);
  const dynamicPath = getDynamicPath(pathname);
  const org = useTypedSelector((state) => state.org);
  const queryClient = useQueryClient();
  const [sort, setSort] = useState("title");
  const [searchInput, setSearchInput] = useState<string>(""); // ui search input only
  const [query, setQuery] = useState<string>(""); // actual query
  const [itemizedMode, setItemizedMode] = useState(false);
  const [jumpToBottomClicked, setJumpToBottomClicked] = useState(false);
  const [loadingDisabled, setLoadingDisabled] = useState(false);

  const jumpToBottom = () => {
    setLoadingDisabled(true);
    setJumpToBottomClicked(true);
    window.scrollTo(0, document.body.scrollHeight);
  };

  useEffect(() => {
    // Reset pagination when navigating to a new collection
    queryClient.setQueryData(["collection-resource"], () => ({
      pages: [],
      pageParams: [],
    }));
  }, [pathname]);

  const rootSortOptions = [
    { key: "title", text: "Sort by Title", value: "title" },
    { key: "program", text: "Sort by Program", value: "program" },
  ];

  const collectionSortOptions = [
    { key: "title", text: "Sort by Title", value: "title" },
    { key: "author", text: "Sort by Author", value: "author" },
    { key: "type", text: "Sort by Type", value: "resourceType" },
  ];

  const { data: collection, isFetching: collectionLoading } = useQuery({
    queryKey: ["collection", pathname],
    queryFn: getCollection,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!id && !loadingDisabled,
  });

  const {
    data: resources,
    isFetching: resourcesLoading,
    isSuccess: resourcesLoaded,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery<{
    data: Collection[] | CollectionResource[];
    total_items: number;
    cursor?: number;
  }>({
    queryKey: ["collection-resources", id, sort, limit, query, pathname],
    queryFn: ({ pageParam = 1 },) =>
      !!id
        ? getCollectionResources({
          collIDOrTitle: id,
          limit,
          page: pageParam,
          query,
          sort,
        })
        : getCommonsCollections({
          limit,
          page: pageParam,
          query,
          sort,
        }),
    enabled: !loadingDisabled,
    refetchOnWindowFocus: false,
    getNextPageParam: (lastPage) => {
      if (!lastPage || !lastPage.cursor) return undefined;
      if (lastPage.total_items > lastPage.cursor) {
        return Math.round(lastPage.cursor / limit) + 1;
      }
      return undefined;
    },
  });

  const { lastElementRef } = useInfiniteScroll({
    next: async () => {
      if (hasNextPage) {
        await fetchNextPage();
      }
    },
    hasMore: hasNextPage || false,
    isLoading: resourcesLoading,
  });

  async function getCollection() {
    try {
      const collRes = await api.getCollection(id);
      if (collRes.data.err) {
        throw new Error(collRes.data.errMsg);
      }
      return collRes.data.collection;
    } catch (err) {
      handleGlobalError(err);
      return null;
    }
  }

  async function getCollectionResources(input: {
    collIDOrTitle?: string;
    limit?: number;
    page?: number;
    query?: string | null;
    sort?: string;
  }) {
    if (!input.collIDOrTitle)
      return { data: [], total_items: 0, cursor: undefined };

    // if the sort option is not valid, default to the first option
    if (
      !collectionSortOptions.map((opt) => opt.value).includes(input.sort || "")
    ) {
      input.sort = collectionSortOptions[0].value;
      setSort(collectionSortOptions[0].value);
    }

    try {
      const collRes = await api.getCollectionResources(input);
      if (collRes.data.err) {
        throw new Error(collRes.data.errMsg);
      }
      return {
        data: collRes.data.resources,
        total_items: collRes.data.total_items,
        cursor: collRes.data.cursor || undefined,
      };
    } catch (err) {
      handleGlobalError(err);
      return {
        data: [],
        total_items: 0,
        cursor: undefined,
      };
    }
  }

  async function getCommonsCollections(input: {
    limit?: number;
    page?: number;
    query?: string | null;
    sort?: string;
  }) {
    try {
      // if the sort option is not valid, default to the first option
      if (!rootSortOptions.map((opt) => opt.value).includes(input.sort || "")) {
        input.sort = rootSortOptions[0].value;
        setSort(rootSortOptions[0].value);
      }

      const collRes = await api.getCommonsCollections(input);
      if (collRes.data.err) {
        throw new Error(collRes.data.errMsg);
      }

      return {
        data: collRes.data.collections,
        total_items: collRes.data.total_items,
        cursor: collRes.data.cursor || undefined,
      };
    } catch (err) {
      handleGlobalError(err);
      return {
        data: [],
        total_items: 0,
        cursor: undefined,
      };
    }
  }

  const handleSearchChange = debounce((newQuery: string) => {
    queryClient.setQueryData(["collection-resources"], {
      pages: [],
      pageParams: [],
    });
    setQuery(newQuery);
  }, 150);

  /**
   * Update the page title based on Organization information.
   */
  useEffect(() => {
    if (org.orgID !== "libretexts" && collection?.title !== "") {
      document.title = `${org.shortName} Commons | Collections | ${collection?.title}`;
    } else if (org.orgID === "libretexts" && collection?.title !== "") {
      document.title = `LibreCommons | Collections | ${collection?.title}`;
    } else {
      document.title = `LibreCommons | Collection`;
    }
  }, [org, collection?.title, pathname]);

  const VisualMode = () => {
    if (resourcesLoaded && resources.pages.length > 0) {
      return (
        <div className="commons-content-card-grid">
          {resources.pages.map((p) => {
            return p.data.map((item: Collection | CollectionResource) => (
              <CollectionCard key={crypto.randomUUID()} item={item} to={"resourceData" in item && checkIsCollection(item.resourceData) ? `${pathname}/${encodeURIComponent(item.resourceData.title)}` : undefined} />
            ));
          })}
        </div>
      );
    } else {
      return (
        <p className="text-center">
          <em>No results found.</em>
        </p>
      );
    }
  };

  const ItemizedMode = () => {
    return (
      <CollectionTable
        data={
          (resources?.pages.map((p) => p.data).flat() as
            | Collection[]
            | CollectionResource[]) || []
        }
        loading={resourcesLoading}
      />
    );
  };

  const Breadcrumbs = () => {
    const elements = dynamicPath.split("/").filter((el) => el !== "");

    const linkPathForIndex = (index: number) => {
      return BASE_PATH + "/" + elements.slice(0, index + 1).join("/");
    };

    return (<Breadcrumb>
      <Breadcrumb.Section as={Link} to="/collections">
        <span>
          <span className="muted-text">You are on: </span>
          Collections
        </span>
      </Breadcrumb.Section>
      {elements.map((el, i) => (
        <Fragment key={i}>
          <Breadcrumb.Divider icon="right chevron" />
          <Breadcrumb.Section as={
            i === elements.length - 1
              ? "span"
              : Link
          } to={
            i === elements.length - 1
              ? undefined
              : linkPathForIndex(i)
          }>
            {el}
          </Breadcrumb.Section>
        </Fragment>
      ))}
    </Breadcrumb>
    )
  }

  return (
    <Grid className="commons-container">
      <Grid.Row>
        <Grid.Column>
          <Segment.Group raised>
            {id && (
              <Segment>
                <Breadcrumbs />
              </Segment>
            )}
            <Segment>
              <Breakpoint name="desktop">
                <Header size="large" as="h2">
                  {id ? collection?.title : "Collections"}
                </Header>
              </Breakpoint>
              <Breakpoint name="mobileOrTablet">
                <Header size="large" textAlign="center">
                  {id ? collection?.title : "Collections"}
                </Header>
              </Breakpoint>
            </Segment>
            <Segment>
              <div className="flex flex-row justify-center w-full">
                <Input
                  icon="search"
                  placeholder="Search..."
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    handleSearchChange(e.target.value);
                  }}
                  value={searchInput}
                  fluid
                  className="commons-filter w-1/2"
                />
              </div>
            </Segment>
            <Segment>
              <div className="flex flex-row justify-between items-center">
                <div className="flex flex-row justify-start items-center">
                  <Dropdown
                    placeholder="Sort by..."
                    floating
                    selection
                    button
                    className="commons-filter"
                    options={
                      id ? collectionSortOptions : rootSortOptions
                    }
                    onChange={(_e, { value }) => {
                      setSort(value as string);
                    }}
                    value={sort}
                    aria-label="Sort results by"
                  />
                </div>
                <div className="flex flex-row items-center mb-1 justify-end">
                  <Popup
                    trigger={
                      <button
                        onClick={() => {
                          jumpToBottomClicked
                            ? window.location.reload()
                            : jumpToBottom();
                        }}
                        className="bg-slate-100 text-black border border-slate-300 rounded-md mr-2 !pl-1.5 p-1 shadow-sm hover:shadow-md"
                        aria-label={
                          jumpToBottomClicked
                            ? "Refresh to continue browsing"
                            : "Jump to bottom"
                        }
                      >
                        {jumpToBottomClicked ? (
                          <Icon name="refresh" />
                        ) : (
                          <Icon name="arrow down" />
                        )}
                      </button>
                    }
                    content={
                      jumpToBottomClicked
                        ? "Refresh to continue browsing"
                        : "Jump to bottom"
                    }
                  />
                  <Popup
                    trigger={
                      <button
                        onClick={() => setItemizedMode(!itemizedMode)}
                        className="bg-slate-100 text-black border border-slate-300 rounded-md !pl-1.5 p-1 shadow-sm hover:shadow-md"
                        aria-label={
                          itemizedMode
                            ? "Switch to visual mode"
                            : "Switch to itemized mode"
                        }
                      >
                        {itemizedMode ? (
                          <Icon name="grid layout" />
                        ) : (
                          <Icon name="list layout" />
                        )}
                      </button>
                    }
                    content={
                      itemizedMode
                        ? "Switch to visual mode"
                        : "Switch to itemized mode"
                    }
                  />
                </div>
              </div>
            </Segment>
            <Segment
              className='!pb-4 min-h-[800px]'
              loading={collectionLoading || resourcesLoading}
            >
              {itemizedMode ? <ItemizedMode /> : <VisualMode />}
              <div ref={lastElementRef}></div>
              {resources && !hasNextPage && (
                <div className="w-full mt-4">
                  <p className="text-center font-semibold">End of results</p>
                </div>
              )}
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CommonsCollection;
