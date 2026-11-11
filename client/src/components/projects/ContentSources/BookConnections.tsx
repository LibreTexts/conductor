import React from "react";
import type {
  ContentSourcesBookLink,
  ContentSourcesUnscannedGroup,
} from "../../../types/ContentSources";
import { plural } from "./labels";

/**
 * The book and its neighbours: books it reuses from on the left, books that
 * reuse it on the right, line width by pages shared. A picture only: the
 * tables beside it carry the same information with links, so the SVG is a
 * labelled image with no focusable parts.
 */

type GraphNode = {
  key: string;
  label: string;
  pages: number;
  /** A library whose books the scanner hasn't reached. */
  unscanned?: boolean;
};

const WIDTH = 760;
const ROW = 44;
const NODE_W = 220;
const NODE_H = 32;
const MAX_PER_SIDE = 8;

const truncate = (text: string, max = 30) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

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
  const height = rows * ROW + 40;
  const centerY = height / 2;
  const maxPages = Math.max(
    1,
    ...left.nodes.map((n) => n.pages),
    ...right.nodes.map((n) => n.pages),
  );
  const strokeFor = (pages: number) => 1.5 + (pages / maxPages) * 5;
  const yFor = (index: number, count: number) =>
    centerY + (index - (count - 1) / 2) * ROW;

  const centerX = WIDTH / 2;
  const leftX = 10;
  const rightX = WIDTH - NODE_W - 10;

  const summary = [
    `${bookTitle}.`,
    left.nodes.length
      ? `Reuses content from ${plural(left.nodes.length + left.hidden, "source")}.`
      : "Reuses no content from other books.",
    right.nodes.length
      ? `${plural(right.nodes.length + right.hidden, "book")} reuse its content.`
      : "No other book reuses its content.",
  ].join(" ");

  const box = (node: GraphNode, x: number, y: number, side: "left" | "right") => (
    <g key={`${side}-${node.key}`}>
      <rect
        x={x}
        y={y - NODE_H / 2}
        width={NODE_W}
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
        className="fill-neutral-800 text-[12px]"
      >
        {truncate(node.label)}
      </text>
      <text
        x={x + NODE_W - 10}
        y={y + 4}
        textAnchor="end"
        className="fill-neutral-600 text-[11px]"
      >
        {node.pages}
      </text>
    </g>
  );

  return (
    <figure className="m-0">
      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="h-auto w-full max-w-full"
      >
        {left.nodes.map((node, i) => {
          const y = yFor(i, left.nodes.length);
          return (
            <line
              key={`l-edge-${node.key}`}
              x1={leftX + NODE_W}
              y1={y}
              x2={centerX - NODE_W / 2}
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
              x1={centerX + NODE_W / 2}
              y1={centerY}
              x2={rightX}
              y2={y}
              strokeWidth={strokeFor(node.pages)}
              className="stroke-amber-400"
            />
          );
        })}
        {left.nodes.map((node, i) => box(node, leftX, yFor(i, left.nodes.length), "left"))}
        {right.nodes.map((node, i) => box(node, rightX, yFor(i, right.nodes.length), "right"))}
        <rect
          x={centerX - NODE_W / 2}
          y={centerY - NODE_H / 2 - 4}
          width={NODE_W}
          height={NODE_H + 8}
          rx={8}
          className="fill-sky-50 stroke-sky-700 [stroke-width:2]"
        />
        <text
          x={centerX}
          y={centerY + 4}
          textAnchor="middle"
          className="fill-neutral-900 text-[13px] font-semibold"
        >
          {truncate(bookTitle, 28)}
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
      <figcaption className="mt-2 text-sm text-neutral-600">
        Left: where this book's content comes from. Right: books that reuse
        it. Numbers are pages; dashed boxes are libraries not scanned yet.
      </figcaption>
    </figure>
  );
};

export default BookConnections;
