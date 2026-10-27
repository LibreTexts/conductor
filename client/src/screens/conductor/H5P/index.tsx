import { useEffect, useState } from "react";
import { Link, useHistory } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDebounceValue, useDocumentTitle, useMediaQuery } from "usehooks-ts";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Heading,
  Input,
  Menu,
  Pagination,
  Select,
  Skeleton,
  Spinner,
  Text,
  VisuallyHidden,
} from "@libretexts/davis-react";
import {
  IconAlertTriangle,
  IconBox,
  IconDotsVertical,
  IconEdit,
  IconExternalLink,
  IconFilterOff,
  IconLink,
  IconPlus,
  IconSearch,
  IconSearchOff,
  IconUpload,
} from "@tabler/icons-react";
import api from "../../../api";
import useH5PAuthoringEnabled from "../../../hooks/useH5PAuthoringEnabled";
import useCanCreateActivities from "../../../hooks/useCanCreateActivities";
import { ActivityVisibilityLevel, MyActivitiesParams, MyActivity } from "../../../types";
import {
  getContentTypeIcon,
  getContentTypeName,
} from "../../../utils/activityHelpers";

const PAGE_SIZE = 24;

/** Matches Tailwind's `sm`: below it, cards become compact rows. */
const ROWS_QUERY = "(max-width: 639px)";

type VisibilityFilter = MyActivitiesParams["visibility"];

const VISIBILITY_OPTIONS: { value: VisibilityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "public", label: "Public" },
  { value: "unlisted", label: "Unlisted" },
  { value: "private", label: "Private" },
];

const VISIBILITY_BADGES: Record<ActivityVisibilityLevel, { label: string; variant: "success" | "warning" | "default" }> = {
  public: { label: "Public", variant: "success" },
  unlisted: { label: "Unlisted", variant: "warning" },
  private: { label: "Private", variant: "default" },
};

const SORT_OPTIONS = [
  { value: "updated", label: "Last updated" },
  { value: "title", label: "Title" },
  { value: "created", label: "Date created" },
];

function updatedLabel(activity: MyActivity): string | undefined {
  if (!activity.updatedAt) return undefined;
  return `Updated ${formatDistanceToNow(parseISO(activity.updatedAt), { addSuffix: true })}`;
}

/**
 * The Visibility filter, drawn as a segmented control. Native radio inputs
 * give it arrow-key navigation and radio-group semantics for free; each
 * option shows how many results choosing it would give.
 */
const VisibilityFilterControl = ({
  value,
  counts,
  onChange,
  compact,
}: {
  value: VisibilityFilter;
  counts?: Record<VisibilityFilter, number>;
  onChange: (value: VisibilityFilter) => void;
  compact: boolean;
}) => (
  <fieldset className="m-0 min-w-0 border-0 p-0">
    <legend className={compact ? "sr-only" : "mb-1 text-sm font-medium text-neutral-900"}>Visibility</legend>
    <div
      className={
        compact
          ? "flex gap-2 overflow-x-auto pb-1"
          : "inline-flex overflow-hidden rounded-md border border-neutral-500"
      }
    >
      {VISIBILITY_OPTIONS.map((option, i) => {
        const checked = value === option.value;
        const count = counts?.[option.value];
        return (
          <label
            key={option.value}
            className={[
              "relative flex shrink-0 cursor-pointer items-center gap-1 px-4 text-sm font-medium",
              "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-500",
              compact ? "min-h-[44px] rounded-full border" : "min-h-[40px]",
              !compact && i > 0 ? "border-l border-neutral-500" : "",
              checked
                ? "border-primary-500 bg-primary-500 text-white"
                : "border-neutral-500 bg-white text-neutral-900 hover:bg-neutral-100",
            ].join(" ")}
          >
            <input
              type="radio"
              name="my-h5p-visibility"
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {/* The space keeps the accessible name "All 8", not "All8". */}
            {count !== undefined ? `${option.label} ` : option.label}
            {count !== undefined && <span>{count}</span>}
          </label>
        );
      })}
    </div>
  </fieldset>
);

const ContentTypeIcon = ({ activity, size }: { activity: MyActivity; size: number }) => {
  const TypeIcon = getContentTypeIcon(activity.library);
  return <TypeIcon size={size} className="text-primary-500" aria-hidden="true" />;
};

const ActivityBadges = ({ activity, size }: { activity: MyActivity; size?: "sm" | "md" }) => {
  const visibility = VISIBILITY_BADGES[activity.visibility];
  return (
    <div className="flex flex-wrap gap-2">
      <Badge label={visibility.label} variant={visibility.variant} dot size={size} />
      {activity.role === "collaborator" && <Badge label="Collaborator" variant="primary" size={size} />}
    </div>
  );
};

/** A grid card, frame 3a. The title is the link; Edit appears once authoring ships. */
const ActivityCard = ({ activity }: { activity: MyActivity }) => {
  const editingAvailable = useH5PAuthoringEnabled();
  const typeName = getContentTypeName(activity);
  const updated = updatedLabel(activity);
  return (
    <li className="flex">
      <article className="flex w-full flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white transition-shadow hover:shadow-md">
        <div className="flex h-[120px] items-center justify-center bg-primary-50" aria-hidden="true">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white">
            <ContentTypeIcon activity={activity} size={28} />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          {typeName && (
            <Text size="sm" color="muted">
              {typeName}
            </Text>
          )}
          <Heading level={2} className="!text-lg break-words">
            <Link to={`/activity/${activity.activityID}`} className="text-neutral-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500">
              {activity.title}
            </Link>
          </Heading>
          <ActivityBadges activity={activity} />
        </div>
        {(updated || editingAvailable) && (
          <div className="flex items-center justify-between gap-2 border-t border-neutral-200 px-4 py-3">
            {updated && (
              <Text size="sm" color="muted">
                {updated}
              </Text>
            )}
            {editingAvailable && (
              <Button
                as={Link}
                to={`/h5p/${activity.activityID}/edit`}
                variant="outline"
                size="sm"
                icon={<IconEdit size={16} />}
                aria-label={`Edit ${activity.title}`}
              >
                Edit
              </Button>
            )}
          </div>
        )}
      </article>
    </li>
  );
};

/** A compact row for phones, frame 4d. Secondary actions move to the ⋯ menu. */
const ActivityRow = ({ activity }: { activity: MyActivity }) => {
  const history = useHistory();
  const editingAvailable = useH5PAuthoringEnabled();
  const typeName = getContentTypeName(activity);
  const updated = activity.updatedAt
    ? formatDistanceToNow(parseISO(activity.updatedAt), { addSuffix: true })
    : undefined;
  return (
    <li className="flex items-start gap-3 border-b border-neutral-200 bg-white p-3 last:border-b-0">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary-50" aria-hidden="true">
        <ContentTypeIcon activity={activity} size={24} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link to={`/activity/${activity.activityID}`} className="break-words font-semibold text-neutral-900 hover:underline">
          {activity.title}
        </Link>
        {(typeName || updated) && (
          <Text size="sm" color="muted">
            {[typeName, updated].filter(Boolean).join(" · ")}
          </Text>
        )}
        <ActivityBadges activity={activity} size="sm" />
      </div>
      <Menu>
        <Menu.Button
          aria-label={`More actions for ${activity.title}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-neutral-100"
        >
          <IconDotsVertical size={20} aria-hidden="true" />
        </Menu.Button>
        <Menu.Items align="right">
          <Menu.Item icon={<IconExternalLink size={16} />} onClick={() => history.push(`/activity/${activity.activityID}`)}>
            View public page
          </Menu.Item>
          <Menu.Item
            icon={<IconLink size={16} />}
            onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/activity/${activity.activityID}`)}
          >
            Copy link
          </Menu.Item>
          {editingAvailable && (
            <Menu.Item icon={<IconEdit size={16} />} onClick={() => history.push(`/h5p/${activity.activityID}/edit`)}>
              Edit
            </Menu.Item>
          )}
        </Menu.Items>
      </Menu>
    </li>
  );
};

const CreateActions = ({ stacked }: { stacked?: boolean }) => {
  const canCreate = useCanCreateActivities();
  return canCreate ? (
    <div className={stacked ? "flex w-full max-w-[260px] flex-col gap-2" : "flex flex-wrap justify-center gap-2"}>
      <Button as={Link} to="/h5p/new?upload=true" variant="outline" icon={<IconUpload size={16} />} fullWidth={stacked}>
        Upload .h5p file
      </Button>
      <Button as={Link} to="/h5p/new" variant="primary" className="bg-primary! text-white!" icon={<IconPlus size={18} />} fullWidth={stacked}>
        New H5P
      </Button>
    </div>
  ) : null;
};

const LoadingGrid = ({ rows }: { rows: boolean }) =>
  rows ? (
    <ul className="m-0 list-none overflow-hidden rounded-lg border border-neutral-200 bg-white p-0" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="flex gap-3 border-b border-neutral-200 p-3 last:border-b-0">
          <Skeleton variant="rounded" width={48} height={48} />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton variant="text" lines={2} />
            <Skeleton variant="rounded" width={64} height={22} />
          </div>
        </li>
      ))}
    </ul>
  ) : (
    <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 lg:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <Skeleton variant="rectangular" height={120} />
          <div className="flex flex-col gap-2 p-4">
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="text" lines={2} />
            <Skeleton variant="rounded" width={64} height={22} />
          </div>
        </li>
      ))}
    </ul>
  );

/**
 * My H5P: the activities the signed-in user created or collaborates on.
 *
 * Search, the visibility filter, sorting and paging all run on the server, so
 * the counts and pages stay right for users with hundreds of activities.
 */
const MyH5P = () => {
  useDocumentTitle("LibreTexts Conductor | My H5P");
  const authoringEnabled = useH5PAuthoringEnabled();
  const canCreate = useCanCreateActivities();
  const rows = useMediaQuery(ROWS_QUERY);

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounceValue(search.trim(), 300);
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");
  const [sort, setSort] = useState<MyActivitiesParams["sort"]>("updated");
  const [page, setPage] = useState(1);

  // A new search, filter or sort starts again from the first page.
  useEffect(() => setPage(1), [debouncedSearch, visibility, sort]);

  const params: MyActivitiesParams = {
    query: debouncedSearch || undefined,
    visibility,
    sort,
    page,
    limit: PAGE_SIZE,
  };
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["my-activities", params],
    queryFn: async () => (await api.getMyActivities(params)).data,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
  });

  const filtered = Boolean(debouncedSearch) || visibility !== "all";
  const noActivitiesAtAll = data && data.overallTotal === 0;
  const totalPages = data ? Math.max(1, Math.ceil(data.total_items / PAGE_SIZE)) : 1;
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label.toLowerCase();

  const clearFilters = () => {
    setSearch("");
    setVisibility("all");
  };

  const noResultsTitle = (() => {
    const level = visibility === "all" ? "" : `${visibility} `;
    return debouncedSearch
      ? `No ${level}activities match "${debouncedSearch}"`
      : `No ${level}activities`;
  })();

  return (
    <div className="min-h-full bg-neutral-50 px-4 pb-16 pt-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <Heading level={1}>My H5P</Heading>
          {!rows && <Text color="muted">Activities you created or collaborate on.</Text>}
        </div>
        {canCreate && !noActivitiesAtAll && (
          <Button as={Link} to="/h5p/new" variant="primary" className="bg-primary! text-white!" size={rows ? "lg" : "md"} icon={<IconPlus size={18} />}>
            New H5P
          </Button>
        )}
      </header>

      {isError ? (
        <Card padding="md" className="mt-6">
          <EmptyState
            icon={<IconAlertTriangle size={32} />}
            title="Your activities couldn't be loaded"
            description="Something went wrong on our end. Try again in a moment."
            action={
              <Button variant="primary" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : noActivitiesAtAll ? (
        <Card padding="md" className="mt-6">
          <EmptyState
            icon={<IconBox size={32} />}
            title="No H5P activities yet"
            description={
              canCreate
                ? rows
                  ? "Create an interactive activity, or upload an .h5p file you already have."
                  : "Create an interactive activity, or upload an .h5p file you already have. Activities shared with you will also appear here."
                : authoringEnabled
                  ? "Activities shared with you appear here. Creating activities is open to verified instructors."
                  : "Activities you create or that are shared with you appear here."
            }
            action={<CreateActions stacked={rows} />}
          />
        </Card>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className={rows ? "w-full" : "w-full min-w-[320px] max-w-[520px] flex-1"}>
              <Input
                name="my-h5p-search"
                label="Search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={rows ? "Search my H5P" : "Search by title, tag, or content type"}
                leftIcon={<IconSearch size={16} aria-hidden="true" />}
              />
            </div>
            {isLoading ? (
              <Skeleton variant="rounded" width={rows ? "100%" : 320} height={rows ? 36 : 40} />
            ) : (
              <VisibilityFilterControl
                value={visibility}
                counts={data?.counts}
                onChange={setVisibility}
                compact={rows}
              />
            )}
            <div className={rows ? "w-full" : "ml-auto w-48"}>
              <Select
                name="my-h5p-sort"
                label="Sort by"
                placeholder="Sort by"
                options={SORT_OPTIONS}
                value={sort}
                onChange={(e) => setSort(e.target.value as MyActivitiesParams["sort"])}
              />
            </div>
          </div>

          <div className="mt-3 flex min-h-[24px] items-center gap-2" aria-live="polite">
            {isLoading ? (
              <Spinner size="sm" text="Loading activities" />
            ) : (
              data && (
                <Text size="sm" color="muted">
                  {filtered
                    ? `${data.total_items} of ${data.overallTotal} activities`
                    : `${data.total_items} ${data.total_items === 1 ? "activity" : "activities"}`}
                  {` · Sorted by ${sortLabel}`}
                </Text>
              )
            )}
            {isFetching && !isLoading && <VisuallyHidden>Updating results</VisuallyHidden>}
          </div>

          <div className="mt-4">
            {isLoading ? (
              <LoadingGrid rows={rows} />
            ) : data && data.activities.length === 0 ? (
              <Card padding="md">
                <EmptyState
                  icon={<IconSearchOff size={32} />}
                  title={noResultsTitle}
                  description={`Try a different keyword, or clear filters to search all ${data.overallTotal} of your activities.`}
                  action={
                    <Button variant="outline" icon={<IconFilterOff size={16} />} onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              </Card>
            ) : rows ? (
              <ul className="m-0 list-none overflow-hidden rounded-lg border border-neutral-200 p-0">
                {data?.activities.map((a) => <ActivityRow key={a.activityID} activity={a} />)}
              </ul>
            ) : (
              <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 lg:grid-cols-3 xl:grid-cols-4">
                {data?.activities.map((a) => <ActivityCard key={a.activityID} activity={a} />)}
              </ul>
            )}
          </div>

          {data && totalPages > 1 && (
            <nav aria-label="My H5P pages" className="mt-6 flex justify-center">
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </nav>
          )}
        </>
      )}
    </div>
  );
};

export default MyH5P;
