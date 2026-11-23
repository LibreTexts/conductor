import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Breadcrumb,
  Combobox,
  Heading,
  Progress,
  Select,
  Spinner,
  Stack,
  Switch,
  Text,
} from "@libretexts/davis-react";
import api from "../../../../../api";
import { useTypedSelector } from "../../../../../state/hooks";
import useDocumentTitle from "../../../../../hooks/useDocumentTitle";
import { plural } from "../../../../../components/projects/ContentSources/labels";
import { libraryLabel } from "../../../../../components/projects/ContentSources/treeDraw";
import { detectCommunities } from "./communities";
import { nodeRadius, runLayout, type LayoutOutput } from "./layout";
import { OTHER_COLOR, UNSCANNED_COLOR, buildMapModel } from "./mapModel";
import LibraryMap, { type MapFilters } from "./LibraryMap";
import BookDrawer from "./BookDrawer";
import LibraryMultiSelect from "../LibraryMultiSelect";

const SEARCH_RESULTS = 20;

/**
 * Library map: every LibreTexts book as a dot, placed and coloured by the
 * content it shares, from all the content-reuse data, in the manner of the
 * Wikipedia link map. Dots are sized by how much other books reuse them;
 * neighbourhoods (detected communities) are coloured; books that share
 * nothing sit in their library's island. LibreTexts staff only.
 */
const LibraryMapPage: React.FC = () => {
  useDocumentTitle("LibreTexts Conductor | Library map");
  const user = useTypedSelector((state) => state.user);
  useEffect(() => {
    if (!user?.uuid) return;
    if (!user.isSuperAdmin && !user.isSupport) window.location.href = "/home";
  }, [user]);

  const mapQuery = useQuery({
    queryKey: ["provenanceMap"],
    queryFn: () => api.getProvenanceMap(),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const map = mapQuery.data?.data;

  const community = useMemo(
    () => (map ? detectCommunities(map.nodes.length, map.edges.map(([s, t, pages]) => [s, t, pages])) : null),
    [map],
  );
  const model = useMemo(() => (map && community ? buildMapModel(map, community) : null), [map, community]);

  const [layout, setLayout] = useState<LayoutOutput | null>(null);
  const [layoutError, setLayoutError] = useState(false);
  const [layoutDone, setLayoutDone] = useState(0);
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    setLayout(null);
    setLayoutDone(0);
    runLayout(
      {
        libs: map.nodes.map((n) => n.lib),
        radius: map.nodes.map((n) => nodeRadius(n.reusedBy, n.kind)),
        edges: map.edges.map(([s, t, pages]) => [s, t, pages]),
      },
      // Whole percents only, so a long layout re-renders about 100 times at most.
      (done) => !cancelled && setLayoutDone(Math.floor(done * 100)),
    )
      .then((out) => !cancelled && setLayout(out))
      .catch(() => !cancelled && setLayoutError(true));
    return () => {
      cancelled = true;
    };
  }, [map]);

  /** Libraries whose books are shown; none selected means every library. */
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>([]);
  const libraryChoices = useMemo(
    () =>
      (map?.libraries ?? []).map((l) => ({
        id: l.lib,
        label: `${libraryLabel(l.lib)} (${l.books.toLocaleString()})`,
      })),
    [map],
  );
  const [sharedOnly, setSharedOnly] = useState(false);
  const [links, setLinks] = useState<MapFilters["links"]>("all");
  const filters = useMemo<MapFilters>(
    () => ({ libs: selectedLibraries.length ? new Set(selectedLibraries) : null, sharedOnly, links }),
    [selectedLibraries, sharedOnly, links],
  );

  const [selected, setSelected] = useState<number | null>(null);
  const [focus, setFocus] = useState<{ index: number; nonce: number } | null>(null);
  const pick = (index: number) => {
    setSelected(index);
    setFocus({ index, nonce: Date.now() });
  };

  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    if (!map || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    return map.nodes
      .map((n, i) => ({ n, i }))
      .filter(({ n }) => n.title.toLowerCase().includes(q))
      .sort((a, b) => b.n.reusedBy - a.n.reusedBy || a.n.title.localeCompare(b.n.title))
      .slice(0, SEARCH_RESULTS);
  }, [map, query]);

  const stats = useMemo(() => {
    if (!map || !model) return null;
    let books = 0;
    let scanned = 0;
    let sharing = 0;
    map.nodes.forEach((n, i) => {
      if (n.kind !== "book") return;
      books += 1;
      if (n.scanned) scanned += 1;
      if (model.linked[i] === 1) sharing += 1;
    });
    return { books, scanned, sharing, links: map.edges.length };
  }, [map, model]);

  const summary = stats && model
    ? `Library map: ${plural(stats.books, "book")} in ${plural(map!.libraries.length, "library", "libraries")}, ` +
      `${stats.scanned.toLocaleString()} scanned. ${plural(stats.links, "reuse link")} ${stats.links === 1 ? "joins" : "join"} ` +
      `${plural(stats.sharing, "book")} into ${plural(model.communities.length, "coloured neighbourhood")}. ` +
      "Use the search to open any book's details."
    : "Library map";

  return (
    <Stack direction="vertical" gap="lg" className="px-4 py-8 md:px-16">
      <Stack direction="vertical" gap="xs">
        <Heading level={2}>Library map</Heading>
        <Breadcrumb className="ml-1">
          <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
          <Breadcrumb.Item href="/controlpanel/content-reuse">Content Reuse</Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Library map</Breadcrumb.Item>
        </Breadcrumb>
        <Text className="text-neutral-700">
          Every LibreTexts book as a dot. Books that share content are pulled together and coloured by
          neighbourhood; bigger dots are reused by more pages of other books. Books that share nothing sit
          in their library's island. Built from Conductor's provenance scan; nothing here changes the libraries.
        </Text>
      </Stack>

      {mapQuery.isLoading && <Spinner text="Loading every book and reuse link" />}
      {mapQuery.isError && <Alert variant="error" message="Couldn't load the library map." />}

      {map && model && stats && (
        <>
          {/* One row from md up: search takes the spare width, the rest keep theirs. */}
          <div className="flex flex-wrap items-end gap-3 md:flex-nowrap">
            <div className="w-full md:w-auto md:min-w-0 md:flex-1">
              <Combobox<number | null>
                value={selected}
                onChange={(i) => {
                  if (i !== null) pick(i);
                }}
                nullable
              >
                <Combobox.Label>Find a book</Combobox.Label>
                <Combobox.Input<number | null>
                  placeholder="Type at least 2 letters of a title"
                  displayValue={(i) => (i !== null && i !== undefined ? map.nodes[i].title : "")}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <Combobox.Options>
                  {matches.map(({ n, i }) => (
                    <Combobox.Option<number | null> key={n.id} value={i}>
                      {n.title} <span className="text-neutral-600">· {libraryLabel(n.lib)}</span>
                    </Combobox.Option>
                  ))}
                  <Combobox.Empty>{query.trim().length < 2 ? "Keep typing…" : "No book matches."}</Combobox.Empty>
                </Combobox.Options>
              </Combobox>
            </div>
            <div className="hidden md:contents">
              <LibraryMultiSelect
                libraries={libraryChoices}
                value={selectedLibraries}
                onChange={setSelectedLibraries}
                name="libraryMapLibraries"
                className="w-52 shrink-0"
              />
              <Select
                className="w-52 shrink-0"
                name="libraryMapLinks"
                label="Links"
                placeholder="All reuse"
                options={[
                  { label: "All reuse", value: "all" },
                  { label: "Live reuse (Copy-Transclude, sections)", value: "live" },
                  { label: "Copies (Copy-Fork, Copy-Full, excerpts)", value: "copies" },
                ]}
                value={links}
                onChange={(e) => setLinks(e.target.value as MapFilters["links"])}
              />
              <Switch
                className="shrink-0 whitespace-nowrap pb-2"
                name="libraryMapShared"
                label="Only books that share content"
                checked={sharedOnly}
                onChange={setSharedOnly}
              />
            </div>
          </div>

          <div className="hidden md:block">
            {layoutError && <Alert variant="error" message="Couldn't lay out the map." />}
            {!layout && !layoutError && (
              <div className="max-w-md">
                <Progress
                  value={layoutDone}
                  label={`Laying out ${plural(stats.books, "book")}`}
                  showValue
                />
              </div>
            )}
            {layout && (
              <LibraryMap
                map={map}
                layout={layout}
                model={model}
                filters={filters}
                selected={selected}
                onSelect={pick}
                focus={focus}
                summary={summary}
              />
            )}
          </div>
          <Text className="block text-neutral-700 md:hidden">
            The map needs a wider screen. Search above to open any book's details.
          </Text>

          <section aria-labelledby="lm-legend" className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <Heading level={3} id="lm-legend" className="mb-2 text-base">
                Neighbourhoods
              </Heading>
              {model.communities.length === 0 ? (
                <Text size="sm" className="block text-neutral-700">No books share content yet.</Text>
              ) : (
                <ul className="m-0 list-none space-y-1 p-0">
                  {model.communities.map((c) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} />
                      <span>
                        {c.name} <span className="text-neutral-600">({plural(c.books, "book")})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <Heading level={3} className="mb-2 text-base">
                Reading the map
              </Heading>
              <ul className="m-0 list-none space-y-1 p-0">
                <li className="flex items-center gap-2">
                  <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full" style={{ background: OTHER_COLOR }} />
                  Other neighbourhoods, or scanned books that share nothing
                </li>
                <li className="flex items-center gap-2">
                  <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full" style={{ background: UNSCANNED_COLOR }} />
                  Books not scanned yet
                </li>
                <li className="flex items-center gap-2">
                  <span aria-hidden="true" className="inline-block h-3 w-3 rotate-45" style={{ background: OTHER_COLOR }} />
                  A library's books not scanned yet that other books reuse
                </li>
                <li className="flex items-center gap-2">
                  <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full border-2 border-neutral-900" />
                  Ringed: some pages have a changed or deleted source
                </li>
                <li>Solid lines: live reuse. Dashed lines: copies. Thicker lines share more pages.</li>
                <li>
                  {stats.scanned.toLocaleString()} of {plural(stats.books, "book")} scanned so far; the map fills in
                  as the scan reaches more books.
                </li>
              </ul>
            </div>
          </section>

          <BookDrawer map={map} model={model} index={selected} onClose={() => setSelected(null)} onPick={pick} />
        </>
      )}
    </Stack>
  );
};

export default LibraryMapPage;
