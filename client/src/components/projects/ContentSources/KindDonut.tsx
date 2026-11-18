import { useId, useMemo, useState } from "react";
import { arc, pie, type PieArcDatum } from "d3";
import type { PageNodeKind } from "../../../types/ContentSources";
import { KIND_LABELS } from "./labels";
import { KIND_VIZ, KindPatternDefs, KindSwatch } from "./kindViz";

export type KindSlice = { kind: PageNodeKind; value: number };

const SIZE = 168;
const OUTER = SIZE / 2 - 4; // room for the hovered slice to grow
const INNER = OUTER * 0.6;

/**
 * How a book's content pages are made, as a donut (structural and
 * not-scanned pages are left out). Each slice wears its kind's color *and* texture, the
 * same as its card's swatch, so it reads without color vision. Slices are
 * separated by a 2px white gap. Hovering a slice lifts it and shows a solid
 * tooltip outside the ring. A visual aid only: the summary cards carry the
 * same numbers for assistive technology, so the chart is hidden from it.
 */
const KindDonut: React.FC<{ data: KindSlice[] }> = ({ data }) => {
  const prefix = `donut${useId().replace(/:/g, "")}`;
  const [hovered, setHovered] = useState<PageNodeKind | null>(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  const arcs = useMemo(
    () => pie<KindSlice>().sort(null).value((d) => d.value)(data),
    [data],
  );
  const shape = useMemo(() => arc<PieArcDatum<KindSlice>>().innerRadius(INNER).cornerRadius(2), []);
  const slice = data.find((d) => d.kind === hovered) ?? null;

  return (
    <div aria-hidden="true" className="mt-4 flex justify-center">
      <div className="relative">
        <svg width={SIZE} height={SIZE} viewBox={`${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`} onMouseLeave={() => setHovered(null)}>
          <KindPatternDefs prefix={prefix} />
          {arcs.map((a) => {
            const { color, pattern } = KIND_VIZ[a.data.kind];
            const d = shape.outerRadius(hovered === a.data.kind ? OUTER + 4 : OUTER)(a) ?? "";
            const dim = hovered !== null && hovered !== a.data.kind;
            return (
              <g
                key={a.data.kind}
                onMouseEnter={() => setHovered(a.data.kind)}
                className="cursor-default transition-opacity"
                opacity={dim ? 0.45 : 1}
              >
                <path d={d} fill={color} stroke="#fff" strokeWidth={2} />
                {pattern !== "none" && <path d={d} fill={`url(#${prefix}-${pattern})`} stroke="#fff" strokeWidth={2} />}
              </g>
            );
          })}
          <text textAnchor="middle" y={-2} className="fill-neutral-900 text-lg font-semibold">
            {total.toLocaleString()}
          </text>
          <text textAnchor="middle" y={16} className="fill-neutral-600 text-xs">
            content pages
          </text>
        </svg>
        {/* Only while a slice is hovered, outside the ring: to its right, or below it on phones. */}
        {slice && (
          <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 flex w-max max-w-[16rem] -translate-x-1/2 items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-lg sm:left-full sm:top-1/2 sm:mt-0 sm:ml-3 sm:translate-x-0 sm:-translate-y-1/2">
            <KindSwatch kind={slice.kind} />
            <div>
              <div className="font-semibold text-neutral-900">{KIND_LABELS[slice.kind]}</div>
              <div className="text-neutral-700">
                {slice.value.toLocaleString()} {slice.value === 1 ? "page" : "pages"}
                {total > 0 && ` · ${Math.round((slice.value / total) * 100)}%`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KindDonut;
