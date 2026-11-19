import { useEffect, useState } from "react";
import classNames from "classnames";
import { Select } from "@libretexts/davis-react";
import { IconAlertCircle } from "@tabler/icons-react";
import { PropertiesSection, PropertiesSectionID } from "./constants";

interface PropertiesSectionNavProps {
  sections: PropertiesSection[];
  invalidSections: Set<PropertiesSectionID>;
}

/** Scrolls to a section and moves focus to it, so keyboard users land there too. */
const goToSection = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  el.focus({ preventScroll: true });
  window.history.replaceState(window.history.state, "", `#${id}`);
};

/**
 * In-page links to each properties section. A sticky list from `lg` up, and a
 * "Jump to section" select below that.
 */
const PropertiesSectionNav = ({ sections, invalidSections }: PropertiesSectionNavProps) => {
  const [current, setCurrent] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    // A section counts as current once its top passes the upper fifth of the viewport.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setCurrent(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  return (
    <>
      <div className="lg:hidden">
        <Select
          name="properties-jump"
          label="Jump to section"
          placeholder="Choose a section…"
          options={sections.map((s) => ({
            value: s.id,
            label: invalidSections.has(s.id) ? `${s.label} (has errors)` : s.label,
          }))}
          value=""
          onChange={(e) => e.target.value && goToSection(e.target.value)}
        />
      </div>
      <nav aria-label="Properties sections" className="max-lg:hidden">
        <ul className="sticky top-6 m-0 flex list-none flex-col gap-0.5 p-0">
          {sections.map((s) => {
            const isCurrent = current === s.id;
            const hasError = invalidSections.has(s.id);
            return (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={isCurrent ? "location" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    goToSection(s.id);
                  }}
                  className={classNames(
                    "flex items-center justify-between gap-2 rounded-md border-l-2 px-3 py-2 text-sm no-underline!",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                    isCurrent
                      ? "border-primary-500 bg-primary-50 font-medium text-primary-700"
                      : "border-transparent text-gray-700 hover:bg-surface-hover hover:text-gray-900"
                  )}
                >
                  <span>{s.label}</span>
                  {hasError && (
                    <>
                      <IconAlertCircle size={16} aria-hidden="true" className="shrink-0 text-danger-600" />
                      <span className="sr-only">(has errors)</span>
                    </>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
};

export default PropertiesSectionNav;
