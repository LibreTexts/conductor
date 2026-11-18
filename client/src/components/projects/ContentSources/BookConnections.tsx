import React, { useMemo } from "react";
import { hierarchy, tree, type HierarchyPointNode } from "d3";
import type {
  ContentSourcesBookLink,
  ContentSourcesUnscannedGroup,
} from "../../../types/ContentSources";
import { plural } from "./labels";
import { truncateLabel } from "./svgText";
import { HALO, clamp, fitLabel, libraryLabel, link, measure } from "./treeDraw";

/**
 * The book and its neighbours as a two-sided tidy tree, adapted from d3's
 * "Tidy tree" (https://observablehq.com/@d3/tree/2): books it takes content
 * from fan out to the left, books that reuse it to the right, each side
 * grouped by library. As in the example: thin solid links, columns evenly
 * spaced, dark dots for branches (libraries) and light dots for leaves
 * (books), branch labels facing their parent and leaf labels facing out, all
 * on a white halo. A picture only: the tables beside it carry the same
 * information with links, so the SVG is a labelled image with no focusable
 * parts, and it is hidden below `md`.
 */

type TreeDatum = {
  key: string;
  label: string;
  pages: number;
  /** A library whose books the scanner hasn't reached. */
  unscanned?: boolean;
  children?: TreeDatum[];
};

type Side = {
  root: TreeDatum;
  /** Books (or unscanned libraries) left out by the cap. */
  hidden: number;
  /** All sources on this side, shown or not. */
  count: number;
  libraries: number;
};

/** Leaves per side before the rest become "and N more". */
const MAX_PER_SIDE = 8;
/** The example's `dx`: vertical distance between neighbouring leaves. */
const ROW = 20;
const NODE_H = 24;
const MARGIN = 12;
const LABEL_PX = 11;
const TITLE_PX = 12;
const LEAF_LABEL_MAX = 220;
const LIB_LABEL_MAX = 150;
/** The example's `dy` floor: the distance between columns. */
const COLUMN_MIN = 72;
/** Between a dot and its label (the example's 6px). */
const LABEL_GAP = 6;
const CENTER_MIN = 140;
const CENTER_MAX = 420;

const libOf = (book: ContentSourcesBookLink) => book.lib ?? book.id.split("-")[0];

/**
 * One side's tree: this book → libraries → books. The biggest books are kept.
 * A library the scanner hasn't reached has no books to show, so it is a leaf
 * itself ("Engineering · not scanned yet").
 */
const buildSide = (links: ContentSourcesBookLink[], unscanned: ContentSourcesUnscannedGroup[] = []): Side => {
  const leaves = [
    ...links.map((l) => ({ lib: libOf(l), datum: { key: l.id, label: l.title, pages: l.pages } as TreeDatum })),
    ...unscanned.map((g) => ({
      lib: g.lib,
      datum: { key: `unscanned:${g.lib}`, label: "Not scanned yet", pages: g.pages, unscanned: true } as TreeDatum,
    })),
  ].sort((a, b) => b.datum.pages - a.datum.pages);
  const kept = leaves.slice(0, MAX_PER_SIDE);

  const byLib = new Map<string, TreeDatum[]>();
  for (const { lib, datum } of kept) byLib.set(lib, [...(byLib.get(lib) ?? []), datum]);
  const libraries: TreeDatum[] = [...byLib.entries()]
    .map(([lib, children]) => {
      const pages = children.reduce((sum, c) => sum + c.pages, 0);
      return children.every((c) => c.unscanned)
        ? { key: `lib:${lib}`, label: `${libraryLabel(lib)} · not scanned yet`, pages, unscanned: true }
        : { key: `lib:${lib}`, label: libraryLabel(lib), pages, children };
    })
    .sort((a, b) => b.pages - a.pages);

  return {
    root: { key: "root", label: "", pages: 0, children: libraries },
    hidden: leaves.length - kept.length,
    count: leaves.length,
    libraries: new Set(leaves.map((l) => l.lib)).size,
  };
};

/** The example's layout: `x` is the vertical position (0 = this book), `depth` the column. */
const layOut = (side: Side) => tree<TreeDatum>().nodeSize([ROW, 1])(hierarchy(side.root));

/** A leaf's label: its name, then its page count. */
const leafWidth = (n: HierarchyPointNode<TreeDatum>) =>
  Math.min(LEAF_LABEL_MAX, measure(truncateLabel(n.data.label), LABEL_PX)) + measure(` ${n.data.pages}`, LABEL_PX);

interface BookConnectionsProps {
  bookTitle: string;
  upstream: ContentSourcesBookLink[];
  downstream: ContentSourcesBookLink[];
  unscannedSources: ContentSourcesUnscannedGroup[];
}

const BookConnections: React.FC<BookConnectionsProps> = ({
  bookTitle,
  upstream,
  downstream,
  unscannedSources,
}) => {
  const figure = useMemo(() => {
    const left = buildSide(upstream, unscannedSources);
    const right = buildSide(downstream);
    const leftTree = layOut(left);
    const rightTree = layOut(right);

    // Evenly spaced columns out from the centre box's edge (the example's
    // `dy`), wide enough for a branch label between a library and the box.
    // Labels of leaves (books, unscanned libraries) run outside the last dot.
    const columns = (root: HierarchyPointNode<TreeDatum>) => {
      const nodes = root.descendants().filter((n) => n.depth > 0);
      if (nodes.length === 0) return { step: 0, extent: 0 };
      const branchW = Math.min(
        LIB_LABEL_MAX,
        Math.max(0, ...nodes.filter((n) => n.children).map((n) => measure(n.data.label, LABEL_PX, true))),
      );
      const step = Math.max(COLUMN_MIN, branchW + LABEL_GAP + 28);
      const extent = Math.max(...nodes.filter((n) => !n.children).map((n) => n.depth * step + LABEL_GAP + leafWidth(n)));
      return { step, extent: extent + 16 };
    };
    const leftCols = columns(leftTree);
    const rightCols = columns(rightTree);

    const centerW = clamp(measure(truncateLabel(bookTitle), TITLE_PX, true) + 28, CENTER_MIN, CENTER_MAX);
    const boxLeft = MARGIN + leftCols.extent;
    const boxRight = boxLeft + centerW;
    const width = boxRight + rightCols.extent + MARGIN;

    const all = [...leftTree.descendants(), ...rightTree.descendants()];
    const top = Math.min(-NODE_H, ...all.map((n) => n.x - ROW / 2));
    const bottom = Math.max(NODE_H, ...all.map((n) => n.x + ROW / 2));
    const note = left.hidden > 0 || right.hidden > 0 ? 18 : 0;
    const height = bottom - top + 2 * MARGIN + note;
    const centerY = MARGIN - top;

    return { left, right, leftTree, rightTree, leftCols, rightCols, centerW, boxLeft, boxRight, width, height, centerY };
  }, [bookTitle, upstream, downstream, unscannedSources]);

  const { left, right, leftTree, rightTree, leftCols, rightCols, centerW, boxLeft, boxRight, width, height, centerY } = figure;

  const summary = [
    `${bookTitle}.`,
    left.count
      ? `Reuses content from ${plural(left.count, "source")} in ${plural(left.libraries, "library", "libraries")}.`
      : "Reuses no content from other books.",
    right.count
      ? `${plural(right.count, "book")} in ${plural(right.libraries, "library", "libraries")} reuse its content.`
      : "No other book reuses its content.",
  ].join(" ");

  /** Draws one side; `dir` is -1 for the left (mirrored), 1 for the right. */
  const drawSide = (root: HierarchyPointNode<TreeDatum>, step: number, dir: -1 | 1, edge: number) => {
    const xOf = (n: HierarchyPointNode<TreeDatum>) => edge + dir * n.depth * step;
    const yOf = (n: HierarchyPointNode<TreeDatum>) => centerY + n.x;
    const nodes = root.descendants().filter((n) => n.depth > 0);

    return (
      <g>
        <g fill="none" className="stroke-neutral-400" strokeWidth={1.5}>
          {nodes.map((n) => {
            const from: [number, number] = n.depth === 1 ? [edge, centerY] : [xOf(n.parent!), yOf(n.parent!)];
            return <path key={`link-${n.data.key}`} d={link({ source: from, target: [xOf(n), yOf(n)] }) ?? ""} />;
          })}
        </g>
        {nodes.map((n) => {
          const x = xOf(n);
          const y = yOf(n);
          const branch = !!n.children;
          // As in the example: a branch's label faces its parent, a leaf's faces out.
          const side = branch ? -dir : dir;
          return (
            <g key={`node-${n.data.key}`}>
              <title>
                {branch
                  ? `${n.data.label} library: ${plural(n.data.pages, "page")}`
                  : `${n.data.label}: ${plural(n.data.pages, "page")}`}
              </title>
              <circle cx={x} cy={y} r={3} className={branch ? "fill-neutral-600" : "fill-neutral-400"} />
              <text
                x={x + side * LABEL_GAP}
                y={y}
                dy="0.31em"
                textAnchor={side < 0 ? "end" : "start"}
                className={`${HALO} text-[11px] ${
                  branch
                    ? "fill-neutral-900 font-semibold"
                    : n.data.unscanned
                      ? "fill-neutral-600 italic"
                      : "fill-neutral-800"
                }`}
              >
                {branch
                  ? fitLabel(n.data.label, LIB_LABEL_MAX, LABEL_PX, true)
                  : fitLabel(n.data.label, LEAF_LABEL_MAX, LABEL_PX)}
                {!branch && <tspan className="fill-neutral-500"> {n.data.pages}</tspan>}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  return (
    // Hidden on small screens: at phone width the labels would be unreadable,
    // and the tables beside it carry the same information with links.
    <figure className="m-0 hidden md:block">
      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${width} ${height}`}
        // Drawn at its natural size: it may shrink to fit, never grow, so
        // text stays at the size it was designed for on wide screens.
        width={width}
        height={height}
        className="h-auto max-w-full"
      >
        {drawSide(leftTree, leftCols.step, -1, boxLeft)}
        {drawSide(rightTree, rightCols.step, 1, boxRight)}
        <rect
          x={boxLeft}
          y={centerY - NODE_H / 2 - 2}
          width={centerW}
          height={NODE_H + 4}
          rx={6}
          className="fill-white stroke-neutral-600 [stroke-width:1.5]"
        />
        <text
          x={boxLeft + centerW / 2}
          y={centerY}
          dy="0.31em"
          textAnchor="middle"
          className="fill-neutral-900 text-[12px] font-semibold"
        >
          {fitLabel(bookTitle, centerW - 20, TITLE_PX, true)}
        </text>
        {left.hidden > 0 && (
          <text x={boxLeft - 2 * leftCols.step} y={height - 8} textAnchor="end" className="fill-neutral-600 text-[11px]">
            and {left.hidden} more
          </text>
        )}
        {right.hidden > 0 && (
          <text x={boxRight + 2 * rightCols.step} y={height - 8} className="fill-neutral-600 text-[11px]">
            and {right.hidden} more
          </text>
        )}
      </svg>
      <figcaption className="mt-1 text-xs text-neutral-600">
        Left: where this book's content comes from, by library. Right: books
        that reuse it, by library. Numbers are pages.
      </figcaption>
    </figure>
  );
};

export default BookConnections;
