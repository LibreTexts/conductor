/** The parts of a pointer, wheel or touch event the filter reads. */
export type ZoomFilterEvent = {
  type: string;
  button?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  touches?: { length: number };
};

/**
 * A d3-zoom filter for a graph that sits in a scrolling page: the page keeps
 * plain scrolling and one-finger swipes, so a graph can never trap them.
 *
 * - Mouse wheel zooms only with Ctrl or ⌘ held (trackpad pinch arrives as a
 *   Ctrl-wheel, so it still zooms).
 * - Touch zooms and pans only with two or more fingers.
 * - A mouse drag with the main button pans, as usual.
 *
 * The graph's zoom buttons cover zooming without any of these.
 */
export const pageFriendlyZoomFilter = (event: ZoomFilterEvent): boolean => {
  if (event.type === "wheel") return Boolean(event.ctrlKey || event.metaKey);
  if (event.type.startsWith("touch")) return (event.touches?.length ?? 0) > 1;
  return !event.button;
};
