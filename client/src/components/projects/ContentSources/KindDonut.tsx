import { useEffect, useId, useMemo, useRef, useState } from "react";
import { arc, pie, type PieArcDatum } from "d3";
import { Tooltip } from "@libretexts/davis-react";
import classNames from "classnames";
import type { PageNodeKind } from "../../../types/ContentSources";
import { KIND_DESCRIPTIONS, KIND_LABELS } from "./labels";
import { KIND_VIZ, KindPatternDefs, KindSwatch } from "./kindViz";

export type KindSlice = { kind: PageNodeKind; value: number };

/** The donut's size when stacked above the legend (phones), or before it's measured. */
const DEFAULT_SIZE = 168;
/** Bounds when it matches the legend's height. */
const MIN_SIZE = 140;
const MAX_SIZE = 360;
/** Tailwind's `sm`: where the donut and legend sit side by side. */
const SIDE_BY_SIDE = "(min-width: 640px)";
/** Room for the hovered slice to grow. */
const HOVER_GROW = 4;

/**
 * The donut's diameter: the legend's height while they sit side by side, so
 * the two line up top and bottom; the default when stacked.
 */
const useDonutSize = (legend: React.RefObject<HTMLElement>): number => {
  const [size, setSize] = useState(DEFAULT_SIZE);
  useEffect(() => {
    const el = legend.current;
    if (!el || typeof ResizeObserver === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(SIDE_BY_SIDE);
    const update = () => {
      const height = Math.round(el.getBoundingClientRect().height);
      setSize(media.matches && height > 0 ? Math.min(MAX_SIZE, Math.max(MIN_SIZE, height)) : DEFAULT_SIZE);
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    media.addEventListener("change", update);
    update();
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, [legend]);
  return size;
};

const share = (value: number, total: number) =>
  total > 0 ? `${Math.round((value / total) * 100)}%` : "0%";

/**
 * How a book's content pages are made: a donut with its legend beside it, so
 * each slice sits next to its name and number. Each kind wears its color *and*
 * texture on both the slice and the legend swatch, so it reads without color
 * vision. Hovering a slice or a legend row highlights both, and a slice shows a
 * solid tooltip outside the ring.
 *
 * Shares are of every page in `data`, and the legend ends with their total, so
 * the slices always add up to the book's page count. Pages reached through a
 * chain are already counted in their kinds, so they're a note under the total,
 * not a row of the sum.
 *
 * For assistive technology the legend is the content: each row is a named
 * group ("Copy-Fork: 3 pages, 7%") with its kind's explanation as its
 * description. The donut repeats it visually and is hidden.
 */
const KindDonut: React.FC<{
  data: KindSlice[];
  totalTip: string;
  chain: { pages: number; tip: string };
}> = ({ data, totalTip, chain }) => {
  const prefix = `donut${useId().replace(/:/g, "")}`;
  const [hovered, setHovered] = useState<PageNodeKind | null>(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const slices = useMemo(() => data.filter((d) => d.value > 0), [data]);

  const legendRef = useRef<HTMLUListElement>(null);
  const size = useDonutSize(legendRef);
  // Drawn at its real size (not a scaled viewBox), so the center text and
  // textures keep their size whatever the diameter.
  const outer = size / 2 - HOVER_GROW;
  const inner = outer * 0.6;

  const arcs = useMemo(() => pie<KindSlice>().sort(null).value((d) => d.value)(slices), [slices]);
  const shape = useMemo(() => arc<PieArcDatum<KindSlice>>().innerRadius(inner).cornerRadius(2), [inner]);
  const hoveredSlice = slices.find((d) => d.kind === hovered) ?? null;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
      {slices.length > 0 && (
        <div aria-hidden="true" className="relative shrink-0">
          <svg
            width={size}
            height={size}
            viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
            className="block"
            onMouseLeave={() => setHovered(null)}
          >
            <KindPatternDefs prefix={prefix} />
            {arcs.map((a) => {
              const { color, pattern } = KIND_VIZ[a.data.kind];
              const d = shape.outerRadius(hovered === a.data.kind ? outer + HOVER_GROW : outer)(a) ?? "";
              return (
                <g
                  key={a.data.kind}
                  onMouseEnter={() => setHovered(a.data.kind)}
                  className="transition-opacity"
                  opacity={hovered !== null && hovered !== a.data.kind ? 0.4 : 1}
                >
                  <path d={d} fill={color} stroke="#fff" strokeWidth={2} />
                  {pattern !== "none" && (
                    <path d={d} fill={`url(#${prefix}-${pattern})`} stroke="#fff" strokeWidth={2} />
                  )}
                </g>
              );
            })}
            <text textAnchor="middle" y={-2} className="fill-neutral-900 text-lg font-semibold">
              {total.toLocaleString()}
            </text>
            <text textAnchor="middle" y={16} className="fill-neutral-600 text-xs">
              {total === 1 ? "page" : "pages"}
            </text>
          </svg>
          {/* Only while a slice is hovered, outside the ring, above it. */}
          {hoveredSlice && (
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 flex w-max -translate-x-1/2 items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-lg">
              <KindSwatch kind={hoveredSlice.kind} />
              <span className="font-semibold text-neutral-900">{KIND_LABELS[hoveredSlice.kind]}</span>
              <span className="text-neutral-700">
                {hoveredSlice.value.toLocaleString()} · {share(hoveredSlice.value, total)}
              </span>
            </div>
          )}
        </div>
      )}

      <ul
        ref={legendRef}
        className="w-full min-w-0 flex-1 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white"
      >
        {data.map((d) => {
          const pages = `${d.value.toLocaleString()} ${d.value === 1 ? "page" : "pages"}`;
          return (
            <li key={d.kind}>
              <Tooltip content={KIND_DESCRIPTIONS[d.kind]} placement="bottom" className="flex w-full">
                <div
                  role="group"
                  aria-label={`${KIND_LABELS[d.kind]}: ${pages}, ${share(d.value, total)}`}
                  tabIndex={0}
                  onMouseEnter={() => setHovered(d.kind)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(d.kind)}
                  onBlur={() => setHovered(null)}
                  className={classNames(
                    "flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600",
                    hovered === d.kind ? "bg-neutral-100" : "bg-transparent",
                    d.value === 0 && "text-neutral-500",
                  )}
                >
                  <KindSwatch kind={d.kind} />
                  <span className="min-w-0 flex-1 truncate font-medium text-neutral-800">{KIND_LABELS[d.kind]}</span>
                  <span className="tabular-nums font-semibold text-neutral-900">{d.value.toLocaleString()}</span>
                  <span className="w-10 text-right tabular-nums text-neutral-600">{share(d.value, total)}</span>
                </div>
              </Tooltip>
            </li>
          );
        })}
        <li>
          <Tooltip content={totalTip} placement="bottom" className="flex w-full">
            <div
              role="group"
              aria-label={`Total: ${total.toLocaleString()} ${total === 1 ? "page" : "pages"}`}
              tabIndex={0}
              className="flex w-full items-center gap-3 bg-neutral-50 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600"
            >
              {/* Keeps the name column aligned with the rows above. */}
              <span className="h-[14px] w-[14px] shrink-0" />
              <span className="min-w-0 flex-1 font-semibold text-neutral-900">Total</span>
              <span className="tabular-nums font-semibold text-neutral-900">{total.toLocaleString()}</span>
              <span className="w-10 text-right tabular-nums text-neutral-600">100%</span>
            </div>
          </Tooltip>
        </li>
        <li>
          {/* A note, not a row of the sum: these pages are already counted above. */}
          <Tooltip content={chain.tip} placement="bottom" className="flex w-full">
            <div
              role="group"
              aria-label={`Through a chain: ${chain.pages.toLocaleString()} ${chain.pages === 1 ? "page" : "pages"}`}
              tabIndex={0}
              className="flex w-full items-center gap-3 rounded-b-lg bg-neutral-50 px-3 py-1.5 text-xs text-neutral-600 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600"
            >
              <span className="h-[14px] w-[14px] shrink-0" />
              <span>
                Of these, {chain.pages.toLocaleString()} {chain.pages === 1 ? "page reuses" : "pages reuse"} content
                through a chain.
              </span>
            </div>
          </Tooltip>
        </li>
      </ul>
    </div>
  );
};

export default KindDonut;
