import { useId } from "react";
import type { PageNodeKind } from "../../../types/ContentSources";

/**
 * How each page kind is drawn: a color and a texture, the same on a pie slice
 * and on its legend swatch, so a kind is never told apart by color alone.
 *
 * The five kinds that carry meaning take the first five slots of the
 * validated categorical palette, in fixed order (adjacent pairs clear the
 * colorblind separation checks); structural and not-scanned pages are neutral
 * grays. Three of the colors are under 3:1 against white, so every slice also
 * has a visible label: its legend row.
 */
export type KindPattern = "none" | "stripes" | "dots" | "back-stripes" | "crosshatch" | "lines";

export const KIND_VIZ: Record<PageNodeKind, { color: string; pattern: KindPattern }> = {
  original: { color: "#2a78d6", pattern: "none" },
  mixed: { color: "#eb6834", pattern: "stripes" },
  transclude: { color: "#1baf7a", pattern: "dots" },
  fork: { color: "#eda100", pattern: "back-stripes" },
  full: { color: "#e87ba4", pattern: "crosshatch" },
  structural: { color: "#9c9b97", pattern: "none" },
  unknown: { color: "#d4d3cf", pattern: "lines" },
};

/** The textures' `<pattern>`s, white strokes over the fill. ids are `${prefix}-${pattern}`. */
export const KindPatternDefs: React.FC<{ prefix: string; scale?: number }> = ({ prefix, scale = 1 }) => {
  const s = 6 * scale;
  const stroke = { stroke: "#fff", strokeOpacity: 0.7, strokeWidth: 1.5 * scale };
  return (
    <defs>
      <pattern id={`${prefix}-stripes`} width={s} height={s} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={s} {...stroke} />
      </pattern>
      <pattern id={`${prefix}-back-stripes`} width={s} height={s} patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
        <line x1={0} y1={0} x2={0} y2={s} {...stroke} />
      </pattern>
      <pattern id={`${prefix}-crosshatch`} width={s} height={s} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={s} {...stroke} />
        <line x1={0} y1={0} x2={s} y2={0} {...stroke} />
      </pattern>
      <pattern id={`${prefix}-dots`} width={s} height={s} patternUnits="userSpaceOnUse">
        <circle cx={s / 2} cy={s / 2} r={1.2 * scale} fill="#fff" fillOpacity={0.8} />
      </pattern>
      <pattern id={`${prefix}-lines`} width={s} height={s} patternUnits="userSpaceOnUse">
        <line x1={0} y1={s / 2} x2={s} y2={s / 2} stroke="#76756f" strokeOpacity={0.6} strokeWidth={1.5 * scale} />
      </pattern>
    </defs>
  );
};

/** A small square in a kind's color and texture: its legend row's link to the pie. */
export const KindSwatch: React.FC<{ kind: PageNodeKind; size?: number }> = ({ kind, size = 14 }) => {
  const { color, pattern } = KIND_VIZ[kind];
  // Unique per swatch: the same kind's swatch appears in the legend and in the pie's tooltip.
  const prefix = `swatch${useId().replace(/:/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
      <KindPatternDefs prefix={prefix} scale={0.6} />
      <rect width={14} height={14} rx={3} fill={color} />
      {pattern !== "none" && <rect width={14} height={14} rx={3} fill={`url(#${prefix}-${pattern})`} />}
    </svg>
  );
};
