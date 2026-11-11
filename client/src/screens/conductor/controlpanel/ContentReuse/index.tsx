import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Breadcrumb,
  Card,
  EmptyState,
  Heading,
  Link,
  Select,
  Spinner,
  Stack,
  StatCard,
  Text,
} from "@libretexts/davis-react";
import { format, parseISO } from "date-fns";
import { IconSitemap } from "@tabler/icons-react";
import api from "../../../../api";
import { useTypedSelector } from "../../../../state/hooks";
import useDocumentTitle from "../../../../hooks/useDocumentTitle";
import type { BookGraphNode, LibraryReuseStats } from "../../../../types/ContentSources";
import { EDGE_TYPE_LABELS, plural } from "../../../../components/projects/ContentSources/labels";
import ForceBookGraph from "./ForceBookGraph";

const ALL_LIBRARIES = "all";
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

/**
 * Content Reuse: how much of each library is original, reused or copied,
 * how far the provenance scanner has got, and which books share content.
 * LibreTexts superadmins and support staff only.
 */
const ContentReuse: React.FC = () => {
  useDocumentTitle("LibreTexts Conductor | Content Reuse");
  const user = useTypedSelector((state) => state.user);
  const [library, setLibrary] = useState(ALL_LIBRARIES);

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

  const graphQuery = useQuery({
    queryKey: ["provenanceGraph", library],
    queryFn: () =>
      api.getProvenanceGraph(library === ALL_LIBRARIES ? {} : { library }),
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
          reused: acc.reused + lib.totals.transclude + lib.totals.mixed,
          copied: acc.copied + lib.totals.fork + lib.totals.full,
          broken: acc.broken + lib.brokenLinks,
        }),
        { books: 0, pages: 0, original: 0, reused: 0, copied: 0, broken: 0 },
      ),
    [libraries],
  );

  const nodesById = useMemo(
    () => new Map((graph?.nodes ?? []).map((n) => [n.id, n])),
    [graph],
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
          Which library pages are original, reused live, or copied from other
          books, and how books share content. Built by Conductor's background
          scan; nothing here changes the libraries.
        </Text>
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
            <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
              <StatCard label="Books scanned" value={totals.books.toLocaleString()} />
              <StatCard label="Pages" value={totals.pages.toLocaleString()} />
              <StatCard label="Original" value={totals.original.toLocaleString()} />
              <StatCard label="Reused live" value={totals.reused.toLocaleString()} />
              <StatCard label="Copied" value={totals.copied.toLocaleString()} />
              <StatCard
                label="Broken reuse links"
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
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <caption className="sr-only">Reuse totals and scan progress per library</caption>
                    <thead>
                      <tr className="border-b border-neutral-300">
                        <th scope="col" className="py-2 pr-4 font-semibold">Library</th>
                        <th scope="col" className="py-2 pr-4 font-semibold">Scan</th>
                        <th scope="col" className="py-2 pr-4 font-semibold">Books</th>
                        <th scope="col" className="py-2 pr-4 font-semibold">Pages</th>
                        <th scope="col" className="py-2 pr-4 font-semibold">Original</th>
                        <th scope="col" className="py-2 pr-4 font-semibold">Reused live</th>
                        <th scope="col" className="py-2 pr-4 font-semibold">Copied</th>
                        <th scope="col" className="py-2 pr-4 font-semibold">Books reusing / reused</th>
                        <th scope="col" className="py-2 pr-4 font-semibold">Broken links</th>
                        <th scope="col" className="py-2 font-semibold">Last run</th>
                      </tr>
                    </thead>
                    <tbody>
                      {libraries.map((lib) => {
                        const scan = scanLabel(lib.scan);
                        return (
                          <tr key={lib.library} className="border-b border-neutral-200">
                            <th scope="row" className="py-2 pr-4 font-medium">{lib.library}</th>
                            <td className="py-2 pr-4">
                              <Badge label={scan.label} variant={scan.variant} size="sm" />
                            </td>
                            <td className="py-2 pr-4">{lib.books.toLocaleString()}</td>
                            <td className="py-2 pr-4">{lib.totals.pages.toLocaleString()}</td>
                            <td className="py-2 pr-4">{lib.totals.original.toLocaleString()}</td>
                            <td className="py-2 pr-4">{(lib.totals.transclude + lib.totals.mixed).toLocaleString()}</td>
                            <td className="py-2 pr-4">{(lib.totals.fork + lib.totals.full).toLocaleString()}</td>
                            <td className="py-2 pr-4">
                              {lib.booksReusing.toLocaleString()} / {lib.booksReused.toLocaleString()}
                            </td>
                            <td className="py-2 pr-4">{lib.brokenLinks.toLocaleString()}</td>
                            <td className="py-2">{shortDate(lib.scan?.lastRunAt ?? null)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
              <Select
                name="contentReuseLibrary"
                label="Library"
                placeholder="All libraries"
                options={[
                  { label: "All libraries", value: ALL_LIBRARIES },
                  ...libraries.map((lib) => ({ label: lib.library, value: lib.library })),
                ]}
                value={library}
                onChange={(e) => setLibrary(e.target.value)}
              />
            </div>
            {graphQuery.isLoading && <Spinner text="Loading the book graph" />}
            {graphQuery.isError && <Alert variant="error" message="Couldn't load the book graph." />}
            {graph && graph.edges.length === 0 && (
              <Text className="block text-neutral-700">
                No reuse between books has been found{library === ALL_LIBRARIES ? "" : ` in ${library}`} yet.
              </Text>
            )}
            {graph && graph.edges.length > 0 && (
              <>
                <ForceBookGraph graph={graph} summary={graphSummary} />
                <Text size="sm" className="mt-2 block text-neutral-600">
                  Each dot is a book, sized by its pages and coloured by library;
                  arrows point from the source to the book reusing it. Dashed
                  circles stand for a library's books that haven't been scanned yet.
                  {graph.omittedEdges > 0 &&
                    ` ${plural(graph.omittedEdges, "smaller link")} left out to keep the picture readable.`}
                </Text>

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <caption className="mb-2 text-left font-semibold">
                      Largest reuse links{graph.edges.length > TABLE_LINKS ? ` (top ${TABLE_LINKS})` : ""}
                    </caption>
                    <thead>
                      <tr className="border-b border-neutral-300">
                        <th scope="col" className="py-2 pr-4 font-semibold">Source</th>
                        <th scope="col" className="py-2 pr-4 font-semibold">Reused by</th>
                        <th scope="col" className="py-2 pr-4 font-semibold">Pages</th>
                        <th scope="col" className="py-2 font-semibold">How</th>
                      </tr>
                    </thead>
                    <tbody>
                      {graph.edges.slice(0, TABLE_LINKS).map((edge) => (
                        <tr key={`${edge.source}>${edge.target}`} className="border-b border-neutral-200">
                          <td className="py-2 pr-4">
                            <NodeLink node={nodesById.get(edge.source)} fallback={edge.source} />
                          </td>
                          <td className="py-2 pr-4">
                            <NodeLink node={nodesById.get(edge.target)} fallback={edge.target} />
                          </td>
                          <td className="py-2 pr-4">{edge.pages.toLocaleString()}</td>
                          <td className="py-2">{edge.types.map((t) => EDGE_TYPE_LABELS[t]).join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
