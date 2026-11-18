import React, { useMemo } from "react";
import { hierarchy, tree, type HierarchyPointNode } from "d3";
import { Text } from "@libretexts/davis-react";
import type { ContentSourcesPage, ReuseEdgeType } from "../../../types/ContentSources";
import { EDGE_TYPE_LABELS, STATUS_BADGES, plural } from "./labels";
import { buildReuseTree, type ReuseTreeDatum } from "./reuseTree";
import { truncateLabel } from "./svgText";
import { HALO, clamp, fitLabel, libraryLabel, link, measure } from "./treeDraw";

/**
 * Where in this book its content is reused from, as a one-way tidy tree after
 * d3's "Tidy tree" (https://observablehq.com/@d3/tree/2): this book is the
 * root on the left; it grows right through the chapters, sub-chapters and
 * pages that lead to reuse, and ends in each page's sources. Siblings that
 * lead to no reuse are left out at every level. A picture only, like the
 * Books view: a labelled image, full names in each node's tooltip, hidden
 * below `md`; the pages table lists the same with links.
 */

const ROW = 20;
const NODE_H = 24;
const MARGIN = 12;
const LABEL_PX = 11;
const TITLE_PX = 12;
/** Chapter and page labels sit between a node and its parent, so they're kept shorter. */
const BRANCH_LABEL_MAX = 160;
const LEAF_LABEL_MAX = 180;
const COLUMN_MIN = 64;
const LABEL_GAP = 6;
const CENTER_MIN = 140;
const CENTER_MAX = 360;

type Node = HierarchyPointNode<ReuseTreeDatum>;

/**
 * Short reuse names for the tree, where width is tight: the library that
 * follows already says "another library", and every embedded section is live.
 */
const SHORT_TYPE: Partial<Record<ReuseEdgeType, string>> = {
  "transclude-cross": EDGE_TYPE_LABELS["transclude-same"],
  section: "Embedded section",
};

/**
 * A source's details after its title: how it's reused, its library when it
 * isn't this book's own, and any problem.
 */
const sourceDetail = (d: ReuseTreeDatum, bookLib: string | null) =>
  [
    d.type ? (SHORT_TYPE[d.type] ?? EDGE_TYPE_LABELS[d.type]) : null,
    d.lib && d.lib !== bookLib ? libraryLabel(d.lib) : null,
    d.status && d.status !== "active" ? STATUS_BADGES[d.status].label : null,
  ]
    .filter(Boolean)
    .join(" · ");

const BookReuseTree: React.FC<{ bookTitle: string; pages: ContentSourcesPage[] }> = ({ bookTitle, pages }) => {
  const bookLib = pages[0]?.lib ?? null;
  const figure = useMemo(() => {
    const model = buildReuseTree(pages, bookTitle);
    const root = tree<ReuseTreeDatum>().nodeSize([ROW, 1])(hierarchy(model.root));
    const nodes = root.descendants().filter((n) => n.depth > 0);

    // Each column is as far from the last as its widest branch label needs
    // (labels of branches sit between a node and its parent, as in d3's tree).
    const maxDepth = Math.max(0, ...nodes.map((n) => n.depth));
    const columnX: number[] = [];
    const centerW = clamp(measure(truncateLabel(bookTitle), TITLE_PX, true) + 28, CENTER_MIN, CENTER_MAX);
    const boxRight = MARGIN + centerW;
    let x = boxRight;
    for (let depth = 1; depth <= maxDepth; depth += 1) {
      const branchW = Math.max(
        0,
        ...nodes
          .filter((n) => n.depth === depth && n.children)
          .map((n) => Math.min(BRANCH_LABEL_MAX, measure(truncateLabel(n.data.label), LABEL_PX, true))),
      );
      x += Math.max(COLUMN_MIN, branchW + LABEL_GAP + 22);
      columnX[depth] = x;
    }
    const leafW = (n: Node) =>
      Math.min(LEAF_LABEL_MAX, measure(truncateLabel(n.data.label), LABEL_PX)) +
      (n.data.kind === "source" ? measure(` · ${sourceDetail(n.data, bookLib)}`, LABEL_PX) : 0);
    const right = Math.max(
      boxRight,
      ...nodes.filter((n) => !n.children).map((n) => columnX[n.depth] + LABEL_GAP + leafW(n)),
    );
    const width = right + MARGIN + 8;

    const top = Math.min(-NODE_H, ...nodes.map((n) => n.x - (n.children ? ROW : ROW / 2)));
    const bottom = Math.max(NODE_H, ...nodes.map((n) => n.x + ROW / 2));
    const note = model.hiddenPages > 0 ? 18 : 0;
    const height = bottom - top + 2 * MARGIN + note;
    const centerY = MARGIN - top;

    return { model, nodes, columnX, centerW, boxRight, width, height, centerY };
  }, [pages, bookTitle, bookLib]);

  const { model, nodes, columnX, centerW, boxRight, width, height, centerY } = figure;

  if (model.reusedPages === 0) {
    return <Text className="block text-neutral-700">No page in this book reuses content from another page.</Text>;
  }

  const xOf = (n: Node) => (n.depth === 0 ? boxRight : columnX[n.depth]);
  const yOf = (n: Node) => centerY + n.x;
  const summary = [
    `${bookTitle}: ${model.reusedPages} of ${plural(model.totalPages, "page")} reuse content`,
    `in ${plural(model.chapters, "chapter")}, from ${plural(model.sources, "source page")}.`,
    model.hiddenPages > 0 ? `The first ${model.shownPages} are drawn.` : "",
  ]
    .join(" ")
    .trim();

  return (
    <figure className="m-0 hidden md:block">
      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${width} ${height}`}
        // Drawn at its natural size: it may shrink to fit, never grow.
        width={width}
        height={height}
        className="h-auto max-w-full"
      >
        <g fill="none" className="stroke-neutral-400" strokeWidth={1.5}>
          {nodes.map((n) => (
            <path
              key={`link-${n.data.key}`}
              d={link({ source: [xOf(n.parent!), yOf(n.parent!)], target: [xOf(n), yOf(n)] }) ?? ""}
            />
          ))}
        </g>
        {nodes.map((n) => {
          const nx = xOf(n);
          const ny = yOf(n);
          const branch = !!n.children;
          const source = n.data.kind === "source";
          return (
            <g key={`node-${n.data.key}`}>
              <title>
                {source
                  ? `${n.data.label} (${sourceDetail(n.data, bookLib)})`
                  : `${n.data.label}${n.data.reuses ? " (reuses content)" : ""}`}
              </title>
              <circle
                cx={nx}
                cy={ny}
                r={3}
                className={source ? "fill-neutral-400" : n.data.reuses ? "fill-neutral-900" : "fill-neutral-600"}
              />
              <text
                // As in the example, a branch's label faces its parent and a leaf's
                // faces out. A branch's sits just above its dot: links arrive level,
                // so the label stays clear of them and of its siblings' curves.
                x={nx + (branch ? -LABEL_GAP : LABEL_GAP)}
                y={branch ? ny - 6 : ny}
                dy={branch ? undefined : "0.31em"}
                textAnchor={branch ? "end" : "start"}
                className={`${HALO} text-[11px] ${
                  source ? "fill-neutral-800" : n.data.reuses ? "fill-neutral-900 font-semibold" : "fill-neutral-700"
                }`}
              >
                {fitLabel(n.data.label, branch ? BRANCH_LABEL_MAX : LEAF_LABEL_MAX, LABEL_PX, branch)}
                {source && <tspan className="fill-neutral-500"> · {sourceDetail(n.data, bookLib)}</tspan>}
              </text>
            </g>
          );
        })}
        <rect
          x={MARGIN}
          y={centerY - NODE_H / 2 - 2}
          width={centerW}
          height={NODE_H + 4}
          rx={6}
          className="fill-white stroke-neutral-600 [stroke-width:1.5]"
        />
        <text
          x={MARGIN + centerW / 2}
          y={centerY}
          dy="0.31em"
          textAnchor="middle"
          className="fill-neutral-900 text-[12px] font-semibold"
        >
          {fitLabel(bookTitle, centerW - 20, TITLE_PX, true)}
        </text>
        {model.hiddenPages > 0 && (
          <text x={MARGIN} y={height - 8} className="fill-neutral-600 text-[11px]">
            and {plural(model.hiddenPages, "more page")} that reuse content (all are in the pages table)
          </text>
        )}
      </svg>
      <figcaption className="mt-1 text-xs text-neutral-600">
        Only the chapters and pages that lead to reuse are shown: {model.reusedPages} of{" "}
        {plural(model.totalPages, "page")} reuse content. Bold pages reuse content themselves; their sources
        follow them, with how each is reused and, when it's another library's, the library.
      </figcaption>
    </figure>
  );
};

export default BookReuseTree;
