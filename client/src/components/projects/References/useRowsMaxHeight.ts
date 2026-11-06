import { useLayoutEffect, useRef, useState } from "react";

/** Space kept between the bottom of the rows and the bottom of the window. */
const BOTTOM_GAP_PX = 24;
/** Smallest rows area, so short windows still show several rows. */
const MIN_ROWS_HEIGHT_PX = 240;

/**
 * Height for a DataTable's rows area so it fills the window below where the
 * rows start (with the page scrolled to the top), instead of a fixed guess
 * that leaves the page scrolling too.
 *
 * Attach the returned ref to an element wrapping the DataTable. The table's
 * toolbar (the first child of its `role="region"` wrapper) is subtracted.
 * Re-measures when the window or anything on the page changes size, such as
 * a card appearing above the table.
 */
export function useRowsMaxHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [maxHeight, setMaxHeight] = useState<number>();

  useLayoutEffect(() => {
    const measure = () => {
      const container = ref.current;
      if (!container) return;
      const top = container.getBoundingClientRect().top + window.scrollY;
      const toolbar = container.querySelector('[role="region"] > :first-child');
      const toolbarHeight = toolbar?.getBoundingClientRect().height ?? 0;
      const next = Math.max(
        MIN_ROWS_HEIGHT_PX,
        Math.floor(window.innerHeight - top - toolbarHeight - BOTTOM_GAP_PX),
      );
      setMaxHeight((current) => (current === next ? current : next));
    };

    measure();
    window.addEventListener("resize", measure);
    // The table mounts after its data loads, and cards above it come and go;
    // the page's size changing covers both.
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(document.body);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, []);

  return { ref, maxHeight };
}
