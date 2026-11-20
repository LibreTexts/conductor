import React from "react";
import { format, parseISO } from "date-fns";
import { Drawer, Heading, Link, Text } from "@libretexts/davis-react";
import { IconExternalLink } from "@tabler/icons-react";
import type { LibraryMap, LibraryMapTotals } from "../../../../../types/ContentSources";
import { EDGE_TYPE_LABELS, KIND_LABELS, plural } from "../../../../../components/projects/ContentSources/labels";
import { libraryLabel } from "../../../../../components/projects/ContentSources/treeDraw";
import { typesOf, type MapModel } from "./mapModel";

/** Kinds listed in the panel, in the order the summaries use. */
const KINDS: (keyof LibraryMapTotals & keyof typeof KIND_LABELS)[] = [
  "original", "mixed", "transclude", "fork", "full", "structural", "unknown",
];
const MAX_LINKS = 15;

type Props = {
  map: LibraryMap;
  model: MapModel;
  index: number | null;
  onClose: () => void;
  /** Open another book (from its sources or reusers). */
  onPick: (index: number) => void;
};

/**
 * Everything the map knows about one book, as text: its totals by kind, the
 * books it takes content from and the books that reuse it (with pages and how),
 * what needs attention, and where to go next. The same detail as the dots,
 * for keyboard and screen-reader users too.
 */
const BookDrawer: React.FC<Props> = ({ map, model, index, onClose, onPick }) => {
  const node = index !== null ? map.nodes[index] : null;
  const coverID = node?.kind === "book" ? node.id.slice(node.id.lastIndexOf("-") + 1) : null;

  const linkList = (edgeIndexes: number[], other: (e: LibraryMap["edges"][number]) => number) => {
    const edges = edgeIndexes.map((i) => map.edges[i]).sort((a, b) => b[2] - a[2]);
    return (
      <>
        <ul className="m-0 list-none space-y-1 p-0">
          {edges.slice(0, MAX_LINKS).map((edge) => {
            const o = other(edge);
            return (
              <li key={`${edge[0]}>${edge[1]}`} className="text-sm">
                <button
                  type="button"
                  onClick={() => onPick(o)}
                  className="text-left text-blue-700 underline hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  {map.nodes[o].title}
                </button>
                <span className="text-neutral-600">
                  {" "}
                  · {libraryLabel(map.nodes[o].lib)} · {plural(edge[2], "page")} ·{" "}
                  {typesOf(edge[3], map.edgeTypes).map((t) => EDGE_TYPE_LABELS[t]).join(", ")}
                </span>
              </li>
            );
          })}
        </ul>
        {edges.length > MAX_LINKS && (
          <Text size="sm" className="mt-1 block text-neutral-600">
            and {plural(edges.length - MAX_LINKS, "more book")}
          </Text>
        )}
      </>
    );
  };

  return (
    <Drawer open={node !== null} onClose={onClose} side="right" size="lg">
      <Drawer.Header>
        <Drawer.Title>{node?.title ?? "Book"}</Drawer.Title>
      </Drawer.Header>
      <Drawer.Body>
        {node && index !== null && (
          <div className="space-y-5">
            <Text className="block text-neutral-700">
              {libraryLabel(node.lib)}
              {node.kind === "library"
                ? " · books this library's pages come from that haven't been scanned yet"
                : node.scanned && node.computedAt
                  ? ` · scanned ${format(parseISO(node.computedAt), "MMM d, yyyy")}`
                  : " · not scanned yet"}
            </Text>

            {(node.attention.broken > 0 || node.attention.sourceChanged > 0) && (
              <Text className="block font-semibold text-neutral-900">
                Needs attention:{" "}
                {[
                  node.attention.broken > 0 ? `${plural(node.attention.broken, "page")} with a deleted source` : null,
                  node.attention.sourceChanged > 0 ? `${plural(node.attention.sourceChanged, "page")} with a changed source` : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </Text>
            )}

            {node.totals && (
              <section aria-labelledby="lm-kinds">
                <Heading level={3} id="lm-kinds" className="mb-2 text-base">
                  {plural(node.totals.pages, "page")}
                </Heading>
                <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  {KINDS.filter((k) => node.totals![k] > 0).map((k) => (
                    <div key={k} className="flex justify-between gap-2">
                      <dt className="text-neutral-700">{KIND_LABELS[k]}</dt>
                      <dd className="m-0 tabular-nums font-semibold">{node.totals![k].toLocaleString()}</dd>
                    </div>
                  ))}
                  {node.totals.viaChain > 0 && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-neutral-700">Through a chain</dt>
                      <dd className="m-0 tabular-nums font-semibold">{node.totals.viaChain.toLocaleString()}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            <section aria-labelledby="lm-sources">
              <Heading level={3} id="lm-sources" className="mb-2 text-base">
                Takes content from
              </Heading>
              {model.incoming[index].length ? (
                linkList(model.incoming[index], (e) => e[0])
              ) : (
                <Text size="sm" className="block text-neutral-700">No other book.</Text>
              )}
            </section>

            <section aria-labelledby="lm-reusers">
              <Heading level={3} id="lm-reusers" className="mb-2 text-base">
                Reused by
              </Heading>
              {model.outgoing[index].length ? (
                linkList(model.outgoing[index], (e) => e[1])
              ) : (
                <Text size="sm" className="block text-neutral-700">No other book.</Text>
              )}
            </section>

            <div className="flex flex-wrap gap-3">
              {node.projectID && (
                <Link href={`/projects/${node.projectID}/content-sources`}>Open its project's Content Sources</Link>
              )}
              {coverID && (
                <Link href={`https://${node.lib}.libretexts.org/@go/page/${coverID}`} target="_blank" rel="noopener noreferrer">
                  Open the book <IconExternalLink size={14} aria-hidden="true" className="inline" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </Drawer.Body>
    </Drawer>
  );
};

export default BookDrawer;
