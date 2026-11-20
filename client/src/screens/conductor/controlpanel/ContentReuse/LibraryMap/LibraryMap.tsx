import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { quadtree, select, zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3";
import type { LibraryMap as LibraryMapData } from "../../../../../types/ContentSources";
import { libraryLabel } from "../../../../../components/projects/ContentSources/treeDraw";
import { plural } from "../../../../../components/projects/ContentSources/labels";
import type { LayoutOutput } from "./layout";
import { nodeRadius } from "./layout";
import type { MapModel } from "./mapModel";

export type MapFilters = {
  /** Libraries to show; null = all. */
  libs: Set<string> | null;
  /** Only books with at least one link. */
  sharedOnly: boolean;
  /** Which links to draw. */
  links: "all" | "live" | "copies";
};

type Props = {
  map: LibraryMapData;
  layout: LayoutOutput;
  model: MapModel;
  filters: MapFilters;
  selected: number | null;
  onSelect: (index: number) => void;
  /** Bump `nonce` to fly to `index` (from search or the book panel). */
  focus: { index: number; nonce: number } | null;
  /** Bump to fit the whole map again. */
  resetNonce: number;
  summary: string;
};

const HEIGHT = 640;
/** Books labelled at any zoom: the most reused. */
const ALWAYS_LABELLED = 12;
const LABEL_FONT = '11px "Atkinson Hyperlegible", system-ui, sans-serif';
const ISLAND_FONT = '600 13px "Atkinson Hyperlegible", system-ui, sans-serif';

/**
 * The library map on a canvas (thousands of dots draw smoothly there, unlike
 * SVG): d3-zoom pans and zooms, a quadtree finds the dot under the pointer.
 * Hovering highlights a book and its neighbours; clicking opens its panel.
 * Books the filters hide aren't drawn. A labelled image for assistive
 * technology: the page's search and book panel give the same detail.
 */
const LibraryMap: React.FC<Props> = ({ map, layout, model, filters, selected, onSelect, focus, resetNonce, summary }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const zoomRef = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const frameRef = useRef<number | null>(null);
  const [width, setWidth] = useState(900);
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);

  const radius = useMemo(() => map.nodes.map((n) => nodeRadius(n.reusedBy, n.kind)), [map]);
  const maxPages = useMemo(() => Math.max(1, ...map.edges.map((e) => e[2])), [map]);
  // Biggest first for labels; smallest first for drawing, so big dots sit on top.
  const bySize = useMemo(() => [...map.nodes.keys()].sort((a, b) => radius[b] - radius[a]), [map, radius]);
  const drawOrder = useMemo(() => [...bySize].reverse(), [bySize]);

  const visible = useMemo(() => {
    const v = new Uint8Array(map.nodes.length);
    map.nodes.forEach((node, i) => {
      const libOk = !filters.libs || filters.libs.has(node.lib);
      const sharedOk = !filters.sharedOnly || model.linked[i] === 1;
      v[i] = libOk && sharedOk ? 1 : 0;
    });
    return v;
  }, [map, filters, model]);

  const finder = useMemo(
    () =>
      quadtree<number>()
        .x((i) => layout.x[i])
        .y((i) => layout.y[i])
        .addAll([...map.nodes.keys()].filter((i) => visible[i])),
    [map, layout, visible],
  );

  const draw = useCallback(() => {
    frameRef.current = null;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const t = transformRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, HEIGHT);
    ctx.fillStyle = "#fcfcfb";
    ctx.fillRect(0, 0, width, HEIGHT);
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    // Many links fade, so thousands of them read as a field, not a blot.
    const restingLink = `rgba(115,115,115,${Math.max(0.07, Math.min(0.35, 0.35 * Math.sqrt(150 / Math.max(1, map.edges.length)))).toFixed(3)})`;
    const focusIndex = hover?.index ?? selected;
    const near = focusIndex !== null ? new Set([focusIndex, ...model.neighbours[focusIndex]]) : null;

    // Links: faint, solid for live reuse, dashed for copies; width by pages.
    for (const [s, tIdx, pages, mask] of map.edges) {
      if (!visible[s] || !visible[tIdx]) continue;
      const isLive = (mask & model.live) !== 0;
      if (filters.links === "live" && !isLive) continue;
      if (filters.links === "copies" && isLive) continue;
      const onFocus = near && (s === focusIndex || tIdx === focusIndex);
      ctx.strokeStyle = onFocus ? "rgba(23,23,23,0.75)" : near ? "rgba(115,115,115,0.06)" : restingLink;
      ctx.lineWidth = (0.6 + 2.6 * (pages / maxPages)) / t.k;
      ctx.setLineDash(isLive ? [] : [4 / t.k, 3 / t.k]);
      ctx.beginPath();
      ctx.moveTo(layout.x[s], layout.y[s]);
      ctx.lineTo(layout.x[tIdx], layout.y[tIdx]);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Dots: community colour; a dark ring for books needing attention.
    for (const i of drawOrder) {
      if (!visible[i]) continue;
      const node = map.nodes[i];
      ctx.globalAlpha = near && !near.has(i) ? 0.18 : 1;
      ctx.fillStyle = model.color[i];
      ctx.beginPath();
      if (node.kind === "library") {
        const r = radius[i];
        ctx.moveTo(layout.x[i], layout.y[i] - r);
        ctx.lineTo(layout.x[i] + r, layout.y[i]);
        ctx.lineTo(layout.x[i], layout.y[i] + r);
        ctx.lineTo(layout.x[i] - r, layout.y[i]);
        ctx.closePath();
      } else {
        ctx.arc(layout.x[i], layout.y[i], radius[i], 0, Math.PI * 2);
      }
      ctx.fill();
      if (node.attention.broken || node.attention.sourceChanged) {
        ctx.strokeStyle = "#171717";
        ctx.lineWidth = 1.5 / t.k;
        ctx.beginPath();
        ctx.arc(layout.x[i], layout.y[i], radius[i] + 2 / t.k, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (i === selected) {
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2.5 / t.k;
        ctx.beginPath();
        ctx.arc(layout.x[i], layout.y[i], radius[i] + 4 / t.k, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Text in screen space, so it stays the same size at any zoom.
    ctx.lineJoin = "round";
    const halo = (text: string, x: number, y: number) => {
      ctx.strokeStyle = "rgba(252,252,251,0.95)";
      ctx.lineWidth = 3;
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
    };
    // Library names just above their islands, while zoomed out.
    if (t.k < 2.2) {
      ctx.font = ISLAND_FONT;
      ctx.fillStyle = "#404040";
      ctx.textAlign = "center";
      for (const a of layout.anchors) {
        if (filters.libs && !filters.libs.has(a.lib)) continue;
        const [x, y] = t.apply([a.x, a.y - a.r]);
        halo(libraryLabel(a.lib), x, y - 6);
      }
    }
    // Book labels: the most reused first, more as you zoom in, never overlapping.
    ctx.font = LABEL_FONT;
    ctx.textAlign = "left";
    ctx.fillStyle = "#262626";
    const placed: [number, number, number, number][] = [];
    let labelled = 0;
    for (const i of bySize) {
      if (!visible[i] || labelled > 220) continue;
      const screenR = radius[i] * t.k;
      const always = labelled < ALWAYS_LABELLED && map.nodes[i].reusedBy > 0;
      if (!always && screenR < 5 && i !== focusIndex) continue;
      const [x, y] = t.apply([layout.x[i], layout.y[i]]);
      if (x < -50 || x > width + 50 || y < -20 || y > HEIGHT + 20) continue;
      const text = map.nodes[i].title.length > 48 ? `${map.nodes[i].title.slice(0, 47)}…` : map.nodes[i].title;
      const w = ctx.measureText(text).width;
      const box: [number, number, number, number] = [x + screenR + 3, y - 7, w, 14];
      if (i !== focusIndex && placed.some((p) => box[0] < p[0] + p[2] && box[0] + box[2] > p[0] && box[1] < p[1] + p[3] && box[1] + box[3] > p[1])) continue;
      placed.push(box);
      halo(text, box[0], y + 4);
      labelled += 1;
    }
  }, [width, map, layout, model, filters, visible, selected, hover, radius, maxPages, bySize, drawOrder]);

  const schedule = useCallback(() => {
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(draw);
  }, [draw]);

  // Size to the container; crisp on high-density screens.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(Math.max(320, Math.round(el.getBoundingClientRect().width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = HEIGHT * dpr;
    schedule();
  }, [width, schedule]);

  /** The transform that fits every shown book in view. */
  const fitTransform = useCallback(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    map.nodes.forEach((_, i) => {
      if (!visible[i]) return;
      minX = Math.min(minX, layout.x[i] - radius[i]);
      maxX = Math.max(maxX, layout.x[i] + radius[i]);
      minY = Math.min(minY, layout.y[i] - radius[i]);
      maxY = Math.max(maxY, layout.y[i] + radius[i]);
    });
    if (!Number.isFinite(minX)) return zoomIdentity;
    const pad = 40;
    const k = Math.min((width - pad * 2) / Math.max(1, maxX - minX), (HEIGHT - pad * 2) / Math.max(1, maxY - minY), 4);
    return zoomIdentity
      .translate(width / 2 - (k * (minX + maxX)) / 2, HEIGHT / 2 - (k * (minY + maxY)) / 2)
      .scale(k);
  }, [map, layout, radius, visible, width]);

  // Pan and zoom.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const behavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.05, 24])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        schedule();
      });
    zoomRef.current = behavior;
    const selection = select(canvas).call(behavior);
    return () => {
      selection.on(".zoom", null);
    };
  }, [schedule]);

  // Fit on first draw, on reset and when the filters change what's shown.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && zoomRef.current) select(canvas).call(zoomRef.current.transform, fitTransform());
  }, [resetNonce, fitTransform]);

  // Fly to a book from search or the panel.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !zoomRef.current || !focus) return;
    const k = Math.max(transformRef.current.k, 3);
    const target = zoomIdentity
      .translate(width / 2 - k * layout.x[focus.index], HEIGHT / 2 - k * layout.y[focus.index])
      .scale(k);
    select(canvas).transition().duration(600).call(zoomRef.current.transform, target);
  }, [focus, layout, width]);

  useEffect(() => {
    schedule();
  }, [schedule]);

  const indexAt = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const t = transformRef.current;
    const [x, y] = t.invert([sx, sy]);
    const i = finder.find(x, y, 30 / t.k);
    if (i === undefined) return null;
    const d = Math.hypot(layout.x[i] - x, layout.y[i] - y);
    return d <= radius[i] + 4 / t.k ? { index: i, x: sx, y: sy } : null;
  };

  const hovered = hover ? map.nodes[hover.index] : null;

  return (
    <div ref={wrapRef} className="relative w-full overflow-hidden rounded-lg border border-neutral-200">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={summary}
        style={{ width: "100%", height: HEIGHT, cursor: hover ? "pointer" : "grab", display: "block" }}
        onMouseMove={(e) => setHover(indexAt(e))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const hit = indexAt(e);
          if (hit) onSelect(hit.index);
        }}
      />
      {hovered && hover && (
        <div
          className="pointer-events-none absolute z-10 max-w-xs rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-lg"
          style={{ left: Math.min(hover.x + 14, width - 260), top: Math.max(8, hover.y - 10) }}
        >
          <div className="font-semibold text-neutral-900">{hovered.title}</div>
          <div className="text-neutral-700">
            {libraryLabel(hovered.lib)}
            {hovered.kind === "book" && !hovered.scanned && " · not scanned yet"}
          </div>
          {(hovered.reusedBy > 0 || hovered.reuses > 0) && (
            <div className="text-neutral-700">
              {hovered.reusedBy > 0 && `Reused by others: ${plural(hovered.reusedBy, "page")}`}
              {hovered.reusedBy > 0 && hovered.reuses > 0 && " · "}
              {hovered.reuses > 0 && `Reuses: ${plural(hovered.reuses, "page")}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LibraryMap;
