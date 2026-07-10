import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../../api";
import { Button, Card, Link, Spinner, Stack, Text, IconButton, Tooltip, Heading, Breadcrumb } from "@libretexts/davis-react";
import { IconExternalLink, IconInfoCircle, IconRefresh } from "@tabler/icons-react";
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
import ComplianceDetails from "./ComplianceDetails";
import LicenseBadge from "./LicenseBadge";
import LicenseEditor from "./LicenseEditor";
import LicenseWarningModal from "./LicenseWarningModal";
import { useNotifications } from "../../../context/NotificationContext";
import useProject from "../../../hooks/useProject";
import { capitalizeFirstLetter, truncateString } from "../../util/HelperFunctions";
import { useModals } from "../../../context/ModalContext";

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
              icon={<IconInfoCircle size={16} />}
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
  const { openModal, closeAllModals } = useModals();
  const { project, isLoading: isLoadingProject } = useProject(id ?? "");
  const queryClient = useQueryClient();
  const savedScrollY = useRef(0);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingLicense, setEditingLicense] =
    useState<EditingLicenseCell>(null);

  const handleShowDetails = (row: FlatRestackerRow) => {
    savedScrollY.current = window.scrollY;

    const compliance = row
      ? getLicenseCompliance(
        bookLicense ?? { label: "", raw: "" },
        row?.pageLicense ?? { label: "", raw: "" },
        row?.sourceLicense ?? { label: "", raw: "" },
        row?.contentLicenses ?? [],
      )
      : null;

    setDetailsOpen(true);
    openModal(
      <ComplianceDetails
        open={true}
        onClose={() => {
          setDetailsOpen(false);
          closeAllModals();
        }}
        pageTitle={row?.title}
        compliance={compliance}
        bookLicense={bookLicense}
        pageLicense={row?.pageLicense}
        sourceLicense={row?.sourceLicense}
        contentLicenses={row?.contentLicenses}
      />
    );
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

  const {
    data: tocData,
    isLoading: tocLoading,
    isError: tocError,
  } = useQuery({
    queryKey: ["restacker-toc", id],
    queryFn: () => api.getRestackerToc(id),
    enabled: !!id,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
    refetchOnReconnect: false,
    retry: 1
  });

  // Poll the lightweight status endpoint while the server job is running. It reads persisted
  // progress counts only — it never re-triggers the job — so it is safe to poll.
  const { data: progressData } = useQuery({
    queryKey: ["restacker-status", id],
    queryFn: () => api.getRestackerStatus(id),
    enabled: !!id && !!tocData?.toc,
    refetchInterval: (data) => (data?.status === "pending" ? 2000 : false),
    refetchOnWindowFocus: false,
  });

  const isProcessing = (progressData?.status ?? tocData?.status) === "pending";
  const isCompleted = progressData
    ? progressData.status === "completed" || progressData.status === "failed"
    : tocData?.status === "completed";

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
      // The reload endpoint recreates an all-pending doc and starts the job itself, so we just
      // resume polling; status flips to "pending" and the table repopulates when it completes.
      await queryClient.invalidateQueries({ queryKey: ["restacker-status", id] });
      await queryClient.invalidateQueries({ queryKey: ["restacker", id] });
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
      const pendingChange: PendingLicenseChange = {
        pageID,
        license,
        version,
        field,
        rowTitle: row.title,
        compliance,
      };

      openModal(
        <LicenseWarningModal
          open={!!pendingChange}
          field={pendingChange?.field ?? "page"}
          pageTitle={pendingChange?.rowTitle}
          proposedLicense={pendingChange?.license ?? ""}
          proposedVersion={pendingChange?.version}
          compliance={pendingChange?.compliance ?? null}
          loading={licenseUpdatePending}
          onCancel={() => {
            closeAllModals();
          }}
          onConfirm={() => {
            if (!pendingChange) return;
            handleLicenseChange({
              pageID: pendingChange.pageID,
              license: pendingChange.license,
              version: pendingChange.version,
              force: true,
            });
            closeAllModals();
          }}
        />
      );

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
    <Stack direction="vertical" gap="md" className="py-8 px-16">
      <Stack direction="vertical" gap="xs" className="mb-2">
        <Heading level={2}>
          License Restacker
        </Heading>
        {
          !isLoadingProject && project?.title && (
            <Breadcrumb className="ml-1">
              <Breadcrumb.Item href="/projects">Projects</Breadcrumb.Item>
              <Breadcrumb.Item href={`/projects/${id}`}>{project?.title}</Breadcrumb.Item>
              <Breadcrumb.Item isCurrent>License Restacker</Breadcrumb.Item>
            </Breadcrumb>
          )
        }
      </Stack>
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
                URL:{" "}
                <Link
                  href={tocData?.toc?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wrap-anywhere"
                >
                  {truncateString(tocData?.toc?.url, 130)}
                </Link>
              </Text>
              <Text size="sm">
                Status: {capitalizeFirstLetter(progressData?.status ?? tocData?.status)}
              </Text>
              {(() => {
                if (!bookLicense?.label) return null;
                return (
                  <Text size="sm">
                    Book License: <LicenseBadge license={bookLicense} />
                  </Text>
                );
              })()}
              {
                isProcessing && (
                  <Stack
                    direction="horizontal"
                    gap="sm"
                    align="center"
                    role="status"
                    aria-live="polite"
                  >
                    <Spinner size="sm" />
                    <Text size="sm">
                      {progressData && progressData.total > 0
                        ? `Loading license data. This can take a few minutes… processed ${progressData.completed + progressData.failed} of ${progressData.total} pages. This page updates automatically when it's ready.`
                        : "Loading license data… this can take a few minutes. This page updates automatically when it's ready."}
                    </Text>
                  </Stack>
                )
              }
            </Stack>
            <Button
              variant="primary"
              onClick={() => handleReload()}
              loading={reloadPending || isProcessing}
              disabled={!id}
              icon={<IconRefresh size={16} />}
            >
              Refresh License Data
            </Button>
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
    </Stack >
  );
};

export default Restacker;
