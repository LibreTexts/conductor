import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  EmptyState,
  Heading,
  Link,
  Spinner,
  Stack,
  Text,
} from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef } from "@libretexts/davis-react-table";
import { format, parseISO } from "date-fns";
import { IconSitemap } from "@tabler/icons-react";
import api from "../../../../api";
import { useTypedSelector } from "../../../../state/hooks";
import useDocumentTitle from "../../../../hooks/useDocumentTitle";
import type {
  BookGraphEdge,
  BookGraphNode,
  LibraryReuseStats,
} from "../../../../types/ContentSources";
import {
  CARD_TIPS,
  EDGE_TYPE_LABELS,
  KIND_DESCRIPTIONS,
  KIND_LABELS,
  SUMMARY_KINDS,
  plural,
} from "../../../../components/projects/ContentSources/labels";
import TipStatCard from "../../../../components/projects/ContentSources/TipStatCard";
import ForceBookGraph from "./ForceBookGraph";
import LibraryMultiSelect from "./LibraryMultiSelect";

const TABLE_LINKS = 50;

const scanLabel = (scan: LibraryReuseStats["scan"]) => {
  if (!scan) return { label: "Never scanned", variant: "default" as const };
  if (scan.running) return { label: "Scanning", variant: "primary" as const };
  if (scan.phase === "complete") return { label: "Complete", variant: "success" as const };
  if (scan.lastRunAt) return { label: "In progress", variant: "warning" as const };
  return { label: "Not started", variant: "default" as const };
};

const shortDate = (value: string | null) =>
  value ? format(parseISO(value), "MMM d, yyyy h:mm a") : "—";

const NodeLink: React.FC<{ node?: BookGraphNode; fallback: string }> = ({ node, fallback }) =>
  node?.url ? (
    <Link href={node.url} target="_blank" rel="noopener noreferrer">
      {node.title}
      <span className="sr-only"> (opens in a new tab)</span>
    </Link>
  ) : (
    <span>{node?.title ?? fallback}</span>
  );

const count = (value: number) => value.toLocaleString();

const LIBRARY_COLUMNS: ColumnDef<LibraryReuseStats, any>[] = [
  {
    accessorKey: "library",
    header: "Library",
    cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
  },
  {
    id: "scan",
    header: "Scan",
    accessorFn: (lib) => scanLabel(lib.scan).label,
    cell: ({ row }) => {
      const scan = scanLabel(row.original.scan);
      return <Badge label={scan.label} variant={scan.variant} size="sm" />;
    },
  },
  { accessorKey: "books", header: "Books", cell: ({ getValue }) => count(getValue<number>()) },
  {
    id: "pages",
    header: "Pages",
    accessorFn: (lib) => lib.totals.pages,
    cell: ({ getValue }) => count(getValue<number>()),
  },
  ...SUMMARY_KINDS.map<ColumnDef<LibraryReuseStats, any>>((kind) => ({
    id: kind,
    header: KIND_LABELS[kind],
    accessorFn: (lib) => lib.totals[kind],
    cell: ({ getValue }) => count(getValue<number>()),
  })),
  {
    id: "connections",
    header: "Books reusing / reused",
    accessorFn: (lib) => lib.booksReusing + lib.booksReused,
    cell: ({ row }) =>
      `${count(row.original.booksReusing)} / ${count(row.original.booksReused)}`,
  },
  {
    accessorKey: "brokenLinks",
    header: "Broken links",
    cell: ({ getValue }) => count(getValue<number>()),
  },
  {
    id: "lastRun",
    header: "Last run",
    accessorFn: (lib) => lib.scan?.lastRunAt ?? "",
    cell: ({ row }) => shortDate(row.original.scan?.lastRunAt ?? null),
  },
  {
    id: "feed",
    header: "Change feed",
    accessorFn: (lib) => lib.feed?.polledAt ?? "",
    cell: ({ row }) => {
      const feed = row.original.feed;
      return (
        <>
          {feed?.polledAt ? shortDate(feed.polledAt) : "Not read yet"}
          {feed?.pendingBooks ? (
            <span className="block text-xs text-neutral-600">
              {plural(feed.pendingBooks, "book")} waiting to be re-read
            </span>
          ) : null}
          {feed?.gapAt && (
            <Badge label={`Gap ${shortDate(feed.gapAt)}`} variant="warning" size="sm" className="mt-1" />
          )}
        </>
      );
    },
  },
];

/** One row of the reuse-links table, with both ends resolved. */
type LinkRow = BookGraphEdge & { sourceNode?: BookGraphNode; targetNode?: BookGraphNode };

const LINK_COLUMNS: ColumnDef<LinkRow, any>[] = [
  {
    id: "source",
    header: "Source",
    accessorFn: (row) => row.sourceNode?.title ?? row.source,
    cell: ({ row }) => <NodeLink node={row.original.sourceNode} fallback={row.original.source} />,
  },
  {
    id: "target",
    header: "Reused by",
    accessorFn: (row) => row.targetNode?.title ?? row.target,
    cell: ({ row }) => <NodeLink node={row.original.targetNode} fallback={row.original.target} />,
  },
  { accessorKey: "pages", header: "Pages", cell: ({ getValue }) => count(getValue<number>()) },
  {
    id: "how",
    header: "How",
    accessorFn: (row) => row.types.map((t) => EDGE_TYPE_LABELS[t]).join(", "),
  },
];

/**
 * Content Reuse: how much of each library is original, reused or copied,
 * how far the provenance scanner has got, and which books share content.
 * LibreTexts superadmins and support staff only.
 */
const ContentReuse: React.FC = () => {
  useDocumentTitle("LibreTexts Conductor | Content Reuse");
  const user = useTypedSelector((state) => state.user);
  /** Libraries whose books the graph shows; none selected means every library. */
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.uuid) return;
    if (!user.isSuperAdmin && !user.isSupport) window.location.href = "/home";
  }, [user]);

  const statsQuery = useQuery({
    queryKey: ["provenanceStats"],
    queryFn: () => api.getProvenanceStats(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const libraries = statsQuery.data?.data.libraries ?? [];
  const libraryChoices = useMemo(() => libraries.map((lib) => ({ id: lib.library })), [libraries]);

  const graphQuery = useQuery({
    queryKey: ["provenanceGraph", [...selectedLibraries].sort().join(",")],
    queryFn: () => api.getProvenanceGraph({ libraries: selectedLibraries }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const graph = graphQuery.data?.data;

  const totals = useMemo(
    () =>
      libraries.reduce(
        (acc, lib) => ({
          books: acc.books + lib.books,
          pages: acc.pages + lib.totals.pages,
          original: acc.original + lib.totals.original,
          mixed: acc.mixed + lib.totals.mixed,
          transclude: acc.transclude + lib.totals.transclude,
          fork: acc.fork + lib.totals.fork,
          full: acc.full + lib.totals.full,
          broken: acc.broken + lib.brokenLinks,
        }),
        { books: 0, pages: 0, original: 0, mixed: 0, transclude: 0, fork: 0, full: 0, broken: 0 },
      ),
    [libraries],
  );

  const nodesById = useMemo(
    () => new Map((graph?.nodes ?? []).map((n) => [n.id, n])),
    [graph],
  );
  const linkRows = useMemo<LinkRow[]>(
    () =>
      (graph?.edges ?? []).slice(0, TABLE_LINKS).map((edge) => ({
        ...edge,
        sourceNode: nodesById.get(edge.source),
        targetNode: nodesById.get(edge.target),
      })),
    [graph, nodesById],
  );
  const graphSummary = graph
    ? `Book connection graph: ${plural(graph.nodes.length, "node")} and ${plural(graph.edges.length, "reuse link")}. The table below lists the links.`
    : "";

  return (
    <Stack direction="vertical" gap="lg" className="px-4 py-8 md:px-16">
      <Stack direction="vertical" gap="xs">
        <Heading level={2}>Content Reuse</Heading>
        <Breadcrumb className="ml-1">
          <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Content Reuse</Breadcrumb.Item>
        </Breadcrumb>
        <Text className="text-neutral-700">
          Which library pages are original, or reused from other books with
          Copy-Transclude, Copy-Fork or Copy-Full, and how books share content. Built by Conductor's background
          scan; nothing here changes the libraries.
        </Text>
        <div>
          <Button as="a" href="/controlpanel/content-reuse/map" variant="primary" size="sm">
            Open the library map
          </Button>
        </div>
      </Stack>

      {statsQuery.isLoading && <Spinner text="Loading reuse statistics" />}
      {statsQuery.isError && <Alert variant="error" message="Couldn't load reuse statistics." />}

      {statsQuery.isSuccess && libraries.length === 0 && (
        <Card variant="elevated">
          <Card.Body>
            <EmptyState
              icon={<IconSitemap size={32} aria-hidden="true" />}
              title="Nothing scanned yet"
              description="Statistics appear here once the provenance scan has run on at least one library."
            />
          </Card.Body>
        </Card>
      )}

      {libraries.length > 0 && (
        <>
          <section aria-labelledby="cr-totals-heading">
            <Heading level={3} id="cr-totals-heading" className="mb-3 text-lg">
              All libraries
            </Heading>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
              <TipStatCard label="Books scanned" value={totals.books.toLocaleString()} tip={CARD_TIPS.books} />
              <TipStatCard label="Pages" value={totals.pages.toLocaleString()} tip={CARD_TIPS.pagesAll} />
              {SUMMARY_KINDS.map((kind) => (
                <TipStatCard key={kind} label={KIND_LABELS[kind]} value={totals[kind].toLocaleString()} tip={KIND_DESCRIPTIONS[kind]} />
              ))}
              <TipStatCard
                label="Broken reuse links"
                tip={CARD_TIPS.broken}
                value={totals.broken.toLocaleString()}
                variant={totals.broken > 0 ? "danger" : "default"}
              />
            </div>
          </section>

          <Card variant="elevated">
            <Card.Body>
              <section aria-labelledby="cr-libraries-heading">
                <Heading level={3} id="cr-libraries-heading" className="mb-3 text-lg">
                  By library
                </Heading>
                <DataTable<LibraryReuseStats>
                  data={libraries}
                  columns={LIBRARY_COLUMNS}
                  enableSorting
                  density="compact"
                  caption="Reuse totals and scan progress per library"
                  emptyState="No libraries scanned yet."
                />
              </section>
            </Card.Body>
          </Card>
        </>
      )}

      <Card variant="elevated">
        <Card.Body>
          <section aria-labelledby="cr-graph-heading">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <Heading level={3} id="cr-graph-heading" className="text-lg">
                Book connections
              </Heading>
              <LibraryMultiSelect
                libraries={libraryChoices}
                value={selectedLibraries}
                onChange={setSelectedLibraries}
                name="contentReuseLibraries"
              />
            </div>
            {graphQuery.isLoading && <Spinner text="Loading the book graph" />}
            {graphQuery.isError && <Alert variant="error" message="Couldn't load the book graph." />}
            {graph && graph.edges.length === 0 && (
              <Text className="block text-neutral-700">
                No reuse between books has been found
                {selectedLibraries.length ? ` in ${selectedLibraries.join(", ")}` : ""} yet.
              </Text>
            )}
            {graph && graph.edges.length > 0 && (
              <>
                <ForceBookGraph graph={graph} summary={graphSummary} />
                <Text size="sm" className="mt-2 block text-neutral-600">
                  Each dot is a book, sized by its pages and coloured by library;
                  arrows point from the source to the book reusing it. Dashed
                  circles stand for a library's books that haven't been scanned yet.
                  To zoom, use the + and − buttons, Ctrl/⌘ + scroll or pinch; drag to pan.
                  {graph.omittedEdges > 0 &&
                    ` ${plural(graph.omittedEdges, "smaller link")} left out to keep the picture readable.`}
                </Text>

                <div className="mt-6">
                  <Heading level={4} id="cr-links-heading" className="mb-2 text-base">
                    Largest reuse links{graph.edges.length > TABLE_LINKS ? ` (top ${TABLE_LINKS})` : ""}
                  </Heading>
                  <DataTable<LinkRow>
                    data={linkRows}
                    columns={LINK_COLUMNS}
                    enableSorting
                    density="compact"
                    caption="Largest reuse links between books"
                    tableOptions={{ getRowId: (row) => `${row.source}>${row.target}` }}
                  />
                </div>
              </>
            )}
          </section>
        </Card.Body>
      </Card>
    </Stack>
  );
};

export default ContentReuse;
