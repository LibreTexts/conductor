import React, { useMemo } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3";
import type { BookGraph } from "../../../../types/ContentSources";
import {
  estimateTextWidth,
  truncateLabel,
} from "../../../../components/projects/ContentSources/svgText";

/**
 * The book connection graph as a force-directed layout. The layout is
 * computed once, synchronously (no animation), so the picture is stable and
 * respects reduced-motion preferences. A labelled image only: the table
 * next to it lists the same links with real links and is the accessible view.
 */

type Node = SimulationNodeDatum & {
  id: string;
  title: string;
  kind: "book" | "library";
  radius: number;
  lib: string | null;
};
type Link = SimulationLinkDatum<Node> & { pages: number };

const WIDTH = 900;
const HEIGHT = 560;
const LABELS = 12;

/** Library colour classes, stable per library name. */
const PALETTE = [
  "fill-sky-500",
  "fill-amber-500",
  "fill-emerald-500",
  "fill-violet-500",
  "fill-rose-500",
  "fill-teal-500",
  "fill-orange-500",
  "fill-indigo-500",
];
const colorFor = (lib: string | null) => {
  if (!lib) return "fill-neutral-400";
  let hash = 0;
  for (const ch of lib) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
};

const LABEL_PX = 11;

const ForceBookGraph: React.FC<{ graph: BookGraph; summary: string }> = ({ graph, summary }) => {
  const layout = useMemo(() => {
    const maxPages = Math.max(1, ...graph.nodes.map((n) => n.pages ?? 0));
    const nodes: Node[] = graph.nodes.map((n) => ({
      id: n.id,
      title: n.title,
      kind: n.kind,
      lib: n.lib,
      radius: n.kind === "library" ? 9 : 5 + Math.sqrt((n.pages ?? 1) / maxPages) * 14,
    }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links: Link[] = graph.edges
      .filter((e) => byId.has(e.source) && byId.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, pages: e.pages }));
    const maxLink = Math.max(1, ...links.map((l) => l.pages));

    const simulation = forceSimulation(nodes)
      .force("link", forceLink<Node, Link>(links).id((d) => d.id).distance(90))
      .force("charge", forceManyBody().strength(-160))
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
      .force("collide", forceCollide<Node>().radius((d) => d.radius + 4))
      .stop();
    for (let i = 0; i < 300; i += 1) simulation.tick();

    const labelled = new Set(
      [...graph.nodes].sort((a, b) => b.degree - a.degree).slice(0, LABELS).map((n) => n.id),
    );

    // Fit what the simulation produced into the view, labels included: a
    // label runs to the right of its dot, so it widens the area instead of
    // being cut off.
    const pad = 20;
    const rightEdges = nodes.map(
      (n) =>
        (n.x ?? 0) +
        n.radius +
        (labelled.has(n.id) ? 4 + estimateTextWidth(truncateLabel(n.title), LABEL_PX) : 0),
    );
    const minX = Math.min(...nodes.map((n) => (n.x ?? 0) - n.radius)) - pad;
    const minY = Math.min(...nodes.map((n) => (n.y ?? 0) - n.radius)) - pad;
    const w = Math.max(...rightEdges) - minX + pad;
    const h = Math.max(...nodes.map((n) => (n.y ?? 0) + n.radius)) - minY + pad;
    const width = Math.max(w, 200);
    const height = Math.max(h, 160);
    return { nodes, links, maxLink, viewBox: `${minX} ${minY} ${width} ${height}`, width, height, labelled };
  }, [graph]);

  return (
    // Drawn at its natural size (one layout unit = one pixel): it may shrink
    // to fit, never grow, so a small graph isn't blown up on a wide screen.
    <svg
      role="img"
      aria-label={summary}
      viewBox={layout.viewBox}
      width={layout.width}
      height={layout.height}
      className="mx-auto block h-auto max-w-full"
    >
      <defs>
        <marker id="cr-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-neutral-400" />
        </marker>
      </defs>
      {layout.links.map((link) => {
        const s = link.source as Node;
        const t = link.target as Node;
        // Stop the line at the target's edge so the arrowhead shows.
        const dx = (t.x ?? 0) - (s.x ?? 0);
        const dy = (t.y ?? 0) - (s.y ?? 0);
        const len = Math.max(1, Math.hypot(dx, dy));
        const x2 = (t.x ?? 0) - (dx / len) * (t.radius + 2);
        const y2 = (t.y ?? 0) - (dy / len) * (t.radius + 2);
        return (
          <line
            key={`${s.id}>${t.id}`}
            x1={s.x}
            y1={s.y}
            x2={x2}
            y2={y2}
            strokeWidth={1 + (link.pages / layout.maxLink) * 4}
            className="stroke-neutral-300"
            markerEnd="url(#cr-arrow)"
          />
        );
      })}
      {layout.nodes.map((node) => (
        <g key={node.id}>
          <circle
            cx={node.x}
            cy={node.y}
            r={node.radius}
            className={
              node.kind === "library"
                ? "fill-white stroke-neutral-500 [stroke-dasharray:3_2] [stroke-width:1.5]"
                : `${colorFor(node.lib)} stroke-white [stroke-width:1.5]`
            }
          >
            <title>{node.title}</title>
          </circle>
          {layout.labelled.has(node.id) && (
            <text
              x={(node.x ?? 0) + node.radius + 4}
              y={(node.y ?? 0) + 4}
              className="fill-neutral-800 text-[11px]"
            >
              {truncateLabel(node.title)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};

export default ForceBookGraph;
