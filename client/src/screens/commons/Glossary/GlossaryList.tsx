import { Badge, IconButton, Stack } from "@libretexts/davis-react";
import LoadingSpinner from "../../../components/LoadingSpinner";
import { GlossaryEntry } from "./model";

import type { ColumnDef, Table } from "@libretexts/davis-react-table";
import { DataTable } from "@libretexts/davis-react-table";
import type { RowSelectionState } from "@tanstack/react-table";

import { IconAlertTriangle, IconPencil, IconTrash } from "@tabler/icons-react";
import { useMemo, useRef, useState } from "react";
import { TableOfContents } from "../../../types";
import { findTocNodeById } from "./services";
import type { Notification } from "../../../context/NotificationContext";
import api from "../../../api";
import GlossaryDefinitionPreview from "./GlossaryDefinitionPreview";

type GlossaryListProps = {
  entries: GlossaryEntry[];
  isLoading: boolean;
  error: string | null;
  toc?: TableOfContents;
  selectedTerms: GlossaryEntry[];
  setSelectedTerms: (terms: GlossaryEntry[]) => void;
  addNotification: (notification: Notification) => void;
  refetchGlossary: () => void;
  setEditingUsageID: (usageID: string) => void;
  bookTOC: TableOfContents;
};

type PageColumnDef = {
  pageID: string;
  addedBy: string;
  usageID: string;
};

const glossaryTableClassNames = {
  wrapper: "glossary-list__table-wrapper min-w-0 w-full max-w-full",
  table: "glossary-list__table w-full max-w-full table-fixed",
  headerCell: "glossary-list__cell",
  cell: "glossary-list__cell",
};

const GlossaryList = ({
  entries,
  isLoading,
  error,
  toc,
  selectedTerms,
  setSelectedTerms,
  addNotification,
  refetchGlossary,
  setEditingUsageID,
}: GlossaryListProps) => {
  const tableRef = useRef<Table<GlossaryEntry> | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  /** Flat set of every page ID present in the book TOC — O(1) membership test. */
  const tocIdSet = useMemo(() => {
    const set = new Set<string>();
    if (!toc) return set;
    const traverse = (node: TableOfContents) => {
      set.add(node.id);
      node.children.forEach(traverse);
    };
    traverse(toc);
    return set;
  }, [toc]);

  const handleRowSelectionChange = (
    updater:
      | RowSelectionState
      | ((prev: RowSelectionState) => RowSelectionState),
  ) => {
    setRowSelection((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setSelectedTerms(entries.filter((e) => next[e.usageID]));
      return next;
    });
  };



  const pageColumns: ColumnDef<PageColumnDef>[] = [
    {
      accessorKey: "pageID",
      size: 580,
      header: () => <span className="block w-full text-sm">Page Title</span>,
      cell: ({ getValue }) => {
        const pageID = getValue() as string;
        const missingFromToc = toc != null && !tocIdSet.has(pageID);
        return (
          <span
            className={`flex items-center gap-1 break-words whitespace-normal text-xs${missingFromToc ? " text-amber-600" : ""}`}
            title={missingFromToc ? "This page is not in the book table of contents" : undefined}
          >
            {missingFromToc?"Removed Page":findTocNodeById(toc!, pageID)?.title}
            {missingFromToc && (
              <IconAlertTriangle size={12} className="shrink-0" />
            )}
          </span>
        );
      },
    },
    // {
    //   accessorKey: "definition",
    //   header: () => <span className="block w-full text-sm">Definition</span>,
    //   size: 280,
    //   cell: ({ getValue }) => (
    //     <span className="block break-words whitespace-normal ">
    //       <GlossaryDefinitionPreview definition={String(getValue() ?? "")} />
    //     </span>
    //   ),
    // },
    // {
    //   accessorKey: "createdAt",
    //   header: () => <span className="block w-full text-sm">Created At</span>,
    //   size: 120,
    //   cell: ({ getValue }) => (
    //     <span className="block break-words whitespace-normal  text-xs">
    //       {format(toZonedTime(getValue() as Date, "UTC"), "MM/dd/yyyy")}
    //     </span>
    //   ),
    // },
    {
      accessorKey: "pageID",
      header: () => (
        <span className="block w-full text-right text-sm">Actions</span>
      ),
      cell: ({ getValue, row }) => (
        <Stack direction="horizontal" gap="xs" className="justify-end">
          
          <IconButton
            name="Delete"
            title="Remove this page from glossary term"
            aria-label="Remove this page from glossary term"
            variant="primary"
            icon={<IconTrash />}
            onClick={async() => {
              const res = await api.removePageFromGlossary({
                pageId: getValue() as string,
                usageId: row.original.usageID,
              }); 
              if (res.err) {
                addNotification({
                  message: res.errMsg ?? "Failed to remove page from glossary term.",
                  type: "error",
                });
                return;
              }
              addNotification({
                message: "Page removed from glossary term successfully",
                type: "success",
              });
              refetchGlossary();
            }}
            size="sm"
          />
          
        </Stack>
      ),
    },
  ];

  const columns: ColumnDef<GlossaryEntry>[] = [
    {
      accessorKey: "term",
      header: "Term",
      // enableSorting: true,
      // enableColumnFilter: true,
      size: 160,
      cell: ({ getValue, row }) => {
        const orphaned = toc
          ? row.original.pages.filter((p) => !tocIdSet.has(p.pageID)).length
          : 0;
        return (
          <span
            className={`flex items-center gap-1 break-words whitespace-normal${orphaned > 0 ? " text-amber-600" : ""}`}
            title={
              orphaned > 0
                ? `${orphaned} page${orphaned > 1 ? "s" : ""} not found in book table of contents`
                : undefined
            }
          >
            {orphaned > 0 && <IconAlertTriangle size={14} className="shrink-0" />}
            <GlossaryDefinitionPreview
              definition={String(getValue() ?? "")}
              className={orphaned > 0 ? "text-amber-600" : undefined}
            />
          </span>
        );
      },
    },
    {
      accessorKey: "definition",
      header: "Definition",
      size: 280,
      cell: ({ getValue }) => (
        <span className="block break-words whitespace-normal">
          <GlossaryDefinitionPreview definition={String(getValue() ?? "")} />
        </span>
      ),
    },
    {
      id: "pages",
      header: "Pages",
      accessorFn: (row) => row.pages.length,
      size: 72,
      cell: ({ getValue, row }) => {
        const count = getValue() as number;
        const orphaned = toc
          ? row.original.pages.filter((p) => !tocIdSet.has(p.pageID)).length
          : 0;
        return (
          <span
            className={`flex items-center gap-1${orphaned > 0 ? " font-medium text-amber-600" : ""}`}
            title={
              orphaned > 0
                ? `${orphaned} page${orphaned > 1 ? "s" : ""} not found in book table of contents`
                : undefined
            }
          >
            {count}
            {orphaned > 0 && <IconAlertTriangle size={14} className="shrink-0" />}
          </span>
        );
      },
    },
    {
      accessorKey: "actions",
      header: () => <span className="block w-full text-right">Actions</span>,
      size: 96,
      cell: ({ row }) => (
        <Stack direction="horizontal" gap="xs" className="justify-end">
          <IconButton
            name="delete"
            title="Delete this glossary term"
            aria-label="Delete this glossary term"
            variant="primary"
            icon={<IconTrash />}
            onClick={async() => {
              const res = await api.removeGlossaryTerm({ usageId: row.original.usageID });
              if (res.err) {
                addNotification({
                  message: res.errMsg ?? "Failed to remove glossary term.",
                  type: "error",
                });
                return;
              }
              addNotification({
                message: "Glossary term removed successfully",
                type: "success",
              });
              refetchGlossary();
            }}
            size="sm"
          />
          <IconButton
            name="edit"
            title="Edit this glossary term"
            aria-label="Edit this glossary term"
            variant="primary"
            icon={<IconPencil />}
            onClick={() => {setEditingUsageID(row.original.usageID);}}
            size="sm"
          />
        </Stack>
      ),
      enableSorting: false,
      enableColumnFilter: false,
    },
  ];

  if (isLoading) {
    return (
      <div className="mt-6 flex justify-center py-4">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <p className="mt-6 text-sm text-red-700" role="alert">
        {error}
      </p>
    );
  }

  return (
    <div className="glossary-list mt-6 min-w-0 w-full max-w-full">
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">
          <em>No glossary entries for this book yet.</em>
        </p>
      ) : (
        <DataTable<GlossaryEntry>
          striped={true}
          stickyHeader={true}
          toolbar={{
            globalSearch: true,
            globalSearchPlaceholder: "Search terms…",
            columnVisibility: false,
            end: (
              <Stack direction="horizontal" gap="xs" align="center">
                {selectedTerms.map((term) => (
                  <Badge
                    key={term.usageID}
                    variant="primary"
                    label={term.term}
                    size="sm"
                    onRemove={() => {
                      setSelectedTerms(
                        selectedTerms.filter((t) => t.usageID !== term.usageID),
                      );
                      setRowSelection((prev) => {
                        const next = { ...prev };
                        delete next[term.usageID];
                        return next;
                      });
                    }}
                  />
                ))}
              </Stack>
            ),
          }}
          data={entries}
          columns={columns}
          className="min-w-0 w-full max-w-full"
          classNames={glossaryTableClassNames}
          enableRowSelection
          enableExpansion
          getRowCanExpand={(row) => row.original.pages.length > 0}
          renderSubRow={(row) => (
            <DataTable<PageColumnDef>
              data={row.original.pages.map((p) => ({ ...p, usageID: row.original.usageID }))}
              columns={pageColumns}
              className="min-w-0 w-full max-w-full"
              classNames={{
                ...glossaryTableClassNames,
                table: `${glossaryTableClassNames.table} glossary-list__pages-table`,
              }}
              density="compact"
              bordered
              caption="Page definitions"
            />
          )}
          pageSize={100}
          enablePagination
          pageSizeOptions={[5, 10, 25, 50, 100]}
          enableSorting
          enableColumnFilters
          onTableReady={(table) => {
            tableRef.current = table;
          }}
          tableOptions={{
            getRowId: (row) => row.usageID,
            state: { rowSelection },
            onRowSelectionChange: handleRowSelectionChange,
          }}
        />
      )}
    </div>
  );
};

export default GlossaryList;
