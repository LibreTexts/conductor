import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../../api";
import {
  Button,
  Card,
  Checkbox,
  Link,
  Spinner,
  Stack,
  Text,
  IconButton,
  Tooltip,
  Heading,
  Breadcrumb,
} from "@libretexts/davis-react";
import {
  IconAlertTriangle,
  IconArrowDown,
  IconBolt,
  IconExternalLink,
  IconInfoCircle,
  IconLicense,
  IconRefresh,
  IconTools,
} from "@tabler/icons-react";
import { DataTable, createColumnHelper } from "@libretexts/davis-react-table";
import type {
  RestackerEntry,
  RestackerTocEntry,
  RestackerTocLicense,
} from "../../../types";
import {
  areLicensesCompatible,
  isLicenseNonCompliant,
  getLicenseCompliance,
  getProposedLicenseCompliance,
  parseLicenseKey,
  parseLicenseVersion,
  formatVersionDigits,
  PUBLIC_DOMAIN_PAGE_SUFFIXES,
  expandWithDescendants,
  getBulkLicenseSkip,
  type LicenseComplianceResult,
} from "./util";
import BulkLicenseModal from "./BulkLicenseModal";
import SubpageLicenseModal from "./SubpageLicenseModal";
import RefreshModeModal, { type RefreshMode } from "./RefreshModeModal";
import ComplianceDetails from "./ComplianceDetails";
import FixAllPreviewModal, { type FixAllEntry } from "./FixAllPreviewModal";
import LicenseBadge from "./LicenseBadge";
import LicenseEditor from "./LicenseEditor";
import LicenseWarningModal from "./LicenseWarningModal";
import { useNotifications } from "../../../context/NotificationContext";
import useProject from "../../../hooks/useProject";
import {
  capitalizeFirstLetter,
  truncateString,
} from "../../util/HelperFunctions";
import { useModals } from "../../../context/ModalContext";

function getAutoFix(
  row: RestackerTocEntry,
): { license: string; version?: string } | null {
  // Structural pages must be publicdomain; if already correct, skip entirely
  if (PUBLIC_DOMAIN_PAGE_SUFFIXES.some((s) => row.url?.includes(s))) {
    if (parseLicenseKey(row.pageLicense) !== "publicdomain") {
      return { license: "publicdomain", version: undefined };
    }
    return null;
  }
  // Page must match its source exactly
  const sourceKey = parseLicenseKey(row.sourceLicense);
  if (sourceKey) {
    const pageKey = parseLicenseKey(row.pageLicense);
    const sourceVersion = formatVersionDigits(
      parseLicenseVersion(row.sourceLicense?.version) ?? row.sourceLicense?.version,
    );
    const pageVersion = formatVersionDigits(
      parseLicenseVersion(row.pageLicense?.version) ?? row.pageLicense?.version,
    );
    if (pageKey !== sourceKey || (pageVersion ?? "") !== (sourceVersion ?? "")) {
      return { license: sourceKey, version: sourceVersion };
    }
  }
  return null;
}

type FlatRestackerRow = RestackerTocEntry & { depth: number };

const columnHelper = createColumnHelper<FlatRestackerRow>();

function flattenToc(nodes: RestackerTocEntry[], depth = 0): FlatRestackerRow[] {
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

type RowSelectionProps = {
  selectedIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggle: (rowId: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
};

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
  selection?: RowSelectionProps,
) {
  const wrap = (row: FlatRestackerRow, children: React.ReactNode) => (
    <ComplianceRowCell row={row} bookLicense={bookLicense}>
      {children}
    </ComplianceRowCell>
  );

  const selectColumn = selection
    ? [
        columnHelper.display({
          id: "select",
          enableSorting: false,
          size: 40,
          header: () => (
            <div className="flex items-center justify-center">
              <Checkbox
                name="restacker-select-all"
                label="Select all pages"
                labelClassName="sr-only"
                checked={selection.allSelected}
                indeterminate={selection.someSelected}
                onChange={selection.onToggleAll}
              />
            </div>
          ),
          cell: ({ row }) =>
            wrap(
              row.original,
              <div className="flex items-center justify-center">
                <Checkbox
                  name={`restacker-select-${row.original.id}`}
                  label={`Select ${row.original.title}`}
                  labelClassName="sr-only"
                  checked={selection.selectedIds.has(row.original.id)}
                  onChange={(checked) =>
                    selection.onToggle(row.original.id, checked)
                  }
                />
              </div>,
            ),
        }),
      ]
    : [];

  return [
    ...selectColumn,
    columnHelper.accessor("title", {
      header: "Page Title",
      size: 280,
      minSize: 120,
      cell: ({ getValue, row }) =>
        wrap(
          row.original,
          <a
            href={row.original.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block max-w-full min-w-0 break-words [overflow-wrap:anywhere]"
            style={{
              paddingLeft: row.original.depth * 20,
            }}
          >
            {getValue()}
            <IconExternalLink
              size={12}
              className="ml-1 inline align-middle opacity-60"
              style={{ flexShrink: 0 }}
            />
          </a>,
        ),
    }),
    columnHelper.accessor("bookLicense", {
      header: () => (
        <Tooltip
          content="The overall license that applies to the whole book"
          placement="bottom"
        >
          <span>Book License</span>
        </Tooltip>
      ),
      enableSorting: false,
      size: 130,
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
              onLicenseSubmit?.(
                bookPageId,
                "book",
                row.original,
                license,
                version,
              )
            }
          />,
        ),
    }),
    columnHelper.accessor("pageLicense", {
      header: () => (
        <Tooltip
          content="The license declared directly on this page"
          placement="bottom"
        >
          <span>Page License</span>
        </Tooltip>
      ),
      enableSorting: false,
      size: 160,
      cell: ({ getValue, row }) => {
        const isStructural = PUBLIC_DOMAIN_PAGE_SUFFIXES.some((s) =>
          row.original.url?.includes(s),
        );
        const hasSource = !!parseLicenseKey(row.original.sourceLicense);
        const isLocked = isStructural || hasSource;

        const pageLicenseKey = parseLicenseKey(getValue());
        const sourceLicenseKey = parseLicenseKey(row.original.sourceLicense);
        const pageLicenseVersion = parseLicenseVersion(getValue()?.version);
        const sourceLicenseVersion = parseLicenseVersion(row.original.sourceLicense?.version);
        const pageSourceMismatch =
          hasSource &&
          (pageLicenseKey !== sourceLicenseKey ||
            pageLicenseVersion !== sourceLicenseVersion);

        return wrap(
          row.original,
          isLocked ? (
            <div className="flex items-center gap-1">
              <LicenseBadge license={getValue()} />
              {editable && pageSourceMismatch && (
                <Tooltip content="Apply source license to this page" placement="top">
                  <IconButton
                    aria-label="Apply source license to this page"
                    icon={<IconTools size={14} />}
                    loading={updatingPageId === row.original.id}
                    disabled={updatingPageId === row.original.id}
                    onClick={() => {
                      const source = row.original.sourceLicense;
                      const license = parseLicenseKey(source);
                      if (!license) return;
                      const version = formatVersionDigits(
                        parseLicenseVersion(source?.version) ?? source?.version,
                      );
                      onLicenseSubmit?.(
                        row.original.id,
                        "page",
                        row.original,
                        license,
                        version,
                      );
                    }}
                  />
                </Tooltip>
              )}
            </div>
          ) : (
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
                onLicenseSubmit?.(
                  row.original.id,
                  "page",
                  row.original,
                  license,
                  version,
                )
              }
            />
          ),
        );
      },
    }),
    columnHelper.accessor("sourceLicense", {
      header: () => (
        <Tooltip
          content="The license of the original source this page was transcluded from"
          placement="bottom"
        >
          <span>Source License</span>
        </Tooltip>
      ),
      enableSorting: false,
      size: 130,
      cell: ({ getValue, row }) =>
        wrap(row.original, <LicenseBadge license={getValue()} />),
    }),
    columnHelper.accessor("contentLicenses", {
      header: () => (
        <Tooltip
          content="Licenses found within the embedded content of this page"
          placement="bottom"
        >
          <span>Content Licenses</span>
        </Tooltip>
      ),
      enableSorting: false,
      size: 130,
      cell: ({ getValue, row }) => {
        const licenses = getValue();
        return wrap(
          row.original,
          !licenses?.length ? (
            <span style={{ color: "#9ca3af" }}>—</span>
          ) : (
            <Stack direction="vertical" gap="xs">
              {licenses.map((l, i) => (
                <LicenseBadge
                  key={`${l.label}::${l.version ?? ""}::${i}`}
                  license={l}
                />
              ))}
            </Stack>
          ),
        );
      },
    }),
    columnHelper.accessor("quotation", {
      header: "Remixing %",
      enableSorting: false,
      size: 90,
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
      size: 72,
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
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const conflictCursorRef = useRef(-1);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingLicense, setEditingLicense] =
    useState<EditingLicenseCell>(null);
  const [fixAllPreview, setFixAllPreview] = useState<FixAllEntry[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

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
        pageUrl={row?.url}
        compliance={compliance}
        bookLicense={bookLicense}
        pageLicense={row?.pageLicense}
        sourceLicense={row?.sourceLicense}
        contentLicenses={row?.contentLicenses}
      />,
    );
  };

  useLayoutEffect(() => {
    const restoreScroll = () => {
      window.scrollTo({
        top: savedScrollY.current,
        left: 0,
        behavior: "instant",
      });
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
    retry: 1,
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

  const { data: restackerData, isFetching: restackerFetching } = useQuery({
    queryKey: ["restacker", id],
    queryFn: () => api.getRestacker(id),
    enabled: isCompleted,
  });

  const { mutate: handleReload, isPending: reloadPending } = useMutation({
    mutationFn: (mode: RefreshMode) => api.reloadRestacker(id!, mode),
    onSuccess: async () => {
      // The reload endpoint recreates an all-pending doc and starts the job itself, so we just
      // resume polling; status flips to "pending" and the table repopulates when it completes.
      await queryClient.invalidateQueries({
        queryKey: ["restacker-status", id],
      });
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

  const { mutate: fixAll, isPending: fixAllPending } = useMutation({
    mutationFn: async (fixes: { pageID: string; license: string; version?: string }[]) => {
      for (const fix of fixes) {
        await api.updateRestackerLicense(id!, { ...fix, force: true });
      }
      return fixes.length;
    },
    onSuccess: async (count) => {
      await queryClient.invalidateQueries({ queryKey: ["restacker", id] });
      addNotification({ type: "success", message: `Fixed ${count} license issue(s).` });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["restacker", id] });
      addNotification({ type: "error", message: "Failed to fix all license issues." });
    },
  });

  const { mutate: bulkUpdateLicense, isPending: bulkUpdatePending } =
    useMutation({
      mutationFn: (data: { pageIDs: string[]; license: string; version?: string }) =>
        api.bulkUpdateRestackerLicense(id!, data),
      onSuccess: async (data) => {
        await queryClient.invalidateQueries({ queryKey: ["restacker", id] });
        const skipped = data.skipped.length;
        const failed = data.failed.length;
        addNotification({
          type: failed > 0 ? "error" : "success",
          message: `Updated ${data.updated.length} page license(s)${
            skipped > 0 ? `, skipped ${skipped} incompatible or unchanged page(s)` : ""
          }${failed > 0 ? `, ${failed} failed` : ""}.`,
        });
      },
      onError: (err: unknown) => {
        queryClient.invalidateQueries({ queryKey: ["restacker", id] });
        const message =
          (err as { response?: { data?: { errMsg?: string } } })?.response?.data
            ?.errMsg || "Failed to update page licenses.";
        addNotification({ type: "error", message });
      },
    });

  const bookPageId = tocData?.toc?.id;
  const bookLicense = restackerData?.restacker?.find(
    (r) => r.id === bookPageId,
  )?.license;

  const tocChildren = tocData?.toc?.children ?? [];
  const rows = flattenToc(
    isCompleted && restackerData?.restacker?.length
      ? mergeLicenseData(
          tocChildren,
          new Map(restackerData.restacker.map((e) => [e.id, e])),
        )
      : tocChildren,
  );

  /**
   * Applies a license to one page. When an editable page has subpages, first offers
   * to cascade the license down, skipping subpages with Source/Content conflicts.
   */
  const applyLicenseChange = (
    field: "book" | "page",
    row: FlatRestackerRow,
    pageID: string,
    license: string,
    version?: string,
    force?: boolean,
  ) => {
    const applyToPage = () =>
      handleLicenseChange({ pageID, license, version, force });

    const subpageIds =
      field === "page" && license && !parseLicenseKey(row.sourceLicense)
        ? expandWithDescendants(rows, new Set([row.id]))
        : new Set<string>();
    subpageIds.delete(row.id);
    if (subpageIds.size === 0) {
      applyToPage();
      return;
    }

    const plan = rows
      .filter((r) => subpageIds.has(r.id))
      .map((r) => ({ row: r, skip: getBulkLicenseSkip(r, license, version) }));

    openModal(
      <SubpageLicenseModal
        pageTitle={row.title}
        license={license}
        version={version}
        plan={plan}
        onCancel={closeAllModals}
        onThisPageOnly={() => {
          closeAllModals();
          applyToPage();
        }}
        onIncludeSubpages={(subpageIDs) => {
          closeAllModals();
          applyToPage();
          bulkUpdateLicense({ pageIDs: subpageIDs, license, version });
        }}
      />,
    );
  };

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
      field === "book" ? rows : undefined,
    );

    if (compliance.incompatiblePairs.length > 0) {
      const pendingChange: PendingLicenseChange = {
        pageID,
        license,
        version,
        field,
        rowTitle: field === "book" ? undefined : row.title,
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
            closeAllModals();
            applyLicenseChange(field, row, pageID, license, version, true);
          }}
        />,
      );
      return;
    }

    applyLicenseChange(field, row, pageID, license, version);
  };

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

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
        isCompleted
          ? {
              selectedIds,
              allSelected,
              someSelected,
              onToggle: (rowId, checked) =>
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (checked) next.add(rowId);
                  else next.delete(rowId);
                  return next;
                }),
              onToggleAll: (checked) =>
                setSelectedIds(
                  checked ? new Set(rows.map((r) => r.id)) : new Set(),
                ),
            }
          : undefined,
      ),
    [
      selectedIds,
      allSelected,
      someSelected,
      bookLicense,
      bookPageId,
      isCompleted,
      editingLicense,
      licenseUpdatePending,
      licenseUpdateVariables?.pageID,
      rows,
    ],
  );

  const nonCompliantCount = useMemo(
    () =>
      rows.filter((r) =>
        isLicenseNonCompliant(
          bookLicense,
          r.pageLicense,
          r.sourceLicense,
          r.contentLicenses,
        ),
      ).length,
    [rows, bookLicense],
  );

  const fixableRows = useMemo(
    () =>
      rows
        .map((r) => ({ row: r, fix: getAutoFix(r) }))
        .filter((x): x is { row: FlatRestackerRow; fix: NonNullable<ReturnType<typeof getAutoFix>> } =>
          x.fix !== null,
        ),
    [rows],
  );

  const handleNextConflict = useCallback(() => {
    if (!tableContainerRef.current) return;
    const conflictRows = Array.from(
      tableContainerRef.current.querySelectorAll<HTMLTableRowElement>(
        "tr:has([data-non-compliant])",
      ),
    );
    if (!conflictRows.length) return;
    conflictCursorRef.current =
      (conflictCursorRef.current + 1) % conflictRows.length;
    conflictRows[conflictCursorRef.current].scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, []);

  if (tocLoading) return <Spinner />;
  if (tocError) return <div>Error loading table of contents.</div>;

  return (
    <Stack direction="vertical" gap="md" className="py-8 px-16">
      <Stack direction="vertical" gap="xs" className="mb-2">
        <Heading level={2}>License Restacker</Heading>
        {!isLoadingProject && project?.title && (
          <Breadcrumb className="ml-1">
            <Breadcrumb.Item href="/projects">Projects</Breadcrumb.Item>
            <Breadcrumb.Item href={`/projects/${id}`}>
              {project?.title}
            </Breadcrumb.Item>
            <Breadcrumb.Item isCurrent>License Restacker</Breadcrumb.Item>
          </Breadcrumb>
        )}
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
                Status:{" "}
                {capitalizeFirstLetter(progressData?.status ?? tocData?.status)}
              </Text>
              {(() => {
                if (!bookLicense?.label) return null;
                return (
                  <Text size="sm">
                    Book License: <LicenseBadge license={bookLicense} />
                  </Text>
                );
              })()}
              {isProcessing && (
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
              )}
            </Stack>
            <Stack direction="vertical" gap="sm">
            <Button
              variant="primary"
              onClick={() =>
                openModal(
                  <RefreshModeModal
                    onCancel={closeAllModals}
                    onConfirm={(mode) => {
                      closeAllModals();
                      handleReload(mode);
                    }}
                  />,
                )
              }
              loading={reloadPending || isProcessing}
              disabled={!id}
              icon={<IconRefresh size={16} />}
            >
              Refresh License Data
            </Button>
            {nonCompliantCount > 0 && (
              <Button
                variant="secondary"
                onClick={handleNextConflict}
                icon={<IconArrowDown size={16} />}
              >
                <span className="flex items-center gap-1">
                  <IconAlertTriangle size={14} className="text-red-600" />
                  {`Next Conflict (${nonCompliantCount})`}
                </span>
              </Button>
            )}
            {fixableRows.length > 0 && (
              <Button
                variant="secondary"
                loading={fixAllPending}
                disabled={fixAllPending || !isCompleted}
                icon={<IconBolt size={16} />}
                onClick={() => {
                  const entries: FixAllEntry[] = fixableRows.map(({ row, fix }) => {
                    const isStructural = PUBLIC_DOMAIN_PAGE_SUFFIXES.some((s) =>
                      row.url?.includes(s),
                    );
                    return {
                      pageID: row.id,
                      title: row.title,
                      currentLicense: row.pageLicense,
                      license: fix.license,
                      version: fix.version,
                      reason: isStructural
                        ? "Structural page must be Public Domain"
                        : "Page license must match source license",
                    };
                  });
                  setFixAllPreview(entries);
                }}
              >
                {`Fix All (${fixableRows.length})`}
              </Button>
            )}
            {isCompleted && (
              <Button
                variant="secondary"
                disabled={selectedIds.size === 0 || bulkUpdatePending}
                loading={bulkUpdatePending}
                icon={<IconLicense size={16} />}
                onClick={() => setBulkOpen(true)}
              >
                {selectedIds.size > 0
                  ? `Change License (${selectedIds.size} selected)`
                  : "Change License (select pages)"}
              </Button>
            )}
            {selectedIds.size > 0 && (
              <Button variant="outline" onClick={() => setSelectedIds(new Set())}>
                Clear Selection
              </Button>
            )}</Stack>
          </Stack>
        </Card.Body>
      </Card>

      <FixAllPreviewModal
        open={fixAllPreview !== null}
        entries={fixAllPreview ?? []}
        loading={fixAllPending}
        onCancel={() => setFixAllPreview(null)}
        onConfirm={() => {
          if (!fixAllPreview) return;
          fixAll(
            fixAllPreview.map((e) => ({
              pageID: e.pageID,
              license: e.license,
              version: e.version,
            })),
          );
          setFixAllPreview(null);
        }}
      />

      <BulkLicenseModal
        open={bulkOpen}
        rows={rows}
        selectedIds={selectedIds}
        loading={bulkUpdatePending}
        onCancel={() => setBulkOpen(false)}
        onConfirm={(pageIDs, license, version) =>
          bulkUpdateLicense(
            { pageIDs, license, version },
            {
              onSuccess: () => {
                setBulkOpen(false);
                setSelectedIds(new Set());
              },
            },
          )
        }
      />

      <div ref={tableContainerRef} className="[&_tbody_tr:has([data-non-compliant=true])]:!bg-[#fee2e2] [&_tbody_tr:has([data-non-compliant=true])_td]:!bg-[#fee2e2] [&_tbody_tr:has([data-non-compliant=true])_td]:!text-[#991b1b]">
        <DataTable<FlatRestackerRow>
          data={rows}
          columns={columns}
          maxHeight="calc(100vh - 280px)"
          stickyHeader
          striped
          bordered
          density="compact"
          classNames={{
            table: "table-fixed w-full",
            cell: "!py-0 relative !whitespace-normal min-w-0 break-words",
            headerCell: "!py-0",
          }}
        />
      </div>
    </Stack>
  );
};

export default Restacker;
