import { useMemo, useState } from "react";
import { Badge, IconButton, Spinner, Tabs } from "@libretexts/davis-react";
import { CommonsModule } from "../../../types";
import { CatalogContextValue, CatalogEntityData, useCatalog } from "../../../context/CatalogContext";
import { useTypedSelector } from "../../../state/hooks";
import CatalogTab from "./CatalogTab";
import BooksTable from "./BooksTable";
import AssetsTable from "./AssetsTable";
import AuthorsTable from "./AuthorsTable";
import ProjectsTable from "./ProjectsTable";
import VisualMode from "./VisualMode";
import CatalogBookFilters from "./CatalogBookFilters";
import CatalogAssetFilters from "./CatalogAssetFilters";
import CatalogAuthorFilters from "./CatalogAuthorFilters";
import CatalogProjectFilters from "./CatalogProjectFilters";
import CatalogMiniRepoFilters from "./CatalogMiniRepoFilters";
import { IconArrowDown, IconBook, IconFile, IconFolder, IconGrid3x3, IconList, IconTools, IconUser } from "@tabler/icons-react";

// Icons extracted from the former CatalogTabLabel component
const ICONS: Record<CommonsModule, React.ReactNode> = {
  books: (
    <IconBook size={16} />
  ),
  assets: (
    <IconFile size={16} />
  ),
  minirepos: (
    <IconFolder size={16} />
  ),
  projects: (
    <IconTools size={16} />
  ),
  authors: (
    <IconUser size={16} />
  ),
};

type ModuleDef = {
  key: CommonsModule;
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FilterComponent: React.ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TableComponent: React.ComponentType<any>;
  getData: (catalog: CatalogContextValue) => CatalogEntityData<any, any>;
};

// Static config — one entry per module. Add new modules here only.
const MODULE_DEFS: ModuleDef[] = [
  {
    key: "books",
    title: "Books",
    FilterComponent: CatalogBookFilters,
    TableComponent: BooksTable,
    getData: (c) => c.books,
  },
  {
    key: "assets",
    title: "Assets",
    FilterComponent: CatalogAssetFilters,
    TableComponent: AssetsTable,
    getData: (c) => c.assets,
  },
  {
    key: "minirepos",
    title: "Mini-Repos",
    FilterComponent: CatalogMiniRepoFilters,
    TableComponent: ProjectsTable,
    getData: (c) => c.miniRepos,
  },
  {
    key: "projects",
    title: "Projects",
    FilterComponent: CatalogProjectFilters,
    TableComponent: ProjectsTable,
    getData: (c) => c.projects,
  },
  {
    key: "authors",
    title: "Authors",
    FilterComponent: CatalogAuthorFilters,
    TableComponent: AuthorsTable,
    getData: (c) => c.authors,
  },
];

const CatalogTabs: React.FC = () => {
  const catalog = useCatalog();
  const org = useTypedSelector((state) => state.org);
  const [itemizedMode, setItemizedMode] = useState(false);

  const jumpToBottom = () => {
    catalog.triggerStopLoading();
    window.scrollTo(0, document.body.scrollHeight);
  };

  // Derive the ordered, enabled list of modules from org settings
  const visibleModules = useMemo(() => {
    const ms = org.commonsModules;
    if (!ms) return MODULE_DEFS;
    return MODULE_DEFS
      .filter((d) => ms[d.key]?.enabled)
      .sort((a, b) => ms[a.key].order - ms[b.key].order);
  }, [org.commonsModules]);

  // Pre-join module defs with their live catalog data to avoid double calls
  const moduleEntries = useMemo(
    () => visibleModules.map((def) => ({ def, data: def.getData(catalog) })),
    [visibleModules, catalog]
  );

  // Map CommonsModule string ↔ numeric index for Davis Tabs controlled mode.
  // Guard against -1 (e.g. activeTab disabled by org after page load).
  const selectedIndex = Math.max(
    0,
    moduleEntries.findIndex(({ def }) => def.key === catalog.activeTab)
  );

  return (
    <Tabs
      selectedIndex={selectedIndex}
      onChange={(index) => {
        const entry = moduleEntries[index];
        if (entry) catalog.setActiveTab(entry.def.key);
      }}
      variant="line"
      size="sm"
    >
      {/*
        Outer wrapper owns the full-width border-b line and keeps the toolbar
        flush-right. The toolbar lives here (outside Tabs.List) so that:
          1. role="tablist" only contains role="tab" elements (ARIA conformance).
          2. Tabs.List can be flex-1 + overflow-x-auto so tabs scroll on narrow
             viewports while the toolbar stays pinned to the right edge.
      */}
      <div className="flex w-full items-center border-b border-gray-200 pr-1">
        {/* flex-1 + min-w-0 lets the list grow/shrink; overflow-x-auto enables
            horizontal scroll when tabs can't fit; !border-b-0 removes Davis's
            own border since the outer wrapper provides it. */}
        <Tabs.List className="flex-1 min-w-0 overflow-x-auto !border-b-0">
          {moduleEntries.map(({ def, data }) => (
            <Tabs.Tab key={def.key}>
              <span className="flex items-center gap-1.5">
                {ICONS[def.key]}
                {def.title}
                {data.loading ? (
                  <Spinner size="sm" color="secondary" />
                ) : (
                  <Badge label={String(data.total ?? 0)} size="sm" />
                )}
              </span>
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <div className="flex items-center gap-1 pb-1 flex-shrink-0 ml-2">
          <IconButton
            variant="outline"
            size="sm"
            tooltip="Jump to bottom"
            aria-label="Jump to bottom"
            onClick={jumpToBottom}
            icon={<IconArrowDown size={16} />}
          />
          <IconButton
            variant="outline"
            size="sm"
            tooltip={itemizedMode ? "Switch to visual mode" : "Switch to itemized mode"}
            aria-label={itemizedMode ? "Switch to visual mode" : "Switch to itemized mode"}
            onClick={() => setItemizedMode((m) => !m)}
            icon={
              itemizedMode ? (
                <IconGrid3x3 size={16} />
              ) : (
                <IconList size={16} />
              )
            }
          />
        </div>
      </div>

      <Tabs.Panels>
        {moduleEntries.map(({ def, data }) => (
          <Tabs.Panel key={def.key}>
            <def.FilterComponent
              filters={data.filters}
              onFilterChange={(type: string, value: string) => data.setFilter(type, value)}
            />
            <CatalogTab
              itemizedMode={itemizedMode}
              dataLength={data.data.length}
              totalLength={data.total}
              getNextPage={data.loadMore}
              loading={data.loading}
              itemizedRender={<def.TableComponent items={data.data} />}
              visualRender={<VisualMode items={data.data} loading={data.loading} />}
            />
          </Tabs.Panel>
        ))}
      </Tabs.Panels>
    </Tabs>
  );
};

export default CatalogTabs;
