import React from "react";
import type {
  ContentSourcesBookLink,
  ContentSourcesUnscannedGroup,
} from "../../../types/ContentSources";
import { plural } from "./labels";
import { estimateTextWidth, truncateLabel } from "./svgText";

/**
 * The book and its neighbours: books it reuses from on the left, books that
 * reuse it on the right, line width by pages shared. A picture only: the
 * tables beside it carry the same information with links, so the SVG is a
 * labelled image with no focusable parts, and it is hidden below `md`.
 */

type GraphNode = {
  key: string;
  label: string;
  pages: number;
  /** A library whose books the scanner hasn't reached. */
  unscanned?: boolean;
};

const ROW = 30;
const NODE_H = 24;
const MAX_PER_SIDE = 8;
/** Horizontal run of the connecting lines between a side and the centre. */
const GAP = 70;
const MARGIN = 10;
const LABEL_PX = 11;
const TITLE_PX = 12;
/** Room in a side box for its padding and the page count. */
const BOX_EXTRA = 50;
/** Box widths: wide enough for the longest label, within reason. */
const SIDE_MIN = 120;
const SIDE_MAX = 380;
const CENTER_MIN = 140;
const CENTER_MAX = 420;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Cuts a label only when it is wider than its box even at the maximum width. */
const fitLabel = (label: string, room: number, px: number, bold = false) => {
  let text = truncateLabel(label);
  while (text.length > 4 && estimateTextWidth(text, px, bold) > room) {
    text = `${text.slice(0, -2)}…`;
  }
  return text;
};

const sideNodes = (
  links: ContentSourcesBookLink[],
  unscanned: ContentSourcesUnscannedGroup[] = [],
): { nodes: GraphNode[]; hidden: number } => {
  const all: GraphNode[] = [
    ...links.map((l) => ({ key: l.id, label: l.title, pages: l.pages })),
    ...unscanned.map((g) => ({
      key: `lib:${g.lib}`,
      label: `${g.lib} library (not scanned yet)`,
      pages: g.pages,
      unscanned: true,
    })),
  ].sort((a, b) => b.pages - a.pages);
  return {
    nodes: all.slice(0, MAX_PER_SIDE),
    hidden: Math.max(0, all.length - MAX_PER_SIDE),
  };
};

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
  const left = sideNodes(upstream, unscannedSources);
  const right = sideNodes(downstream);
  const rows = Math.max(left.nodes.length, right.nodes.length, 1);
  const height = rows * ROW + 24;
  const centerY = height / 2;
  const maxPages = Math.max(
    1,
    ...left.nodes.map((n) => n.pages),
    ...right.nodes.map((n) => n.pages),
  );
  const strokeFor = (pages: number) => 1.5 + (pages / maxPages) * 5;
  const yFor = (index: number, count: number) =>
    centerY + (index - (count - 1) / 2) * ROW;

  // Each side's boxes are as wide as its longest label (plus room for the
  // page count), the centre box as wide as the title, so nothing is cut
  // while there is room; the figure is only as wide as that adds up to.
  const sideWidth = (nodes: GraphNode[]) =>
    nodes.length === 0
      ? 0
      : clamp(
          Math.max(...nodes.map((n) => estimateTextWidth(truncateLabel(n.label), LABEL_PX))) + BOX_EXTRA,
          SIDE_MIN,
          SIDE_MAX,
        );
  const leftW = sideWidth(left.nodes);
  const rightW = sideWidth(right.nodes);
  const centerW = clamp(
    estimateTextWidth(truncateLabel(bookTitle), TITLE_PX, true) + 28,
    CENTER_MIN,
    CENTER_MAX,
  );

  const leftX = MARGIN;
  const centerLeft = leftX + leftW + (leftW ? GAP : 0);
  const centerX = centerLeft + centerW / 2;
  const rightX = centerLeft + centerW + (rightW ? GAP : 0);
  const WIDTH = rightX + rightW + MARGIN;

  const summary = [
    `${bookTitle}.`,
    left.nodes.length
      ? `Reuses content from ${plural(left.nodes.length + left.hidden, "source")}.`
      : "Reuses no content from other books.",
    right.nodes.length
      ? `${plural(right.nodes.length + right.hidden, "book")} reuse its content.`
      : "No other book reuses its content.",
  ].join(" ");

  const box = (node: GraphNode, x: number, y: number, side: "left" | "right", boxW: number) => (
    <g key={`${side}-${node.key}`}>
      <title>{node.label}</title>
      <rect
        x={x}
        y={y - NODE_H / 2}
        width={boxW}
        height={NODE_H}
        rx={6}
        className={
          node.unscanned
            ? "fill-white stroke-neutral-400 [stroke-dasharray:4_3]"
            : "fill-white stroke-neutral-500"
        }
      />
      <text
        x={x + 10}
        y={y + 4}
        className="fill-neutral-800 text-[11px]"
      >
        {fitLabel(node.label, boxW - BOX_EXTRA, LABEL_PX)}
      </text>
      <text
        x={x + boxW - 10}
        y={y + 4}
        textAnchor="end"
        className="fill-neutral-600 text-[10px]"
      >
        {node.pages}
      </text>
    </g>
  );

  return (
    // Hidden on small screens: at phone width the labels would be unreadable,
    // and the tables beside it carry the same information with links.
    <figure className="m-0 hidden md:block">
      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${WIDTH} ${height}`}
        // Drawn at its natural size: it may shrink to fit, never grow, so
        // text stays at the size it was designed for on wide screens.
        width={WIDTH}
        height={height}
        className="h-auto max-w-full"
      >
        {left.nodes.map((node, i) => {
          const y = yFor(i, left.nodes.length);
          return (
            <line
              key={`l-edge-${node.key}`}
              x1={leftX + leftW}
              y1={y}
              x2={centerLeft}
              y2={centerY}
              strokeWidth={strokeFor(node.pages)}
              className={node.unscanned ? "stroke-neutral-300" : "stroke-sky-400"}
            />
          );
        })}
        {right.nodes.map((node, i) => {
          const y = yFor(i, right.nodes.length);
          return (
            <line
              key={`r-edge-${node.key}`}
              x1={centerLeft + centerW}
              y1={centerY}
              x2={rightX}
              y2={y}
              strokeWidth={strokeFor(node.pages)}
              className="stroke-amber-400"
            />
          );
        })}
        {left.nodes.map((node, i) => box(node, leftX, yFor(i, left.nodes.length), "left", leftW))}
        {right.nodes.map((node, i) => box(node, rightX, yFor(i, right.nodes.length), "right", rightW))}
        <rect
          x={centerLeft}
          y={centerY - NODE_H / 2 - 4}
          width={centerW}
          height={NODE_H + 8}
          rx={8}
          className="fill-sky-50 stroke-sky-700 [stroke-width:2]"
        />
        <text
          x={centerX}
          y={centerY + 4}
          textAnchor="middle"
          className="fill-neutral-900 text-[12px] font-semibold"
        >
          {fitLabel(bookTitle, centerW - 20, TITLE_PX, true)}
        </text>
        {left.hidden > 0 && (
          <text x={leftX} y={height - 6} className="fill-neutral-600 text-[11px]">
            and {left.hidden} more
          </text>
        )}
        {right.hidden > 0 && (
          <text x={rightX} y={height - 6} className="fill-neutral-600 text-[11px]">
            and {right.hidden} more
          </text>
        )}
      </svg>
      <figcaption className="mt-1 text-xs text-neutral-600">
        Left: where this book's content comes from. Right: books that reuse
        it. Numbers are pages; dashed boxes are libraries not scanned yet.
      </figcaption>
    </figure>
  );
};

export default BookConnections;
