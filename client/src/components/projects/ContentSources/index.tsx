import React, { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  EmptyState,
  Heading,
  IconButton,
  Link,
  Select,
  Spinner,
  Stack,
  Switch,
  Text,
} from "@libretexts/davis-react";
import { createColumnHelper } from "@libretexts/davis-react-table";
import RowHeaderDataTable from "../../util/RowHeaderDataTable";
import { format, parseISO } from "date-fns";
import { IconCheck, IconExternalLink, IconHistory, IconRoute, IconSitemap } from "@tabler/icons-react";
import api from "../../../api";
import useProject from "../../../hooks/useProject";
import { useNotifications } from "../../../context/NotificationContext";
import type {
  ContentSourcesBookLink,
  ContentSourcesOverview,
  ContentSourcesPage,
  ContentSourcesRecentChange,
  ContentSourcesRef,
  PageNodeKind,
} from "../../../types/ContentSources";
import BookConnections from "./BookConnections";
import LineageDrawer from "./LineageDrawer";
import RevisionsDrawer from "./RevisionsDrawer";
import KindDonut from "./KindDonut";
import {
  CARD_TIPS,
  EDGE_TYPE_LABELS,
  KIND_DESCRIPTIONS,
  KIND_LABELS,
  STATUS_BADGES,
  SUMMARY_KINDS,
  plural,
} from "./labels";

const OVERVIEW_QUERY_KEY = "contentSourcesOverview";

const RefLink: React.FC<{ item: ContentSourcesRef }> = ({ item }) =>
  item.url ? (
    <Link href={item.url} target="_blank" rel="noopener noreferrer">
      {item.title}
      <span className="sr-only"> (opens in a new tab)</span>
    </Link>
  ) : (
    <span>{item.title}</span>
  );

const BookLinksTable: React.FC<{
  links: ContentSourcesBookLink[];
  caption: string;
  empty: string;
}> = ({ links, caption, empty }) =>
  links.length === 0 ? (
    <Text className="block text-neutral-700">{empty}</Text>
  ) : (
    <table className="w-full border-collapse text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-neutral-300">
          <th scope="col" className="py-2 pr-4 font-semibold">Book</th>
          <th scope="col" className="py-2 pr-4 font-semibold">Pages</th>
          <th scope="col" className="py-2 font-semibold">How</th>
        </tr>
      </thead>
      <tbody>
        {links.map((link) => (
          <tr key={link.id} className="border-b border-neutral-200">
            <td className="py-2 pr-4"><RefLink item={link} /></td>
            <td className="py-2 pr-4">{link.pages.toLocaleString()}</td>
            <td className="py-2">{link.types.map((t) => EDGE_TYPE_LABELS[t]).join(", ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

const pagesColumnHelper = createColumnHelper<ContentSourcesPage>();

const ALL_KINDS = "all";

const KIND_FILTER_OPTIONS: { label: string; value: string }[] = [
  // Not "": Davis Select shows a disabled placeholder option for an empty value.
  { label: "All pages", value: ALL_KINDS },
  ...(Object.keys(KIND_LABELS) as PageNodeKind[]).map((kind) => ({
    label: KIND_LABELS[kind],
    value: kind,
  })),
];

/**
 * Content Sources: where this project's book takes its content from, which
 * books reuse it, what changed upstream, and each page's reuse chain. All
 * read-only, from Conductor's provenance graph; nothing is read from or
 * written to the library here.
 */
const ContentSources: React.FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const { project, isLoading: isLoadingProject } = useProject(id);

  const [kindFilter, setKindFilter] = useState<PageNodeKind | "">("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [lineagePage, setLineagePage] = useState<ContentSourcesPage | null>(null);
  const [revisionsChange, setRevisionsChange] = useState<ContentSourcesRecentChange | null>(null);

  const overviewQuery = useQuery({
    queryKey: [OVERVIEW_QUERY_KEY, id],
    queryFn: () => api.getContentSources(id),
    enabled: !!id,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const overview = overviewQuery.data?.data;

  const pagesQuery = useQuery({
    queryKey: ["contentSourcesPages", id, kindFilter, attentionOnly],
    queryFn: () =>
      api.getContentSourcesPages(id, {
        kind: kindFilter || undefined,
        attention: attentionOnly,
      }),
    enabled: !!id && !!overview?.scanned,
    keepPreviousData: true,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const pages = pagesQuery.data?.data;

  const notifyMutation = useMutation({
    mutationFn: (enabled: boolean) => api.updateContentSourcesNotifications(id, enabled),
    onSuccess: (res) => {
      queryClient.setQueryData<{ data: ContentSourcesOverview } | undefined>(
        [OVERVIEW_QUERY_KEY, id],
        (current) =>
          current
            ? { ...current, data: { ...current.data, notifySourceChanges: res.data.notifySourceChanges } }
            : current,
      );
      addNotification({
        type: "success",
        message: res.data.notifySourceChanges
          ? "Leads will be emailed about source changes."
          : "Source-change emails are off for this project.",
      });
    },
    onError: () => addNotification({ type: "error", message: "Couldn't save the email setting." }),
  });

  const reviewMutation = useMutation({
    mutationFn: (change: ContentSourcesRecentChange) =>
      api.reviewContentSourcesChange(id, change.eventID),
    onSuccess: (_res, change) => {
      // The overview drops the change and the warning count; the pages
      // table loses its "Source changed" badges.
      queryClient.invalidateQueries([OVERVIEW_QUERY_KEY, id]);
      queryClient.invalidateQueries(["contentSourcesPages", id]);
      addNotification({
        type: "success",
        message: `Marked "${change.source.title}" reviewed.`,
      });
    },
    onError: () => addNotification({ type: "error", message: "Couldn't mark the change reviewed." }),
  });

  const columns = useMemo(
    () => [
      pagesColumnHelper.accessor("title", {
        header: "Page",
        size: 380,
        cell: (info) => {
          const { depth } = info.row.original;
          return (
            // Indented by its level in the book; the level is also spoken,
            // since indentation alone isn't conveyed to screen readers.
            <div className="py-2" style={{ paddingLeft: `${Math.min(depth, 8) * 1.25}rem` }}>
              <span className="sr-only">{depth === 0 ? "Book cover: " : `Level ${depth}: `}</span>
              {depth === 0 ? <strong><RefLink item={info.row.original} /></strong> : <RefLink item={info.row.original} />}
            </div>
          );
        },
      }),
      pagesColumnHelper.accessor("kind", {
        header: "Content",
        size: 200,
        cell: (info) => (
          <span className="block py-2" title={KIND_DESCRIPTIONS[info.getValue()]}>{KIND_LABELS[info.getValue()]}</span>
        ),
      }),
      pagesColumnHelper.display({
        id: "sources",
        header: "Comes from",
        size: 420,
        cell: (info) => {
          const { sources, rootSource, reuseDepth } = info.row.original;
          if (sources.length === 0) return <span className="block py-2 text-neutral-600">—</span>;
          return (
            <ul className="m-0 list-none space-y-1 px-0 py-2">
              {sources.map((source) => {
                const status = STATUS_BADGES[source.status];
                return (
                  <li key={source.id}>
                    <RefLink item={source} />{" "}
                    <span className="text-neutral-600">
                      ({EDGE_TYPE_LABELS[source.type]}
                      {source.blocks ? `, ${plural(source.blocks, "block")}` : ""})
                    </span>{" "}
                    {source.status !== "active" && (
                      <Badge label={status.label} variant={status.variant} size="sm" />
                    )}
                  </li>
                );
              })}
              {rootSource && (
                <li className="text-neutral-700">
                  Originally from <RefLink item={rootSource} />
                  {reuseDepth > 1 ? ` (${reuseDepth} steps)` : ""}
                </li>
              )}
            </ul>
          );
        },
      }),
      pagesColumnHelper.display({
        id: "chain",
        size: 110,
        header: () => <span className="sr-only">Reuse chain</span>,
        cell: (info) => (
          <Button
            variant="ghost"
            size="sm"
            icon={<IconRoute size={16} aria-hidden="true" />}
            onClick={() => setLineagePage(info.row.original)}
          >
            Chain<span className="sr-only"> for {info.row.original.title}</span>
          </Button>
        ),
      }),
    ],
    [],
  );

  const totals = overview?.totals;
  // Every page is in the pie and its legend, so they add up to the book's page
  // count. The content kinds always show (0 is worth knowing); structural and
  // not-scanned pages only when there are some.
  const kindData = totals
    ? [
        ...SUMMARY_KINDS.map((kind) => ({ kind, value: totals[kind] })),
        ...(["structural", "unknown"] as const)
          .map((kind) => ({ kind, value: totals[kind] }))
          .filter((d) => d.value > 0),
      ]
    : [];

  return (
    <Stack direction="vertical" gap="lg" className="px-4 py-8 md:px-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Stack direction="vertical" gap="xs">
          <Heading level={2}>Content Sources</Heading>
          {!isLoadingProject && project?.title && (
            <Breadcrumb className="ml-1">
              <Breadcrumb.Item href="/projects">Projects</Breadcrumb.Item>
              <Breadcrumb.Item href={`/projects/${id}`}>{project.title}</Breadcrumb.Item>
              <Breadcrumb.Item isCurrent>Content Sources</Breadcrumb.Item>
            </Breadcrumb>
          )}
        </Stack>
        {overview?.book.url && (
          <Button
            as="a"
            href={overview.book.url}
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
            size="sm"
            icon={<IconExternalLink size={16} aria-hidden="true" />}
            iconPosition="right"
          >
            Open book<span className="sr-only"> (opens in a new tab)</span>
          </Button>
        )}
      </div>

      {overviewQuery.isLoading && <Spinner text="Loading content sources" />}
      {overviewQuery.isError && (
        <Alert
          variant="error"
          message="Couldn't load content sources. This project may not be linked to a book, or you may not be a member."
        />
      )}

      {overview && !overview.scanned && (
        <Card variant="elevated">
          <Card.Body>
            <EmptyState
              icon={<IconSitemap size={32} aria-hidden="true" />}
              title="This book hasn't been scanned yet"
              description="Conductor scans every library's books in the background to find which pages are original, or reused with Copy-Transclude, Copy-Fork or Copy-Full. This book's results will appear here after its first scan."
            />
          </Card.Body>
        </Card>
      )}

      {overview?.scanned && (
        <>
          {overview.attention.broken > 0 && (
            <Alert
              variant="error"
              title="Some reused pages were deleted"
              message={`${plural(overview.attention.broken, "page")} in this book reuse content that no longer exists, so readers see nothing there. Filter the pages table to "needing attention" to find them.`}
            />
          )}
          {overview.attention.sourceChanged > 0 && (
            <Alert
              variant="warning"
              title="Sources changed"
              message={`${plural(overview.attention.sourceChanged, "page")} in this book reuse content that changed and hasn't been marked reviewed yet. Review the changes under Recent source changes.`}
            />
          )}

          <section aria-labelledby="cs-summary-heading">
            <Heading level={3} id="cs-summary-heading" className="mb-3 text-lg">
              Summary
            </Heading>
            <div className="max-w-3xl">
              <KindDonut
                data={kindData}
                totalTip={CARD_TIPS.pages}
                chain={{ pages: totals!.viaChain, tip: CARD_TIPS.viaChain }}
              />
            </div>
            {overview.computedAt && (
              <Text size="sm" className="mt-2 block text-neutral-600">
                Last update {format(parseISO(overview.computedAt), "MMM d, yyyy h:mm a")}.
              </Text>
            )}
          </section>

          <Card variant="elevated">
            <Card.Body>
              <section aria-labelledby="cs-connections-heading">
                <Heading level={3} id="cs-connections-heading" className="mb-3 text-lg">
                  Connected books
                </Heading>
                <BookConnections
                  bookTitle={overview.book.title}
                  upstream={overview.upstream}
                  downstream={overview.downstream}
                  unscannedSources={overview.unscannedSources}
                />
                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <div>
                    <Heading level={4} className="mb-2 text-base">
                      Where this book's content comes from
                    </Heading>
                    <BookLinksTable
                      links={overview.upstream}
                      caption="Books this book reuses content from"
                      empty={
                        overview.unscannedSources.length
                          ? "No scanned book yet; see the libraries below."
                          : "This book doesn't reuse other books' pages."
                      }
                    />
                    {overview.unscannedSources.length > 0 && (
                      <>
                        <Text size="sm" className="mt-4 block text-neutral-700">
                          Also reused from books that haven't been scanned yet:
                        </Text>
                        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
                          {overview.unscannedSources.map((group) => (
                            <li key={group.lib}>
                              <strong>{group.lib}</strong> library:{" "}
                              {plural(group.sources, "source page")} used by{" "}
                              {plural(group.pages, "page")} here (
                              {group.types.map((t) => EDGE_TYPE_LABELS[t]).join(", ")}).{" "}
                              {group.exampleRefs.map((ref, i) => (
                                <React.Fragment key={ref.id}>
                                  {i > 0 && ", "}
                                  <RefLink item={ref} />
                                </React.Fragment>
                              ))}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                  <div>
                    <Heading level={4} className="mb-2 text-base">
                      Books that reuse this book
                    </Heading>
                    <BookLinksTable
                      links={overview.downstream}
                      caption="Books that reuse content from this book"
                      empty="No other scanned book reuses this book's pages."
                    />
                  </div>
                </div>
              </section>
            </Card.Body>
          </Card>

          <Card variant="elevated">
            <Card.Body>
              <section aria-labelledby="cs-changes-heading">
                <Heading level={3} id="cs-changes-heading" className="mb-3 text-lg">
                  Recent source changes
                </Heading>
                {overview.recentChanges.length === 0 ? (
                  <Text className="block text-neutral-700">
                    No page this book reuses has changed recently.
                  </Text>
                ) : (
                  <ul className="m-0 list-none space-y-3 p-0">
                    {overview.recentChanges.map((change) => (
                      <li
                        key={change.eventID}
                        className="flex items-start gap-3 border-b border-neutral-200 pb-3"
                      >
                        <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            label={change.deleted ? "Deleted" : change.frozen ? "Copy may be out of date" : "Edited"}
                            variant={change.deleted ? "danger" : "warning"}
                            size="sm"
                          />
                          <RefLink item={change.source} />
                        </div>
                        <Text size="sm" className="mt-1 block text-neutral-700">
                          {format(parseISO(change.changedAt), "MMM d, yyyy")} ·{" "}
                          {plural(change.pages, "page")} here
                          {change.fromRev !== undefined && change.toRev !== undefined
                            ? ` · revision ${change.fromRev} → ${change.toRev}`
                            : ""}
                          {change.notified ? " · leads emailed" : " · email pending"}
                        </Text>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {!change.deleted && (
                            <IconButton
                              icon={<IconHistory size={16} aria-hidden="true" />}
                              aria-label={`Show revisions: ${change.source.title}`}
                              tooltip="Show revisions"
                              variant="ghost"
                              size="sm"
                              onClick={() => setRevisionsChange(change)}
                            />
                          )}
                          {overview.canManage && (
                            <IconButton
                              icon={<IconCheck size={16} aria-hidden="true" />}
                              aria-label={`Mark reviewed: ${change.source.title}`}
                              tooltip="Mark reviewed"
                              variant="ghost"
                              size="sm"
                              loading={reviewMutation.isLoading && reviewMutation.variables?.eventID === change.eventID}
                              disabled={reviewMutation.isLoading}
                              onClick={() => reviewMutation.mutate(change)}
                            />
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </Card.Body>
          </Card>

          <Card variant="elevated">
            <Card.Body>
              <section aria-labelledby="cs-pages-heading">
                <Heading level={3} id="cs-pages-heading" className="mb-3 text-lg">
                  Pages
                </Heading>
                <div className="mb-4 flex flex-wrap items-end gap-6">
                  <Select
                    name="contentSourcesKind"
                    label="Show"
                    options={KIND_FILTER_OPTIONS}
                    placeholder="All pages"
                    value={kindFilter || ALL_KINDS}
                    onChange={(e) => {
                      const value = e.target.value;
                      setKindFilter(value === ALL_KINDS ? "" : (value as PageNodeKind));
                    }}
                  />
                  <Switch
                    name="contentSourcesAttention"
                    label="Only pages needing attention"
                    checked={attentionOnly}
                    onChange={(checked) => {
                      setAttentionOnly(checked);
                    }}
                  />
                </div>
                {pagesQuery.isLoading && <Spinner text="Loading pages" />}
                {/* RowHeaderDataTable, not Davis DataTable: DataTable's maxHeight
                    puts a scroll area inside another (two scrollbars), pending
                    a Davis fix. This one has a single scroll area. */}
                {pages && (
                  <RowHeaderDataTable<ContentSourcesPage>
                    data={pages.pages}
                    columns={columns}
                    rowHeaderColumnId="title"
                    caption="This book's pages and where their content comes from"
                    getRowId={(row) => row.id}
                    maxHeightClassName="md:max-h-[65vh]"
                    emptyState={
                      <Text className="block p-4 text-neutral-700">
                        {attentionOnly ? "No page needs attention." : "No pages match."}
                      </Text>
                    }
                  />
                )}
                {pages && (
                  <Text size="sm" className="mt-3 block text-neutral-700">
                    {plural(pages.total, "page")}
                    {pages.truncated && " shown; the book is larger than one view can list."}
                  </Text>
                )}
              </section>
            </Card.Body>
          </Card>
        </>
      )}

      {overview && (
        <Card variant="elevated">
          <Card.Body>
            <section aria-labelledby="cs-email-heading">
              <Heading level={3} id="cs-email-heading" className="mb-3 text-lg">
                Email notifications
              </Heading>
              {overview.canManage ? (
                <Switch
                  name="notifySourceChanges"
                  label="Email this project's leads when a page the book reuses changes or is deleted"
                  description="One daily email per lead, listing every change since the last one."
                  checked={overview.notifySourceChanges}
                  disabled={notifyMutation.isLoading}
                  onChange={(checked) => notifyMutation.mutate(checked)}
                />
              ) : (
                <Text className="block text-neutral-700">
                  Source-change emails are{" "}
                  <strong>{overview.notifySourceChanges ? "on" : "off"}</strong> for
                  this project. A project lead can change this.
                </Text>
              )}
            </section>
          </Card.Body>
        </Card>
      )}

      <LineageDrawer projectID={id} page={lineagePage} onClose={() => setLineagePage(null)} />
      <RevisionsDrawer
        projectID={id}
        change={revisionsChange}
        onClose={() => setRevisionsChange(null)}
      />
    </Stack>
  );
};

export default ContentSources;
