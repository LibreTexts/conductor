/**
 * Rough rendered width of a line of SVG text, for sizing boxes and drawing
 * areas around labels. SVG can't measure text before it renders, and these
 * figures are laid out once, so an estimate from the app font's average
 * character width (Atkinson Hyperlegible runs wide) is close enough; boxes
 * get a little padding on top.
 */
export const estimateTextWidth = (text: string, fontPx: number, bold = false): number =>
  text.length * fontPx * (bold ? 0.62 : 0.57);

/** Cuts only labels longer than any box should be; the full text is in the tooltip. */
export const truncateLabel = (text: string, max = 60): string =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;
