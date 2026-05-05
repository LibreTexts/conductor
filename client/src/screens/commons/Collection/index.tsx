import "../../../components/commons/Commons.css";
import {
  Breadcrumb,
  Button,
  Divider,
  Grid,
  Heading,
  IconButton,
  Input,
  Select,
  Spinner,
  Stack,
  Text,
} from "@libretexts/davis-react";
import type { SelectOption } from "@libretexts/davis-react";
import {
  IconArrowDown,
  IconDownload,
  IconLayoutGrid,
  IconList,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import { useLocation } from "react-router-dom-v5-compat";
import React, { useEffect, useState } from "react";
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
import useDebounce from "../../../hooks/useDebounce";
import { checkIsCollection } from "../../../components/util/TypeHelpers";
import DOMPurify from "dompurify";
import { marked } from "marked";

const limit = 12;
const BASE_PATH = "/collections";

const getIDFromPath = (path?: string): string => {
  if (!path) return "";
  if (path === BASE_PATH) return "";
  if (path.endsWith("/")) path = path.slice(0, -1);
  const lastValue = path.split("/").pop();
  return lastValue || "";
};

const getDynamicPath = (path?: string): string => {
  if (!path) return "";
  const pathWithoutBase = path.replace(BASE_PATH, "");
  return pathWithoutBase;
};

const CommonsCollection: React.FC<{}> = () => {
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();
  const { pathname } = useLocation();
  const id = getIDFromPath(pathname);
  const dynamicPath = getDynamicPath(pathname);
  const org = useTypedSelector((state) => state.org);
  const queryClient = useQueryClient();
  const [sort, setSort] = useState("title");
  const [searchInput, setSearchInput] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [itemizedMode, setItemizedMode] = useState(false);
  const [jumpToBottomClicked, setJumpToBottomClicked] = useState(false);
  const [loadingDisabled, setLoadingDisabled] = useState(false);

  const jumpToBottom = () => {
    setLoadingDisabled(true);
    setJumpToBottomClicked(true);
    window.scrollTo(0, document.body.scrollHeight);
  };

  useEffect(() => {
    queryClient.setQueryData(["collection-resource"], () => ({
      pages: [],
      pageParams: [],
    }));
  }, [pathname]);

  useEffect(() => {
    DOMPurify.addHook("afterSanitizeAttributes", function (node) {
      if ("target" in node) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
  }, []);

  const rootSortOptions: SelectOption[] = [
    { value: "title", label: "Sort by Title" },
    { value: "program", label: "Sort by Program" },
  ];

  const collectionSortOptions: SelectOption[] = [
    { value: "title", label: "Sort by Title" },
    { value: "author", label: "Sort by Author" },
    { value: "resourceType", label: "Sort by Type" },
  ];

  const { data: collection, isFetching: collectionLoading } = useQuery({
    queryKey: ["collection", pathname],
    queryFn: getCollection,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5,
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
    queryFn: ({ pageParam = 1 }) =>
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

  const loadMore = async () => {
    if (hasNextPage) {
      await fetchNextPage();
    }
  };
  const hasMore = hasNextPage || false;
  const isLoading = resourcesLoading;

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

  useEffect(() => {
    if (org.orgID !== "libretexts" && collection?.title !== "") {
      document.title = `${org.shortName} Commons | Collections | ${collection?.title}`;
    } else if (org.orgID === "libretexts" && collection?.title !== "") {
      document.title = `LibreCommons | Collections | ${collection?.title}`;
    } else {
      document.title = `LibreCommons | Collection`;
    }
  }, [org, collection?.title, pathname]);

  const getToLink = (item: Collection | CollectionResource) => {
    if ("resourceData" in item) {
      if (checkIsCollection(item.resourceData)) {
        const toLink =
          (pathname.endsWith("/") ? pathname : `${pathname}/`) +
          encodeURIComponent(item.resourceData.title);
        return toLink;
      }
    }
    return undefined;
  };

  const Breadcrumbs = () => {
    const elements = dynamicPath.split("/").filter((el) => el !== "");

    const linkPathForIndex = (index: number) => {
      return BASE_PATH + "/" + elements.slice(0, index + 1).join("/");
    };

    return (
      <Breadcrumb aria-label="Collection navigation">
        <Breadcrumb.Item href="/collections">
          {org.collectionsDisplayLabel || "Collections"}
        </Breadcrumb.Item>
        {elements.map((el, i) => (
          <Breadcrumb.Item
            key={i}
            href={i === elements.length - 1 ? undefined : linkPathForIndex(i)}
            isCurrent={i === elements.length - 1}
          >
            {decodeURIComponent(el)}
          </Breadcrumb.Item>
        ))}
      </Breadcrumb>
    );
  };

  const VisualMode = () => {
    if (resourcesLoaded && resources.pages.length > 0) {
      return (
        <Grid className="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {resources.pages.map((p) => {
            return p.data.map((item: Collection | CollectionResource) => (
              <CollectionCard
                key={crypto.randomUUID()}
                item={item}
                to={getToLink(item)}
              />
            ));
          })}
        </Grid>
      );
    } else {
      return (
        <Text className="text-center" role="alert">
          <em>No results found.</em>
        </Text>
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

  return (
    <Stack direction="vertical" gap="lg" className="p-6">
      {id && (
        <div className="px-6 pt-4">
          <Breadcrumbs />
        </div>
      )}

      <div>
        <Heading level={1} className="text-center lg:text-left">
          {id
            ? collection?.title
            : org.collectionsDisplayLabel || "Collections"}
        </Heading>
        <div
          className="text-lg text-center lg:text-left prose prose-code:before:hidden prose-code:after:hidden max-w-full mt-2"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(
              marked(
                id
                  ? collection?.description || ""
                  : org.collectionsMessage || "",
                { breaks: true }
              )
            ),
          }}
        />
      </div>
      <Divider />
      <div className="flex flex-row items-end justify-center w-full gap-2">
        <Input
          name="collection-search"
          label="Search collections"
          placeholder="Search..."
          leftIcon={<IconSearch />}
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            handleSearchChange(e.target.value);
          }}
          className="w-full max-w-lg"
        />
        <Button
          variant="primary"
          onClick={() => handleSearchChange(searchInput)}
          icon={<IconSearch />}
          iconPosition="left"
        >
          Search {org.collectionsDisplayLabel || "Collections"}
        </Button>
      </div>

      <div className="flex flex-row justify-between items-center px-6">
        <Select
          name="collection-sort"
          label="Sort results"
          placeholder="Sort by..."
          options={id ? collectionSortOptions : rootSortOptions}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort results by"
        />
        <div className="flex items-center gap-1">
          <IconButton
            variant="outline"
            size="sm"
            tooltip={
              jumpToBottomClicked
                ? "Refresh to continue browsing"
                : "Jump to bottom"
            }
            aria-label={
              jumpToBottomClicked
                ? "Refresh to continue browsing"
                : "Jump to bottom"
            }
            onClick={() =>
              jumpToBottomClicked
                ? window.location.reload()
                : jumpToBottom()
            }
            icon={
              jumpToBottomClicked ? (
                <IconRefresh size={16} />
              ) : (
                <IconArrowDown size={16} />
              )
            }
          />
          <IconButton
            variant="outline"
            size="sm"
            tooltip={
              itemizedMode
                ? "Switch to visual mode"
                : "Switch to itemized mode"
            }
            aria-label={
              itemizedMode
                ? "Switch to visual mode"
                : "Switch to itemized mode"
            }
            onClick={() => setItemizedMode(!itemizedMode)}
            icon={
              itemizedMode ? (
                <IconLayoutGrid size={16} />
              ) : (
                <IconList size={16} />
              )
            }
          />
        </div>
      </div>

      <div className="min-h-[800px] px-6 pb-6" aria-busy={collectionLoading || resourcesLoading}>
        {collectionLoading || resourcesLoading ? (
          <div className="flex justify-center items-center p-16">
            <Spinner />
          </div>
        ) : (
          <>
            {itemizedMode ? <ItemizedMode /> : <VisualMode />}

            {hasMore && (
              <div className="w-full mt-6 flex justify-center">
                <Button
                  variant="primary"
                  onClick={loadMore}
                  disabled={isLoading}
                  aria-label="Load more resources"
                  icon={<IconDownload size={16} />}
                >
                  {isLoading ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}

            {resources &&
              !hasMore &&
              resources.pages &&
              resources.pages.length > 0 && (
                <div className="w-full mt-4">
                  <Text className="text-center font-semibold">
                    End of results
                  </Text>
                </div>
              )}
          </>
        )}
      </div>
    </Stack>
  );
};

export default CommonsCollection;
