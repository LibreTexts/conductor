import { useCallback, useMemo, useRef } from "react";
import { fileSizePresentable } from "../../../utils/assetHelpers";
import { getGroupedExports } from "../../../utils/bookExports";
import type { BookExport, BookExportKey } from "../../../types/Shapeshift";

interface ExportRailProps {
  exports: BookExport[];
  selectedKey: BookExportKey;
  onSelect: (key: BookExportKey) => void;
  /**
   * True while no export can be opened yet (never compiled, or a compile is
   * still running). Rows stay focusable so the list remains discoverable.
   */
  disabled: boolean;
}

/**
 * Hand-rolled rather than built on Davis `Tabs`, which wraps Headless UI's
 * horizontal TabGroup and exposes no vertical orientation. A vertical list whose
 * arrow keys move left and right is worse than one implemented to the APG
 * pattern directly, so this owns its own roving tabindex.
 */
const ExportRail: React.FC<ExportRailProps> = ({
  exports,
  selectedKey,
  onSelect,
  disabled,
}) => {
  const groups = useMemo(() => getGroupedExports(), []);
  const tabRefs = useRef<Map<BookExportKey, HTMLButtonElement>>(new Map());

  // Flat order drives keyboard traversal; the group headings are decoration and
  // must not be landed on.
  const orderedKeys = useMemo(
    () => groups.flatMap((g) => g.items.map((i) => i.key)),
    [groups],
  );

  const focusKey = useCallback((key: BookExportKey) => {
    tabRefs.current.get(key)?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, key: BookExportKey) => {
      const index = orderedKeys.indexOf(key);
      if (index === -1) return;

      let nextIndex: number | null = null;
      switch (event.key) {
        case "ArrowDown":
          nextIndex = (index + 1) % orderedKeys.length;
          break;
        case "ArrowUp":
          nextIndex = (index - 1 + orderedKeys.length) % orderedKeys.length;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = orderedKeys.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      const nextKey = orderedKeys[nextIndex];
      onSelect(nextKey);
      focusKey(nextKey);
    },
    [orderedKeys, onSelect, focusKey],
  );

  const getExport = (key: BookExportKey) => exports.find((e) => e.key === key);

  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label="Book exports"
      className="w-66 shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-50 py-2"
    >
      {groups.map((group) => (
        <div key={group.group} className="mb-2">
          <p
            className="m-0 px-4 py-2 text-xs font-semibold uppercase tracking-wide "
            aria-hidden="true"
          >
            {group.label}
          </p>
          {group.items.map((item) => {
            const entry = getExport(item.key);
            const selected = item.key === selectedKey;
            // `aria-disabled`, never the `disabled` attribute: an unavailable
            // export still needs to be reachable so a screen reader user can
            // learn it is missing.
            const unavailable = !item.enabled || disabled || !entry?.available;
            const Icon = item.icon;

            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                id={`export-tab-${item.key}`}
                aria-controls={`export-panel-${item.key}`}
                aria-selected={selected}
                aria-disabled={unavailable || undefined}
                tabIndex={selected ? 0 : -1}
                ref={(el) => {
                  if (el) tabRefs.current.set(item.key, el);
                  else tabRefs.current.delete(item.key);
                }}
                onClick={() => onSelect(item.key)}
                onKeyDown={(e) => handleKeyDown(e, item.key)}
                className={[
                  "flex w-full min-h-10 items-center gap-3 px-4 py-2 text-left text-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  selected
                    ? "bg-primary-50 ring-1 ring-inset ring-primary-200 text-gray-900"
                    : "text-gray-700 hover:bg-gray-100",
                  unavailable ? "opacity-60" : "",
                ].join(" ")}
              >
                <Icon size={18} className="shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate">{item.label}</span>
                <span className="shrink-0 text-xs text-gray-500">
                  {!item.enabled
                    ? "Coming soon"
                    : entry?.available && entry.sizeBytes
                      ? fileSizePresentable(entry.sizeBytes)
                      : entry?.available
                        ? ""
                        : "Unavailable"}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default ExportRail;
