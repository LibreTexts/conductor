import { Badge, IconButton, Stack } from "@libretexts/davis-react";
import LoadingSpinner from "../../../components/LoadingSpinner";
import { GlossaryEntry } from "./model";

import type { ColumnDef, Table } from "@libretexts/davis-react-table";
import { DataTable } from "@libretexts/davis-react-table";
import type { RowSelectionState } from "@tanstack/react-table";

import { IconTrash } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { TableOfContents } from "../../../types";
import { findTocNodeById } from "./services";
import type { Notification } from "../../../context/NotificationContext";
import api from "../../../api";

type GlossaryListProps = {
  entries: GlossaryEntry[];
  isLoading: boolean;
  error: string | null;
  toc?: TableOfContents;
  selectedTerms: GlossaryEntry[];
  setSelectedTerms: (terms: GlossaryEntry[]) => void;
  addNotification: (notification: Notification) => void;
  refetchGlossary: () => void;
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
  refetchGlossary
}: GlossaryListProps) => {
  const tableRef = useRef<Table<GlossaryEntry> | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

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

  const getPageTitle = (pageID: string) => {
    if (!toc) {
      return pageID;
    }
    return findTocNodeById(toc, pageID)?.title ?? pageID;
  };

  const pageColumns: ColumnDef<PageColumnDef>[] = [
    {
      accessorKey: "pageID",
      // header: "Page Title",
      size: 580,
      header: () => <span className="block w-full text-sm">Page Title</span>,
      cell: ({ getValue }) => (
        <span className="block break-words whitespace-normal  text-xs">
          {getPageTitle(getValue() as string)}
        </span>
      ),
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
      cell: ({ getValue }) => (
        <span className="block break-words whitespace-normal">
          {String(getValue() ?? "")}
        </span>
      ),
    },
    {
      accessorKey: "definition",
      header: "Definition",
      size: 280,
      cell: ({ getValue }) => (
        <span className="block break-words whitespace-normal">
          {String(getValue() ?? "")}
        </span>
      ),
    },
    {
      id: "pages",
      header: "Pages",
      accessorFn: (row) => row.pages.length,
      size: 72,

      cell: ({ getValue }) => getValue(),
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
          pageSize={5}
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
