import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Select, Spinner, Text } from "@libretexts/davis-react";
import api from "../../../api";
import type { PublishDestination } from "../../../types/Publish";

interface MoveDestinationPickerProps {
  projectID: string;
  library: string;
  /** Book title, appended to the chosen container to form the final path. */
  bookTitle: string;
  /** Called whenever the resolved destination changes; `null` when incomplete. */
  onChange: (path: string | null) => void;
  disabled?: boolean;
}

/**
 * A book title reduced to a MindTouch path segment.
 *
 * The result lands in `move?to=` and in the project's rewritten URL, so it is
 * held to the same charset the remixer uses for its own segments
 * (`titleToRemixerPathSegment` in `server/util/remixerutils.ts`): letters,
 * digits, underscore, hyphen, parentheses. A title like
 * `Chemistry 101: What & Why?` becomes `Chemistry_101_What_Why` rather than a
 * path MindTouch mangles or rejects.
 */
const toPathSegment = (title: string) =>
  title
    .trim()
    .replace(/\s+/g, "_")
    // A slash would split the title across two path levels, so it collapses to
    // a hyphen instead of being dropped and running the words together.
    .replace(/\/+/g, "-")
    .replace(/[^A-Za-z0-9_\-()]/g, "")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "");

/**
 * Cascading picker for the book's final location.
 *
 * Levels load lazily: the roots come from the library's configured sync
 * locations, and each subsequent level is fetched only once its parent is
 * chosen. Choosing at any level truncates everything below it, so the selection
 * can never describe a path that no longer exists.
 */
const MoveDestinationPicker: React.FC<MoveDestinationPickerProps> = ({
  projectID,
  library,
  bookTitle,
  onChange,
  disabled = false,
}) => {
  /** One entry per chosen level, outermost first. */
  const [selection, setSelection] = useState<string[]>([]);

  /**
   * The parent path for each level that should be listed: `undefined` for the
   * roots, then each chosen path. One extra level beyond the current selection
   * is requested so the next dropdown is ready to choose from.
   */
  const levelParents = useMemo<(string | undefined)[]>(
    () => [undefined, ...selection],
    [selection]
  );

  const levelQueries = useQueries({
    queries: levelParents.map((parent) => ({
      queryKey: ["publish-destinations", projectID, parent ?? "__root__"],
      queryFn: async () => {
        const res = await api.getPublishDestinations(projectID, parent);
        return res.destinations;
      },
      enabled: !!projectID && !!library,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    })),
  });

  const resolvedPath = useMemo(() => {
    if (selection.length === 0) return null;
    const container = selection[selection.length - 1];
    const segment = toPathSegment(bookTitle);
    if (!segment) return null;
    return `${container}/${segment}`;
  }, [selection, bookTitle]);

  useEffect(() => {
    onChange(resolvedPath);
  }, [resolvedPath, onChange]);

  const handleSelect = useCallback((level: number, path: string) => {
    // Truncate deeper levels: they described children of a container that is no
    // longer selected.
    setSelection((prev) =>
      path ? [...prev.slice(0, level), path] : prev.slice(0, level)
    );
  }, []);

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {levelParents.map((parent, level) => {
          const query = levelQueries[level];
          const options = (query?.data ?? []) as PublishDestination[];

          // The deepest level only earns a dropdown if there is something in it.
          const isTrailing = level === levelParents.length - 1;
          if (isTrailing && !query?.isLoading && options.length === 0) {
            return null;
          }

          return (
            <div key={parent ?? "__root__"} className="min-w-56 flex-1">
              {query?.isLoading ? (
                <div className="flex h-10 items-center">
                  <Spinner size="sm" text="Loading locations" />
                </div>
              ) : (
                <Select
                  name={`destination-level-${level}`}
                  label={level === 0 ? "Location" : "Within"}
                  placeholder="Select…"
                  value={selection[level] ?? ""}
                  onChange={(e) => handleSelect(level, e.target.value)}
                  disabled={disabled}
                  options={options.map((d) => ({
                    value: d.path,
                    label: d.title,
                  }))}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-row items-center gap-2 mt-1">
        <Text size="sm" className="!mb-0 font-semibold">
          Destination:
        </Text>
        <Text size="sm" className="!mb-0 break-all font-mono">
          {resolvedPath
            ? `${library}.libretexts.org/${resolvedPath}`
            : "Choose a location to see the destination path."}
        </Text>
      </div>
    </div>
  );
};

export default MoveDestinationPicker;
