import { linkHorizontal } from "d3";
import { getLibraryName } from "../../util/LibraryOptions";
import { estimateTextWidth, truncateLabel } from "./svgText";

/**
 * Drawing helpers shared by the Content Sources tidy trees (the Books view in
 * `BookConnections` and the Chapters and pages view in `BookReuseTree`), so
 * both look the same: d3's "Tidy tree" styling, labels on a white halo.
 */

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * `estimateTextWidth` with a safety margin: the estimate runs a little short
 * for mixed-case labels, and a short estimate here clips text at the edges.
 */
export const measure = (text: string, px: number, bold = false) => estimateTextWidth(text, px, bold) * 1.18;

/** Cuts a label only when it is wider than its room even at the maximum width. */
export const fitLabel = (label: string, room: number, px: number, bold = false) => {
  let text = truncateLabel(label);
  while (text.length > 4 && measure(text, px, bold) > room) {
    text = `${text.slice(0, -2)}…`;
  }
  return text;
};

/** A library's display name ("chem" → "Chemistry"), or its code when unknown. */
export const libraryLabel = (lib: string) => {
  const name = getLibraryName(lib);
  return name === "Unknown" ? lib : name;
};

/** d3's horizontal tidy-tree link between two `[x, y]` points. */
export const link = linkHorizontal<{ source: [number, number]; target: [number, number] }, [number, number]>()
  .source((d) => d.source)
  .target((d) => d.target);

/** Readable over the links it crosses: the example's white halo. */
export const HALO = "[paint-order:stroke] [stroke:white] [stroke-width:3px] [stroke-linejoin:round]";
