import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../../api";
import { Button, Card, Link, Spinner, Stack, Text, IconButton, Tooltip } from "@libretexts/davis-react";
import { IconExternalLink, IconInfoCircle } from "@tabler/icons-react";
import {
  DataTable,
  createColumnHelper,
} from "@libretexts/davis-react-table";
import type {
  RestackerEntry,
  RestackerTocEntry,
  RestackerTocLicense,
} from "../../../types";
import {
  isLicenseNonCompliant,
  getLicenseCompliance,
  getProposedLicenseCompliance,
  parseLicenseVersion,
  type LicenseComplianceResult,
} from "./util";
import ComplienceDetails from "./ComplienceDetails";
import LicenseBadge from "./LicenseBadge";
import LicenseEditor from "./LicenseEditor";
import LicenseWarningModal from "./LicenseWarningModal";
import { useNotifications } from "../../../context/NotificationContext";

type FlatRestackerRow = RestackerTocEntry & { depth: number };

const columnHelper = createColumnHelper<FlatRestackerRow>();

function flattenToc(
  nodes: RestackerTocEntry[],
  depth = 0,
): FlatRestackerRow[] {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenToc(node.children ?? [], depth + 1),
  ]);
}


/**
 * Recursively walks the TOC tree and overlays `license` → `pageLicense` and
 * `contentLicense` → `contentLicenses` from the flat restacker result map,
 * matched by page ID.
 */
function mergeLicenseData(
  nodes: RestackerTocEntry[],
  sourceMap: Map<string, RestackerEntry>,
): RestackerTocEntry[] {
  return nodes.map((node) => {
    const match = sourceMap.get(node.id);
    return {
      ...node,
      pageLicense: match?.license ?? node.pageLicense,
      sourceLicense: match?.sourceLicense ?? node.sourceLicense,
      contentLicenses: match?.contentLicense ?? node.contentLicenses,
      quotation: match?.quotation ?? node.quotation,
      children: mergeLicenseData(node.children ?? [], sourceMap),
    };
  });
}

function ComplianceRowCell({
  row,
  bookLicense,
  children,
}: {
  row: FlatRestackerRow;
  bookLicense?: RestackerTocLicense;
  children: React.ReactNode;
}) {
  const nonCompliant = isLicenseNonCompliant(
    bookLicense,
    row.pageLicense,
    row.sourceLicense,
    row.contentLicenses,
  );

  if (!nonCompliant) return <>{children}</>;

  return <div data-non-compliant="true">{children}</div>;
}

type EditingLicenseCell = { rowId: string; field: "book" | "page" } | null;

type PendingLicenseChange = {
  pageID: string;
  license: string;
  version?: string;
  field: "book" | "page";
  rowTitle?: string;
  compliance: LicenseComplianceResult;
};

function createColumns(
  bookLicense?: RestackerTocLicense,
  bookPageId?: string,
  onShowDetails?: (row: FlatRestackerRow) => void,
  onLicenseSubmit?: (
    pageID: string,
    field: "book" | "page",
    row: FlatRestackerRow,
    license: string,
    version?: string,
  ) => void,
  editable?: boolean,
  editingLicense?: EditingLicenseCell,
  onStartLicenseEdit?: (rowId: string, field: "book" | "page") => void,
  onCancelLicenseEdit?: () => void,
  updatingPageId?: string,
) {
  const wrap = (row: FlatRestackerRow, children: React.ReactNode) => (
    <ComplianceRowCell row={row} bookLicense={bookLicense}>
      {children}
    </ComplianceRowCell>
  );

  return [
    columnHelper.accessor("title", {
      header: "Page",
      cell: ({ getValue, row }) =>
        wrap(
          row.original,
          <a
            href={row.original.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              paddingLeft: row.original.depth * 20,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {getValue()}
            <IconExternalLink size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
          </a>,
        ),
    }),
    columnHelper.accessor("bookLicense", {
      header: () => (
        <Tooltip content="The overall license that applies to the whole book" placement="bottom">
          <span>Book License</span>
        </Tooltip>
      ),
      enableSorting: false,
      cell: ({ row }) =>
        wrap(
          row.original,
          <LicenseEditor
            license={bookLicense}
            editable={editable && !!bookPageId}
            isEditing={
              editingLicense?.rowId === row.original.id &&
              editingLicense?.field === "book"
            }
            loading={updatingPageId === bookPageId}
            onStartEdit={() => onStartLicenseEdit?.(row.original.id, "book")}
            onCancel={onCancelLicenseEdit}
            onSubmit={(license, version) =>
              bookPageId &&
              onLicenseSubmit?.(bookPageId, "book", row.original, license, version)
            }
          />,
        ),
    }),
    columnHelper.accessor("pageLicense", {
      header: () => (
        <Tooltip content="The license declared directly on this page" placement="bottom">
          <span>Page License</span>
        </Tooltip>
      ),
      enableSorting: false,
      cell: ({ getValue, row }) =>
        wrap(
          row.original,
          <LicenseEditor
            license={getValue()}
            editable={editable}
            isEditing={
              editingLicense?.rowId === row.original.id &&
              editingLicense?.field === "page"
            }
            loading={updatingPageId === row.original.id}
            onStartEdit={() => onStartLicenseEdit?.(row.original.id, "page")}
            onCancel={onCancelLicenseEdit}
            onSubmit={(license, version) =>
              onLicenseSubmit?.(row.original.id, "page", row.original, license, version)
            }
          />,
        ),
    }),
    columnHelper.accessor("sourceLicense", {
      header: () => (
        <Tooltip content="The license of the original source this page was transcluded from" placement="bottom">
          <span>Source License</span>
        </Tooltip>
      ),
      enableSorting: false,
      cell: ({ getValue, row }) =>
        wrap(row.original, <LicenseBadge license={getValue()} />),
    }),
    columnHelper.accessor("contentLicenses", {
      header: () => (
        <Tooltip content="Licenses found within the embedded content of this page" placement="bottom">
          <span>Content Licenses</span>
        </Tooltip>
      ),
      enableSorting: false,
      cell: ({ getValue, row }) => {
        const licenses = getValue();
        return wrap(
          row.original,
          !licenses?.length ? (
            <span style={{ color: "#9ca3af" }}>—</span>
          ) : (
            <Stack direction="vertical" gap="xs">
              {licenses.map((l, i) => (
                <LicenseBadge key={`${l.label}::${l.version ?? ""}::${i}`} license={l} />
              ))}
            </Stack>
          ),
        );
      },
    }),
    columnHelper.accessor("quotation", {
      header: "Remixing %",
      enableSorting: false,
      cell: ({ getValue, row }) => {
        const quotation = getValue();
        return wrap(
          row.original,
          quotation === undefined || quotation === -1 ? (
            <span style={{ color: "#9ca3af" }}>—</span>
          ) : (
            <span>{(quotation * 100).toFixed(1)}%</span>
          ),
        );
      },
    }),
    columnHelper.display({
      id: "details",
      header: () => <div className="w-full text-right">Details</div>,
      enableSorting: false,
      size: 20,
      cell: ({ row }) =>
        wrap(
          row.original,
          <div className="flex w-full justify-end">
            <IconButton
              aria-label="View compliance details"
              icon={<IconInfoCircle size="xl" />}
              onClick={() => onShowDetails?.(row.original)}
            />
          </div>,
        ),
    }),
  ];
}

const Restacker: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { addNotification } = useNotifications();
  const [detailsRow, setDetailsRow] = useState<RestackerTocEntry | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const savedScrollY = useRef(0);

  const handleShowDetails = (row: FlatRestackerRow) => {
    savedScrollY.current = window.scrollY;
    setDetailsRow(row);
    setDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setDetailsRow(null);
  };

  useLayoutEffect(() => {
    const restoreScroll = () => {
      window.scrollTo({ top: savedScrollY.current, left: 0, behavior: "instant" });
    };

    if (detailsOpen) {
      restoreScroll();
      const frame = requestAnimationFrame(restoreScroll);
      const timeout = window.setTimeout(restoreScroll, 0);
      return () => {
        cancelAnimationFrame(frame);
        window.clearTimeout(timeout);
      };
    }

    restoreScroll();
  }, [detailsOpen]);

  const queryClient = useQueryClient();
  const [editingLicense, setEditingLicense] =
    useState<EditingLicenseCell>(null);
  const [pendingLicenseChange, setPendingLicenseChange] =
    useState<PendingLicenseChange | null>(null);

  const {
    data: tocData,
    isLoading: tocLoading,
    isError: tocError,
  } = useQuery({
    queryKey: ["restacker-toc", id],
    queryFn: () => api.getRestackerToc(id),
    enabled: !!id,
    refetchInterval: (data) =>
      (data as { status?: string } | undefined)?.status === "pending" ? 2000 : false,
  });

  const isCompleted = tocData?.status === "completed";

  const {
    data: restackerData,
    isFetching: restackerFetching,
  } = useQuery({
    queryKey: ["restacker", id],
    queryFn: () => api.getRestacker(id),
    enabled: isCompleted,
  });

  const { mutate: handleReload, isPending: reloadPending } = useMutation({
    mutationFn: () => api.reloadRestacker(id!),
    onSuccess: async () => {
      window.location.reload();
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { errMsg?: string } } })?.response?.data
          ?.errMsg || "Failed to reload restacker.";
      addNotification({ type: "error", message });
    },
  });

  const {
    mutate: handleLicenseChange,
    isPending: licenseUpdatePending,
    variables: licenseUpdateVariables,
  } = useMutation({
    mutationFn: (data: {
      pageID: string;
      license: string;
      version?: string;
      force?: boolean;
    }) => api.updateRestackerLicense(id!, data),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(
        ["restacker", id],
        (current: { restacker?: RestackerEntry[] } | undefined) => {
          if (!current?.restacker) return current;
          return {
            ...current,
            restacker: current.restacker.map((entry) =>
              entry.id === variables.pageID
                ? { ...entry, license: data.license }
                : entry,
            ),
          };
        },
      );
      setEditingLicense(null);
      setPendingLicenseChange(null);
    },
    onError: (error) => {
        addNotification({ type: "error", message: "Error updating license" });
        setEditingLicense(null);
    },
  });

  const bookPageId = tocData?.toc?.id;
  const bookLicense = restackerData?.restacker?.find(
    (r) => r.id === bookPageId,
  )?.license;

  const handleLicenseSubmit = (
    pageID: string,
    field: "book" | "page",
    row: FlatRestackerRow,
    license: string,
    version?: string,
  ) => {
    const compliance = getProposedLicenseCompliance(
      field,
      row,
      bookLicense,
      license,
      version,
    );

    if (compliance.incompatiblePairs.length > 0) {
      setPendingLicenseChange({
        pageID,
        license,
        version,
        field,
        rowTitle: row.title,
        compliance,
      });
      return;
    }

    handleLicenseChange({ pageID, license, version });
  };

  const columns = useMemo(
    () =>
      createColumns(
        bookLicense,
        bookPageId,
        handleShowDetails,
        handleLicenseSubmit,
        isCompleted,
        editingLicense,
        (rowId, field) => setEditingLicense({ rowId, field }),
        () => setEditingLicense(null),
        licenseUpdatePending ? licenseUpdateVariables?.pageID : undefined,
      ),
    [
      bookLicense,
      bookPageId,
      isCompleted,
      editingLicense,
      licenseUpdatePending,
      licenseUpdateVariables?.pageID,
    ],
  );

  const detailsCompliance = detailsRow
    ? getLicenseCompliance(
        bookLicense ?? { label: "", raw: "" },
        detailsRow.pageLicense ?? { label: "", raw: "" },
        detailsRow.sourceLicense ?? { label: "", raw: "" },
        detailsRow.contentLicenses ?? [],
      )
    : null;

  if (tocLoading) return <Spinner />;
  if (tocError) return <div>Error loading table of contents.</div>;

  const tocChildren = tocData?.toc?.children ?? [];

  const rows = flattenToc(
    isCompleted && restackerData?.restacker?.length
      ? mergeLicenseData(
          tocChildren,
          new Map(restackerData.restacker.map((e) => [e.id, e])),
        )
      : tocChildren,
  );

  return (
    <>
      <Stack direction="vertical" gap="sm" className="p-4">
        <h2>License Restacker</h2>
        <Card variant="elevated">
          <Card.Body>
            <Stack
              direction="horizontal"
              gap="sm"
              align="start"
              className="justify-between"
            >
              <Stack direction="vertical" gap="xs">
                <Text size="base" weight="semibold">
                  {tocData?.toc?.title}
                </Text>
                <Text size="sm">
                  <Link
                    href={tocData?.toc?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {tocData?.toc?.url}
                  </Link>
                </Text>
                <Text size="sm">Status: {tocData?.status}</Text>
                {(() => {
                  if (!bookLicense?.label) return null;
                  return (
                    <Text size="sm">
                      Book License: <LicenseBadge license={bookLicense} />
                    </Text>
                  );
                })()}
              </Stack>
              {isCompleted && (
                <Button
                  variant="primary"
                  onClick={() => handleReload()}
                  loading={reloadPending || restackerFetching}
                  disabled={!id}
                >
                  Reload
                </Button>
              )}
              
            </Stack>
          </Card.Body>
        </Card>

        <div className="[&_tbody_tr:has([data-non-compliant=true])]:!bg-[#fee2e2] [&_tbody_tr:has([data-non-compliant=true])_td]:!bg-[#fee2e2] [&_tbody_tr:has([data-non-compliant=true])_td]:!text-[#991b1b]">
          <DataTable<FlatRestackerRow>
            data={rows}
            columns={columns}
            maxHeight="calc(100vh - 280px)"
            stickyHeader
            striped
            bordered
            density="compact"
            classNames={{
              cell: "!py-0 relative",
              headerCell: "!py-0",
            }}
          />
        </div>
      </Stack>

      <LicenseWarningModal
        open={!!pendingLicenseChange}
        field={pendingLicenseChange?.field ?? "page"}
        pageTitle={pendingLicenseChange?.rowTitle}
        proposedLicense={pendingLicenseChange?.license ?? ""}
        proposedVersion={pendingLicenseChange?.version}
        compliance={pendingLicenseChange?.compliance ?? null}
        loading={licenseUpdatePending}
        onCancel={() => setPendingLicenseChange(null)}
        onConfirm={() => {
          if (!pendingLicenseChange) return;
          handleLicenseChange({
            pageID: pendingLicenseChange.pageID,
            license: pendingLicenseChange.license,
            version: pendingLicenseChange.version,
            force: true,
          });
        }}
      />

      <ComplienceDetails
        open={detailsOpen}
        onClose={handleCloseDetails}
        pageTitle={detailsRow?.title}
        compliance={detailsCompliance}
        bookLicense={bookLicense}
        pageLicense={detailsRow?.pageLicense}
        sourceLicense={detailsRow?.sourceLicense}
        contentLicenses={detailsRow?.contentLicenses}
      />
    </>
  );
};

export default Restacker;
