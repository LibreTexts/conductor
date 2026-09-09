/**
 * Categorical palette for color-coding glossary groups in the TOC and group
 * cards. Fixed hue order (blue, orange, aqua, yellow, magenta, green,
 * violet, red) — validated for CVD-safe adjacent contrast; see the dataviz
 * skill's `references/palette.md`. Cycles past 8 groups (PAGE mode can
 * generate far more groups than a chart would ever chart as series; a
 * repeated hue there is an acceptable tradeoff for a UI legend, not a
 * measurement).
 */
const GROUP_COLORS = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
] as const;

export function getGroupColor(index: number): string {
  return GROUP_COLORS[index % GROUP_COLORS.length];
}
