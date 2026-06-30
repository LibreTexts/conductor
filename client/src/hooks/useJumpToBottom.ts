import { useCallback, useRef } from "react";

/**
 * Moves keyboard focus (not just the viewport) to a bottom sentinel element.
 *
 * "Jump to bottom" controls that only call window.scrollTo() scroll the page
 * visually but never change document.activeElement, so a keyboard user's tab
 * position stays at the top of the page (fails WCAG SC 2.1.1 / 2.4.3). This
 * hook focuses a sentinel rendered at the end of the content instead, so the
 * next Tab continues from the bottom.
 *
 * Usage: render `<div ref={bottomRef} tabIndex={-1} aria-label="End of results" />`
 * at the very end of the scrollable content region and call `jumpToBottom()`
 * from the control's click handler.
 */
export function useJumpToBottom<T extends HTMLElement = HTMLDivElement>() {
  const bottomRef = useRef<T>(null);

  const jumpToBottom = useCallback(() => {
    const el = bottomRef.current;
    if (!el) {
      // Sentinel not mounted (e.g. empty results) — fall back to a plain scroll.
      window.scrollTo(0, document.body.scrollHeight);
      return;
    }
    el.scrollIntoView({ block: "end" });
    el.focus({ preventScroll: true });
  }, []);

  return { bottomRef, jumpToBottom };
}

export default useJumpToBottom;
