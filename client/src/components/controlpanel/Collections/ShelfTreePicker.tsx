import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Checkbox,
  IconButton,
  Spinner,
  Text,
} from "@libretexts/davis-react";
import {
  IconChevronDown,
  IconChevronRight,
  IconLibraryPlus,
} from "@tabler/icons-react";
import api from "../../../api";
import useGlobalError from "../../error/ErrorHooks";
import { useNotifications } from "../../../context/NotificationContext";
import {
  CollectionShelf,
  Library,
  LibraryShelfNode,
  MAX_COLLECTION_SYNC_SHELVES,
} from "../../../types";

/** How long a listed level stays fresh. Library structure changes rarely. */
const SHELF_STALE_TIME = 5 * 60 * 1000;

type ShelfTreePickerProps = {
  /** Currently selected shelves. */
  value: CollectionShelf[];
  onChange: (shelves: CollectionShelf[]) => void;
  disabled?: boolean;
};

/** A selection key that is unique across libraries. */
const shelfKey = (shelf: CollectionShelf) => `${shelf.library}::${shelf.path}`;

/**
 * One expandable library or shelf row, with its children loaded on expand.
 *
 * Each node owns its own query, so a level is fetched once — when it is first
 * opened — and not again while the admin works in the dialog. Expanding the whole
 * tree up front would mean hundreds of CXOne requests for a handful of choices.
 */
const ShelfNode: React.FC<{
  library: string;
  /** Library-relative path, or undefined for the library's own root listing. */
  path?: string;
  label: string;
  depth: number;
  selectedKeys: Set<string>;
  onToggle: (shelf: CollectionShelf) => void;
  /** Adds this path in every library that has it. */
  onAddAcrossLibraries: (path: string) => Promise<void>;
  /** Path currently being resolved across libraries, if any. */
  spreading: string | null;
  disabled: boolean;
  /** False for the library row itself, which is a container, not a shelf. */
  selectable: boolean;
}> = ({
  library,
  path,
  label,
  depth,
  selectedKeys,
  onToggle,
  onAddAcrossLibraries,
  spreading,
  disabled,
  selectable,
}) => {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["library-shelves", library, path ?? "__root__"],
    queryFn: async () => {
      const res = await api.getLibraryShelves(library, path);
      return res.shelves;
    },
    enabled: expanded,
    staleTime: SHELF_STALE_TIME,
    refetchOnWindowFocus: false,
  });

  const children = (data ?? []) as LibraryShelfNode[];
  const checked =
    selectable && !!path && selectedKeys.has(shelfKey({ library, path }));
  const indent = (level: number) => ({ paddingLeft: `${level * 1.25}rem` });

  const isSpreading = !!path && spreading === path;

  return (
    <li>
      <div
        className="flex items-center gap-2 py-1"
        style={indent(depth)}
        aria-busy={isSpreading}
      >
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="flex items-center rounded p-1 text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {expanded ? (
            <IconChevronDown size={16} aria-hidden="true" />
          ) : (
            <IconChevronRight size={16} aria-hidden="true" />
          )}
          <span className="sr-only">
            {expanded ? `Collapse ${label}` : `Expand ${label}`}
          </span>
        </button>
        {selectable && path ? (
          <>
            <Checkbox
              name={`shelf-${library}-${path}`}
              label={label}
              checked={checked}
              disabled={disabled}
              onChange={() => onToggle({ library, path })}
            />
            {/* The path goes in the accessible name, not just "add across
                libraries": every row in the tree carries one of these buttons,
                and a list of identical names is useless to navigate by. */}
            <IconButton
              icon={<IconLibraryPlus size={16} />}
              aria-label={`Add ${path} across all libraries`}
              title={`Add ${path} across all libraries`}
              variant="ghost"
              size="sm"
              loading={isSpreading}
              disabled={disabled || !!spreading}
              onClick={() => onAddAcrossLibraries(path)}
            />
          </>
        ) : (
          <Text as="span" weight="semibold" className="mb-0!">
            {label}
          </Text>
        )}
      </div>

      {expanded && (
        <div aria-busy={isLoading}>
          {isLoading && (
            <div className="py-1" style={indent(depth + 1)}>
              <Spinner size="sm" text={`Loading ${label}`} />
            </div>
          )}
          {isError && (
            <div className="py-1" style={indent(depth + 1)}>
              <Text as="span" size="sm" className="text-red-700">
                {error instanceof Error
                  ? error.message
                  : `Could not load ${label}.`}
              </Text>
            </div>
          )}
          {!isLoading && !isError && children.length === 0 && (
            <div className="py-1" style={indent(depth + 1)}>
              <Text as="span" color="muted" size="sm">
                Nothing inside {label}.
              </Text>
            </div>
          )}
          {children.length > 0 && (
            <ul role="group" className="list-none m-0 p-0">
              {children.map((child) => (
                <ShelfNode
                  key={`${library}::${child.path}`}
                  library={library}
                  path={child.path}
                  label={child.title}
                  depth={depth + 1}
                  selectedKeys={selectedKeys}
                  onToggle={onToggle}
                  onAddAcrossLibraries={onAddAcrossLibraries}
                  spreading={spreading}
                  disabled={disabled}
                  selectable
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
};

/**
 * Lets an admin pick the library shelves an auto-managed Collection draws from.
 *
 * Libraries are the roots, so one collection can gather shelves from several of
 * them. Selecting a shelf selects everything beneath it, which is why a parent
 * and one of its children are both offerable: the parent is the broad rule, the
 * child the narrow one.
 *
 * Chosen shelves are also listed as removable chips below the tree. Undoing a
 * choice there takes one Tab stop, where finding the same node again means
 * re-expanding every level above it — and it is how a bulk add is trimmed.
 */
const ShelfTreePicker: React.FC<ShelfTreePickerProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();
  const [spreading, setSpreading] = useState<string | null>(null);

  /* The cross-library lookup takes about a second, and the tree stays usable
     while it runs. Merging its result into the `value` captured when the button
     was pressed would undo anything checked or removed in the meantime, so the
     merge reads the latest selection from here instead. */
  const latestValue = useRef(value);
  useEffect(() => {
    latestValue.current = value;
  }, [value]);
  const { data: libraries, isLoading: librariesLoading } = useQuery({
    queryKey: ["libraries-for-shelf-picker"],
    queryFn: async () => {
      const res = await api.getLibraries();
      /* Sync-supported only. The Commons walk skips the rest, so a shelf chosen
         in one could never match a book — and the cross-library search excludes
         them too, which would make the same shelf selectable one way and not the
         other. */
      return (res.data.libraries ?? []).filter((library) => library.syncSupported);
    },
    staleTime: SHELF_STALE_TIME,
    refetchOnWindowFocus: false,
  });

  const selectedKeys = useMemo(
    () => new Set(value.map((shelf) => shelfKey(shelf))),
    [value]
  );

  const handleToggle = useCallback(
    (shelf: CollectionShelf) => {
      const key = shelfKey(shelf);
      if (selectedKeys.has(key)) {
        onChange(value.filter((existing) => shelfKey(existing) !== key));
        return;
      }
      if (value.length >= MAX_COLLECTION_SYNC_SHELVES) {
        addNotification({
          type: "error",
          message: `A collection can sync from at most ${MAX_COLLECTION_SYNC_SHELVES} shelves. Remove one before adding another.`,
        });
        return;
      }
      onChange([...value, shelf]);
    },
    [addNotification, onChange, selectedKeys, value]
  );

  /**
   * Adds one shelf path in every library that has it.
   *
   * `Courses/Canada_College` lives in roughly sixteen libraries and a campus
   * collection wants all of them, which is sixteen manual tree walks otherwise.
   * Libraries without the path are skipped server-side, so the result is usually
   * a partial set and that is the expected answer, not a failure.
   *
   * The outcome is announced through a notification because the only other
   * feedback is chips appearing further down the dialog — easy to miss, and
   * invisible to a screen reader that stays on the button.
   */
  const handleAddAcrossLibraries = useCallback(
    async (path: string) => {
      setSpreading(path);
      try {
        const res = await api.findShelfAcrossLibraries(path);
        if (res.err) throw new Error(res.errMsg);

        const current = latestValue.current;
        const existing = new Set(current.map((shelf) => shelfKey(shelf)));
        const additions = (res.matches ?? []).filter(
          (shelf) => !existing.has(shelfKey(shelf))
        );

        /* Refused whole rather than added partially. "Added across 7 libraries"
           when 16 matched would leave the admin with a rule that covers some
           campuses and not others, and no indication which. */
        if (current.length + additions.length > MAX_COLLECTION_SYNC_SHELVES) {
          addNotification({
            type: "error",
            message: `${path} exists in ${additions.length} more libraries, but a collection can sync from at most ${MAX_COLLECTION_SYNC_SHELVES} shelves and ${current.length} are already selected. Remove some first.`,
          });
          return;
        }

        if (additions.length > 0) {
          onChange([...current, ...additions]);
          addNotification({
            type: "success",
            message:
              additions.length === 1
                ? `${path} added in 1 library!`
                : `${path} added across ${additions.length} libraries!`,
          });
        } else if ((res.matches ?? []).length > 0) {
          addNotification({
            type: "info",
            message: `${path} was already selected in every library that has it.`,
          });
        } else {
          addNotification({
            type: "info",
            message: `${path} wasn't found in any other library.`,
          });
        }
      } catch (err) {
        handleGlobalError(err);
      } finally {
        setSpreading(null);
      }
    },
    [addNotification, handleGlobalError, onChange]
  );

  return (
    <div>
      <Text as="p" size="sm" color="muted" className="mb-2!">
        Check a shelf to sync it, or use the{" "}
        <IconLibraryPlus size={14} aria-hidden="true" className="inline" /> button
        beside it to add that same path in every library that has it.
      </Text>
      <div className="max-h-96 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-3">
        {librariesLoading ? (
          <Spinner size="sm" text="Loading libraries" />
        ) : (
          <ul className="list-none m-0 p-0">
            {((libraries ?? []) as Library[]).map((library) => (
              <ShelfNode
                key={library.subdomain}
                library={library.subdomain}
                label={library.title || library.subdomain}
                depth={0}
                selectedKeys={selectedKeys}
                onToggle={handleToggle}
                onAddAcrossLibraries={handleAddAcrossLibraries}
                spreading={spreading}
                disabled={disabled}
                selectable={false}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3">
        <Text as="p" weight="semibold" className="mb-1!">
          Selected Shelves{" "}
          <span className="text-gray-500">
            {value.length === 0
              ? "(at least one required)"
              : `(${value.length} of ${MAX_COLLECTION_SYNC_SHELVES})`}
          </span>
        </Text>
        {value.length === 0 ? (
          <Text as="p" color="muted" className="mb-0!">
            No shelves selected yet. Expand a library above and check the shelves
            you want to sync.
          </Text>
        ) : (
          <ul className="flex list-none flex-wrap gap-2 m-0 p-0">
            {value.map((shelf) => (
              <li key={shelfKey(shelf)}>
                <Badge
                  label={`${shelf.library}: ${shelf.path}`}
                  onRemove={disabled ? undefined : () => handleToggle(shelf)}
                  removeLabel={`Remove shelf ${shelf.library} ${shelf.path}`}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ShelfTreePicker;
