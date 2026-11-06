import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useDebounceValue, useDocumentTitle } from "usehooks-ts";
import {
  Breadcrumb,
  Button,
  Card,
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
import type { ColumnDef } from "@libretexts/davis-react-table";
import {
  IconDownload,
  IconLayoutGrid,
  IconList,
  IconSearch,
} from "@tabler/icons-react";
import api from "../../../api";
import AccessibleDataTable from "../../../components/commons/AccessibleDataTable";
import { CommonsActivitiesParams, CommonsActivitySummary } from "../../../types";
import { getContentTypeIcon, getContentTypeName, toPlainText } from "../../../utils/activityHelpers";
import ActivityCardDetails from "../../../components/commons/ActivityCardDetails";
import { truncateString } from "../../../components/util/HelperFunctions.js";

const ITEMS_PER_LOAD = 24;

type SortKey = "updated" | "title" | "created";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "updated", label: "Recently updated" },
  { value: "created", label: "Newest" },
  { value: "title", label: "Title" },
];

/** Title reads A to Z. Dates read newest first. */
function sortDirectionFor(sort: SortKey): CommonsActivitiesParams["sortDirection"] {
  return sort === "title" ? "ascending" : "descending";
}

export const interactivePath = (activityID: string) => `/interactive/${activityID}`;

/**
 * Commons listing of H5P activities in the public catalog. Each card opens the
 * activity's page at `/interactive/:activityID`. Bare studio.libretexts.org
 * requests and Studio links the resolver can't match land here.
 */
const CommonsInteractives = () => {
  useDocumentTitle("LibreCommons | Interactives");

  const [displayChoice, setDisplayChoice] = useState<"visual" | "itemized">("visual");
  const [searchString, setSearchString] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [debouncedSearch] = useDebounceValue(searchString.trim(), 300);

  const { data, isLoading, isError, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useInfiniteQuery({
      queryKey: ["commons-interactives", debouncedSearch, sort],
      queryFn: async ({ pageParam = 1 }) => {
        const res = await api.getCommonsActivities({
          query: debouncedSearch || undefined,
          sort,
          sortDirection: sortDirectionFor(sort),
          page: pageParam,
          limit: ITEMS_PER_LOAD,
        });
        if (res.data.err) throw new Error(res.data.errMsg);
        return { activities: res.data.activities ?? [], total: res.data.total_items ?? 0, page: pageParam };
      },
      getNextPageParam: (last) =>
        last.page * ITEMS_PER_LOAD < last.total ? last.page + 1 : undefined,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    });

  const activities = useMemo(
    () => data?.pages.flatMap((p) => p.activities) ?? [],
    [data]
  );
  const total = data?.pages[0]?.total ?? 0;

  const columns: ColumnDef<CommonsActivitySummary>[] = [
    {
      id: "title",
      header: "Title",
      cell: ({ row }) => (
        <Link to={interactivePath(row.original.activityID)} className="font-bold">
          {row.original.title}
        </Link>
      ),
    },
    {
      id: "type",
      header: "Content type",
      cell: ({ row }) => <Text>{getContentTypeName(row.original) ?? "Unknown"}</Text>,
    },
    {
      id: "description",
      header: "Description",
      cell: ({ row }) => (
        <Text>{truncateString(toPlainText(row.original.description), 200)}</Text>
      ),
    },
  ];

  const VisualMode = () => (
    // Davis Grid rendered as a real <ul>. role="list" restores the list
    // semantics Chromium drops from a display:grid container (SC 1.3.1).
    <Grid
      as="ul"
      role="list"
      gap="md"
      className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[1600px]:grid-cols-5 min-[1920px]:grid-cols-6 list-none m-0 p-0"
    >
      {activities.map((item) => {
        const TypeIcon = getContentTypeIcon(item.library);
        const typeName = getContentTypeName(item);
        const description = toPlainText(item.description);
        return (
          <li key={item.activityID} className="h-full">
            <Card variant="elevated" className="relative flex h-full flex-col">
              <div
                className="flex h-14 items-center justify-center rounded-t-md bg-primary-50"
                aria-hidden="true"
              >
                <TypeIcon size={28} className="text-primary-600" />
              </div>
              <Card.Body className="flex flex-1 flex-col gap-1.5 p-3!">
                {typeName && (
                  <Text className="text-xs font-semibold uppercase text-neutral-600">{typeName}</Text>
                )}
                <Heading level={2} className="text-base! mt-0! mb-0! line-clamp-2 break-words">
                  {/* The stretched link makes the whole card clickable while
                      keeping one link per card for screen readers. */}
                  <Link
                    to={interactivePath(item.activityID)}
                    className="text-neutral-900 no-underline hover:underline after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                  >
                    {item.title}
                  </Link>
                </Heading>
                {description && <Text className="text-sm line-clamp-3">{description}</Text>}
                <ActivityCardDetails activity={item} className="mt-auto pt-1" />
              </Card.Body>
            </Card>
          </li>
        );
      })}
    </Grid>
  );

  const ItemizedMode = () => (
    <AccessibleDataTable<CommonsActivitySummary>
      data={activities}
      columns={columns}
      rowHeaderColumnId="title"
      caption="Interactive activities"
    />
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-12">
          <Spinner text="Loading interactives" />
        </div>
      );
    }
    if (isError) {
      return (
        <Stack direction="vertical" gap="sm" align="center" className="py-12">
          <Text role="alert">Interactives couldn't be loaded.</Text>
          <Button variant="primary" onClick={() => refetch()}>
            Try again
          </Button>
        </Stack>
      );
    }
    if (activities.length === 0) {
      return (
        <Text className="text-center italic" role="status">
          {debouncedSearch ? "No interactives match your search." : "No interactives available right now."}
        </Text>
      );
    }
    return displayChoice === "visual" ? <VisualMode /> : <ItemizedMode />;
  };

  return (
    <>
      <div className="px-6 py-3 border-b border-neutral-200">
        <Breadcrumb aria-label="Page navigation">
          <Breadcrumb.Item href="/catalog">Catalog</Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Interactives</Breadcrumb.Item>
        </Breadcrumb>
      </div>
      <Stack direction="vertical" gap="lg" className="p-6">
        <Stack direction="vertical" gap="md">
          <Heading level={1} className="text-center lg:text-left">
            Interactives
          </Heading>
          <Text>
            Interactive H5P activities you can use in a course or embed in a
            LibreTexts book: quizzes, interactive videos, flashcards, drag and
            drop exercises and more. Open an activity to try it, copy its link,
            or get its embed code.
          </Text>
        </Stack>
        <Divider />
        <div className="flex flex-row items-end justify-center w-full gap-2">
          <Input
            name="commons-interactives-search"
            label="Search interactives"
            placeholder="Search interactives..."
            leftIcon={<IconSearch />}
            value={searchString}
            onChange={(e) => setSearchString(e.target.value)}
            className="w-full max-w-lg"
          />
        </div>

        <div className="flex flex-row flex-wrap items-end justify-between gap-4">
          <Select
            name="commons-interactives-sort"
            label="Sort by"
            placeholder="Sort by..."
            options={SORT_OPTIONS}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          />
          <div className="flex items-center gap-4">
            {!isLoading && !isError && (
              <Text className="text-sm text-neutral-600" role="status">
                {total === 1 ? "1 interactive" : `${total.toLocaleString()} interactives`}
              </Text>
            )}
            <IconButton
              variant="outline"
              size="sm"
              tooltip={displayChoice === "visual" ? "Switch to itemized mode" : "Switch to visual mode"}
              aria-label={displayChoice === "visual" ? "Switch to itemized mode" : "Switch to visual mode"}
              onClick={() => setDisplayChoice(displayChoice === "visual" ? "itemized" : "visual")}
              icon={displayChoice === "visual" ? <IconList size={16} /> : <IconLayoutGrid size={16} />}
            />
          </div>
        </div>

        <div aria-busy={isLoading || isFetchingNextPage}>{renderContent()}</div>

        {!isLoading && !isError && activities.length > 0 && (
          hasNextPage ? (
            <div className="w-full mt-6 flex justify-center">
              <Button
                variant="primary"
                onClick={() => fetchNextPage()}
                loading={isFetchingNextPage}
                icon={<IconDownload size={16} />}
              >
                Load more
              </Button>
            </div>
          ) : (
            <Text className="text-center font-semibold mt-4">End of results</Text>
          )
        )}
      </Stack>
    </>
  );
};

export default CommonsInteractives;
