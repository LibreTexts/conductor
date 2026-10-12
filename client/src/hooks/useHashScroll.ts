import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls to the element named by the URL fragment once the page is ready, and
 * moves focus there.
 *
 * The browser's own fragment handling is useless here: it runs when the
 * document loads, long before the article has been fetched, sanitized and had
 * its oEmbeds resolved, so by the time the heading exists the moment has
 * passed. Hence `ready` — pass `true` only once the content is in the DOM.
 *
 * Focus follows the scroll so a screen reader announces the section and the
 * next Tab continues from there rather than from the top of the page.
 *
 * @param ready Whether the content the fragment might point at has rendered.
 */
export default function useHashScroll(ready: boolean) {
  const { hash } = useLocation();
  // The last fragment acted on. Without it, any re-render while the user is
  // reading would yank them back to the heading they arrived at.
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    if (!hash || hash === "#") {
      handled.current = null;
      return;
    }
    if (handled.current === hash) return;

    let id: string;
    try {
      id = decodeURIComponent(hash.slice(1));
    } catch {
      id = hash.slice(1); // malformed percent-encoding; try it verbatim
    }

    const target = document.getElementById(id);
    if (!target) return; // content may still be filling in; retry on next change

    handled.current = hash;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    target.scrollIntoView({
      block: "start",
      behavior: reduceMotion ? "auto" : "smooth",
    });

    // Headings are not focusable on their own. -1 makes this one programmatically
    // focusable without adding it to the tab order.
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }, [hash, ready]);
}
