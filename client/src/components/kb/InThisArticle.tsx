import { useEffect, useState } from "react";
import classNames from "classnames";
import type { ArticleHeading } from "../../utils/kbHeadings";

interface InThisArticleProps {
  headings: ArticleHeading[];
  /**
   * `rail` is the sticky column beside the article, shown from `xl` up.
   * `disclosure` is the collapsed equivalent for narrower screens, which has to
   * sit above the body rather than after it — hence two call sites instead of
   * one self-switching component.
   */
  variant: "rail" | "disclosure";
  /**
   * The scrolling ancestor of the article. Insight pages scroll inside
   * `<main id="kb-main-content">`, not the window, so this is what the
   * position tracker has to observe against.
   */
  scrollRoot?: HTMLElement | null;
  className?: string;
}

const TITLE_ID = "in-this-article-heading";

/** Below this many headings the list is noise rather than navigation. */
const MIN_HEADINGS = 2;

/**
 * Tracks which heading the reader is currently at.
 *
 * The bottom margin shrinks the observed band to the top ~30% of the scroll
 * container, so the active entry is the heading nearest the top of the view
 * rather than whichever one happens to be visible lowest down.
 */
function useActiveHeading(
  headings: ArticleHeading[],
  scrollRoot?: HTMLElement | null
) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;

    const elements = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }

        // Keep document order, so the topmost visible heading wins regardless
        // of the order the callback delivered the entries in.
        const first = headings.find((h) => visible.has(h.id));
        if (first) setActiveId(first.id);
      },
      {
        root: scrollRoot ?? null,
        rootMargin: "0px 0px -70% 0px",
        threshold: 0,
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings, scrollRoot]);

  return activeId;
}

const HeadingList: React.FC<{
  headings: ArticleHeading[];
  activeId: string | null;
}> = ({ headings, activeId }) => (
  <ul className="border-l border-gray-200 max-h-[60vh] overflow-y-auto">
    {headings.map((heading) => {
      const isActive = heading.id === activeId;
      return (
        <li key={heading.id}>
          <a
            href={`#${heading.id}`}
            aria-current={isActive ? "true" : undefined}
            className={classNames(
              "block py-1.5 pr-2 text-sm border-l-2 -ml-px hover:text-primary hover:border-primary",
              heading.level === 3 ? "pl-6" : "pl-3",
              isActive
                ? "border-primary text-primary font-medium"
                : "border-transparent text-gray-700"
            )}
          >
            {heading.text}
          </a>
        </li>
      );
    })}
  </ul>
);

/**
 * "In this article": a link to each section of the article being read.
 */
const InThisArticle: React.FC<InThisArticleProps> = ({
  headings,
  variant,
  scrollRoot,
  className,
}) => {
  // Only the rail highlights position. In a collapsed disclosure there is
  // nothing to highlight, and a second observer over the same headings would
  // just be waste.
  const activeId = useActiveHeading(
    variant === "rail" ? headings : [],
    scrollRoot
  );

  if (headings.length < MIN_HEADINGS) return null;

  if (variant === "disclosure") {
    return (
      <details
        className={classNames(
          "xl:hidden mb-6 border border-gray-200 rounded-md",
          className
        )}
      >
        <summary className="cursor-pointer px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-700">
          In this article
        </summary>
        <nav aria-label="In this article" className="px-4 pb-3">
          <HeadingList headings={headings} activeId={null} />
        </nav>
      </details>
    );
  }

  return (
    <aside
      className={classNames(
        "hidden xl:block w-64 shrink-0 sticky top-0 self-start",
        className
      )}
    >
      <nav aria-labelledby={TITLE_ID}>
        <h2
          id={TITLE_ID}
          className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-3"
        >
          In this article
        </h2>
        <HeadingList headings={headings} activeId={activeId} />
      </nav>
    </aside>
  );
};

export default InThisArticle;
