import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  Heading,
  IconButton,
  Link,
  Modal,
  RadioGroup,
  Spinner,
  Stack,
  Text,
  Tooltip,
} from "@libretexts/davis-react";
import { DataTable, createColumnHelper } from "@libretexts/davis-react-table";
import {
  IconAlertTriangle,
  IconArrowDown,
  IconEdit,
  IconExternalLink,
  IconRefresh,
  IconUsers,
} from "@tabler/icons-react";
import api from "../../../api";
import type {
  AuthorSearchResult,
  AuthorshipAuthorRef,
  AuthorshipEntry,
  CreditRole,
} from "../../../types";
import { useNotifications } from "../../../context/NotificationContext";
import useProject from "../../../hooks/useProject";
import { capitalizeFirstLetter, truncateString } from "../../util/HelperFunctions";
import { expandWithDescendants } from "../Restacker/util";
import AuthorPicker from "./AuthorPicker";
import {
  CREDIT_ROLES,
  authorRefLabel,
  creditsFor,
  flattenToc,
  isMissingAuthor,
  isUnchanged,
  roleInfo,
  safeHref,
  type AuthorshipRow,
} from "./util";

const columnHelper = createColumnHelper<AuthorshipRow>();

const errorMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { errMsg?: string } } })?.response?.data?.errMsg || fallback;

const Dash = () => <span className="text-gray-400">—</span>;

/** One credit tag: the resolved author (linked when it has a URL) or the tag text as written. */
const CreditChip = ({ refValue }: { refValue: AuthorshipAuthorRef }) => {
  const author = refValue.author;
  const label = authorRefLabel(refValue);
  const href = safeHref(author?.nameURL);
  const tooltip = author
    ? [author.nameKey, author.campusName].filter(Boolean).join(" · ")
    : `Not linked to an author record (${refValue.tag}${refValue.value})`;
  return (
    <Tooltip content={tooltip} placement="top">
      <span className="inline-flex items-center gap-1">
        {href ? (
          <Link href={href} target="_blank" rel="noopener noreferrer">
            {label}
          </Link>
        ) : (
          <span className={author ? undefined : "italic text-gray-600"}>{label}</span>
        )}
        {author?.isGroup && <Badge label="Group" size="sm" variant="primary" />}
      </span>
    </Tooltip>
  );
};

const CreditList = ({ refs }: { refs?: AuthorshipAuthorRef[] }) =>
  refs?.length ? (
    <Stack direction="vertical" gap="xs">
      {refs.map((r, i) => (
        <CreditChip key={`${r.tag}${r.value}${i}`} refValue={r} />
      ))}
    </Stack>
  ) : (
    <Dash />
  );

type EditTarget = { id: string; title: string; isBook: boolean };

/** A person picked in a dialog but not yet applied; a null author clears the role. */
type PendingChoice = { author: AuthorSearchResult | null };

/** Shows what Apply/OK will do with the picked choice. */
const PendingSummary = ({
  pending,
  roleLabel,
  roleTag,
  pageCount,
}: {
  pending: PendingChoice | null;
  roleLabel: string;
  roleTag: string;
  pageCount?: number;
}) => {
  const where = pageCount !== undefined ? ` on ${pageCount} page(s)` : "";
  if (!pending) {
    return (
      <Text size="sm" color="muted">
        Pick a person or group, or use “Clear author” to remove this role.
      </Text>
    );
  }
  if (!pending.author) {
    return (
      <Alert
        variant="warning"
        title={`The ${roleLabel.toLowerCase()} will be removed${where}`}
        message={`Their ${roleTag} tags are removed. Other tags, including other roles, are not changed.`}
      />
    );
  }
  return (
    <Text size="sm">
      Will set <strong>{pending.author.name}</strong>{" "}
      <span className="font-mono text-xs text-gray-500">({pending.author.nameKey})</span> as{" "}
      {roleLabel.toLowerCase()}
      {where}.
    </Text>
  );
};

/**
 * Attribution Manager: set who is credited on the book and each page, per role (author, editor,
 * remixer, …), as `<role>@<authorKey>` tags on the library pages; and see the credits of the
 * content each page reuses. Modeled on the License Restacker.
 */
const Authorship = () => {
  const { id } = useParams<{ id: string }>();
  const projectID = id ?? "";
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const { project, isLoading: isLoadingProject } = useProject(projectID);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const missingCursorRef = useRef(-1);
  // Where the page and the table were scrolled to, kept up to date while no dialog is open, so the
  // view can be put back after a dialog closes or the data refreshes after an update.
  const scrollPosition = useRef({ window: 0, table: 0 });

  // The role shown is kept in the URL (?role=editor), so it survives reloads and refetches.
  const [roleKey, setRoleKeyState] = useState<CreditRole>(() => {
    const fromURL = new URLSearchParams(window.location.search).get("role");
    return CREDIT_ROLES.some((r) => r.key === fromURL) ? (fromURL as CreditRole) : "author";
  });
  const setRoleKey = (next: CreditRole) => {
    setRoleKeyState(next);
    const url = new URL(window.location.href);
    url.searchParams.set("role", next);
    window.history.replaceState(window.history.state, "", url);
  };
  const role = roleInfo(roleKey);
  // The book or page whose credits are being edited, and the role being set in that dialog. The
  // dialog's role can differ from the table's, so all of a page's credits can be set in one go.
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [dialogRoleKey, setDialogRoleKey] = useState<CreditRole>("author");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  // The role the bulk dialog sets; starts as the table's role and can be switched in the dialog.
  const [bulkRoleKey, setBulkRoleKey] = useState<CreditRole>("author");
  // Clearing removes the credit from every selected page, so it asks first.
  // What is picked in each dialog but not yet applied. A null author means "remove this role".
  // Nothing is written until Apply (keeps the dialog open) or OK (applies and closes).
  const [pendingEdit, setPendingEdit] = useState<PendingChoice | null>(null);
  const [pendingBulk, setPendingBulk] = useState<PendingChoice | null>(null);
  // In the credits dialog of a page with subpages (or the book): also apply to the subpages.
  // Kept while switching roles, so several roles can be cascaded in one sitting.
  const [includeSubpages, setIncludeSubpages] = useState(false);
  const [bulkJobID, setBulkJobID] = useState<string | null>(null);

  const {
    data: tocData,
    isLoading: tocLoading,
    isError: tocError,
  } = useQuery({
    queryKey: ["authorship-toc", projectID],
    queryFn: () => api.getAuthorshipToc(projectID),
    enabled: !!projectID,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Polls the lightweight status endpoint while a scan or bulk job is running.
  const { data: progress } = useQuery({
    queryKey: ["authorship-status", projectID],
    queryFn: () => api.getAuthorshipStatus(projectID),
    enabled: !!projectID && !!tocData?.toc,
    refetchInterval: (data) =>
      data?.status === "pending" ||
      (bulkJobID !== null &&
        (data?.bulkJob?.jobID !== bulkJobID || data.bulkJob.status === "running"))
        ? 2000
        : false,
    refetchOnWindowFocus: false,
  });

  const status = progress?.status ?? tocData?.status;
  const isProcessing = status === "pending";
  const isCompleted = status === "completed" || status === "failed";

  const { data: authorship } = useQuery({
    queryKey: ["authorship", projectID],
    queryFn: () => api.getAuthorship(projectID),
    enabled: !!projectID && isCompleted,
  });

  // Report the outcome of a bulk job once its status poll says it has finished.
  const finishedJob =
    bulkJobID !== null &&
    progress?.bulkJob?.jobID === bulkJobID &&
    progress.bulkJob.status !== "running"
      ? progress.bulkJob
      : null;
  useEffect(() => {
    if (!finishedJob) return;
    setBulkJobID(null);
    queryClient.invalidateQueries({ queryKey: ["authorship", projectID] });
    if (finishedJob.status === "failed") {
      addNotification({
        type: "error",
        message: `Credit update stopped after ${finishedJob.processed} of ${finishedJob.total} page(s). Refresh to see which pages changed.`,
      });
      return;
    }
    addNotification({
      type: finishedJob.failed > 0 ? "error" : "success",
      message: `Updated ${finishedJob.updated} page(s)${
        finishedJob.skipped > 0 ? `, skipped ${finishedJob.skipped} unchanged page(s)` : ""
      }${finishedJob.failed > 0 ? `, ${finishedJob.failed} failed` : ""}.`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishedJob?.jobID]);

  const entries = useMemo(
    () => new Map((authorship?.pages ?? []).map((p) => [p.id, p])),
    [authorship],
  );
  const bookPageID = tocData?.toc?.id;
  const bookEntry: AuthorshipEntry | undefined = bookPageID ? entries.get(bookPageID) : undefined;
  const rows = useMemo(
    () => flattenToc(tocData?.toc?.children ?? [], entries),
    [tocData, entries],
  );

  /** The table's own scroll container (the DataTable scrolls inside a fixed-height box). */
  const getTableScroller = useCallback((): HTMLElement | null => {
    const root = tableContainerRef.current;
    if (!root) return null;
    return (
      Array.from(root.querySelectorAll<HTMLElement>("div")).find((el) =>
        /(auto|scroll)/.test(getComputedStyle(el).overflowY),
      ) ?? null
    );
  }, []);

  // Dialogs lock the page scroll while open (the page reads as scrolled to the top then), so
  // positions are only recorded when nothing is locking it.
  useEffect(() => {
    const scroller = getTableScroller();
    const isLocked = () =>
      document.documentElement.style.overflow === "hidden" ||
      document.body.style.overflow === "hidden";
    const onWindowScroll = () => {
      if (!isLocked()) scrollPosition.current.window = window.scrollY;
    };
    const onTableScroll = () => {
      if (scroller && !isLocked()) scrollPosition.current.table = scroller.scrollTop;
    };
    window.addEventListener("scroll", onWindowScroll, { passive: true });
    scroller?.addEventListener("scroll", onTableScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onWindowScroll);
      scroller?.removeEventListener("scroll", onTableScroll);
    };
  }, [getTableScroller, rows.length]);

  // Puts the page and the table back where they were after a dialog closes or the data changes
  // (an update, a finished bulk job). Repeated on the next frames because dialogs restore focus,
  // and with it scroll, a moment after they close.
  useLayoutEffect(() => {
    if (editTarget || bulkOpen) return;
    const restore = () => {
      window.scrollTo({ top: scrollPosition.current.window, left: 0, behavior: "instant" });
      const scroller = getTableScroller();
      if (scroller) scroller.scrollTop = scrollPosition.current.table;
    };
    restore();
    const frame = requestAnimationFrame(restore);
    const timeout = window.setTimeout(restore, 50);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [authorship, editTarget, bulkOpen, getTableScroller]);

  /** Pages (and the book) crediting each role, for the role switch. */
  const counts = useMemo(
    () =>
      Object.fromEntries(
        CREDIT_ROLES.map((r) => [
          r.key,
          [bookEntry, ...rows.map((row) => row.entry)].filter(
            (e) => creditsFor(e?.pageCredits, r.key).length > 0,
          ).length,
        ]),
      ) as Record<CreditRole, number>,
    [rows, bookEntry],
  );

  /** Scanned pages with no author of their own; highlighted like non-compliant licenses. */
  const missingAuthorIDs = useMemo(
    () => new Set(rows.filter((r) => isMissingAuthor(r.entry)).map((r) => r.id)),
    [rows],
  );

  const { mutate: reload, isPending: reloadPending } = useMutation({
    mutationFn: () => api.reloadAuthorship(projectID),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["authorship-status", projectID] });
      await queryClient.invalidateQueries({ queryKey: ["authorship", projectID] });
    },
    onError: (err) =>
      addNotification({ type: "error", message: errorMessage(err, "Failed to refresh.") }),
  });

  const {
    mutate: updateOne,
    isPending: updatePending,
    variables: updateVariables,
  } = useMutation({
    mutationFn: (data: { pageID: string; role: CreditRole; author: AuthorSearchResult | null }) =>
      api.updateAuthorshipAuthor(projectID, {
        pageID: data.pageID,
        role: data.role,
        authorKey: data.author?.nameKey ?? null,
      }),
    onSuccess: (_res, { pageID, role: changedRole, author }) => {
      // Reflect the change straight away, as the server stores it: the role's `<role>@` tags are
      // replaced and everything else is kept. A page's author list only falls back to an older
      // `authorname:` tag when it has no `author@` tag.
      const tag = roleInfo(changedRole).tag;
      queryClient.setQueryData(
        ["authorship", projectID],
        (current: { pages?: AuthorshipEntry[] } | undefined) =>
          current?.pages
            ? {
                ...current,
                pages: current.pages.map((p) => {
                  if (p.id !== pageID) return p;
                  const others = p.pageCredits.filter((r) => r.role !== changedRole);
                  const fallback = p.pageCredits.filter(
                    (r) => r.role === changedRole && r.tag !== tag,
                  );
                  return {
                    ...p,
                    pageCredits: author
                      ? [...others, { role: changedRole, tag, value: author.nameKey, author }]
                      : [...others, ...fallback],
                  };
                }),
              }
            : current,
      );
    },
    onError: (err) =>
      addNotification({ type: "error", message: errorMessage(err, "Error updating credit.") }),
  });

  const { mutate: updateBulk, isPending: bulkPending } = useMutation({
    mutationFn: (data: { pageIDs: string[]; role: CreditRole; authorKey: string | null }) =>
      api.bulkUpdateAuthorshipAuthor(projectID, data),
    onSuccess: async (data) => {
      if (data.jobID) {
        setBulkJobID(data.jobID);
        await queryClient.invalidateQueries({ queryKey: ["authorship-status", projectID] });
        return;
      }
      addNotification({
        type: "success",
        message: `No pages changed; ${data.skipped.length} already had this credit.`,
      });
    },
    onError: (err) =>
      addNotification({ type: "error", message: errorMessage(err, "Failed to update credits.") }),
  });

  const bulkRunning = bulkPending || bulkJobID !== null;

  const subpagesOf = (target: EditTarget) => {
    const ids = target.isBook
      ? new Set(rows.map((r) => r.id))
      : expandWithDescendants(rows, new Set([target.id]));
    ids.delete(target.id);
    return ids;
  };

  const editSubpageCount = editTarget ? subpagesOf(editTarget).size : 0;
  // How many subpages applying the picked choice would actually change.
  const editSubpageChanges =
    editTarget && pendingEdit
      ? rows.filter(
          (r) =>
            subpagesOf(editTarget).has(r.id) &&
            !isUnchanged(r.entry, dialogRoleKey, pendingEdit.author?.nameKey ?? null),
        ).length
      : 0;

  /**
   * Sets one role on the book or a page, and optionally on its subpages (skipping those that
   * already have exactly this credit). The subpage choice is made inside the dialog, so applying
   * never closes it: the same page and subpages can be given the next role straight away.
   */
  const applyCredit = (
    target: EditTarget,
    forRole: CreditRole,
    author: AuthorSearchResult | null,
    withSubpages: boolean,
  ) => {
    updateOne({ pageID: target.id, role: forRole, author });
    if (!withSubpages) return;
    const authorKey = author?.nameKey ?? null;
    const subpageIDs = subpagesOf(target);
    const toUpdate = rows
      .filter((r) => subpageIDs.has(r.id) && !isUnchanged(r.entry, forRole, authorKey))
      .map((r) => r.id);
    if (toUpdate.length > 0) updateBulk({ pageIDs: toUpdate, role: forRole, authorKey });
  };

  const openEditor = (target: EditTarget) => {
    setDialogRoleKey(roleKey);
    setPendingEdit(null);
    setIncludeSubpages(false);
    setEditTarget(target);
  };

  // Apply keeps the dialog open for the next role; OK closes it.
  const submitEdit = (keepOpen: boolean) => {
    if (!editTarget || !pendingEdit) return;
    applyCredit(
      editTarget,
      dialogRoleKey,
      pendingEdit.author,
      includeSubpages && editSubpageCount > 0,
    );
    setPendingEdit(null);
    if (!keepOpen) setEditTarget(null);
  };

  /** Scrolls to the next page with no author, wrapping around (as Restacker's "Next Conflict"). */
  const handleNextMissing = useCallback(() => {
    const missingRows = Array.from(
      tableContainerRef.current?.querySelectorAll<HTMLTableRowElement>(
        "tr:has([data-missing=true])",
      ) ?? [],
    );
    if (!missingRows.length) return;
    missingCursorRef.current = (missingCursorRef.current + 1) % missingRows.length;
    missingRows[missingCursorRef.current].scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const closeBulk = () => {
    setBulkOpen(false);
    setPendingBulk(null);
  };

  const openBulk = () => {
    setBulkRoleKey(roleKey);
    setPendingBulk(null);
    setBulkOpen(true);
  };

  // Apply keeps the dialog open for the next role; OK closes it. The selection is kept either
  // way. Bulk updates run one at a time, so the next one waits until this one finishes.
  const submitBulk = (keepOpen: boolean) => {
    if (!pendingBulk) return;
    const authorKey = pendingBulk.author?.nameKey ?? null;
    setPendingBulk(null);
    updateBulk(
      { pageIDs: [...selectedIds], role: bulkRoleKey, authorKey },
      { onSuccess: () => !keepOpen && closeBulk() },
    );
  };

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const bookRoleCredits = useMemo(
    () => creditsFor(bookEntry?.pageCredits, roleKey),
    [bookEntry, roleKey],
  );

  // The Page column never changes; only the role columns after it follow the selected role, so
  // switching roles keeps the table (and its scroll position) exactly where it is.
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        size: 44,
        header: () =>
          isCompleted ? (
            <Checkbox
              name="authorship-select-all"
              aria-label="Select all pages"
              checked={allSelected}
              onChange={(checked) =>
                setSelectedIds(checked ? new Set(rows.map((r) => r.id)) : new Set())
              }
            />
          ) : null,
        cell: ({ row }) =>
          isCompleted ? (
            <Checkbox
              name={`authorship-select-${row.original.id}`}
              aria-label={`Select ${row.original.title}`}
              checked={selectedIds.has(row.original.id)}
              onChange={(checked) =>
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (checked) next.add(row.original.id);
                  else next.delete(row.original.id);
                  return next;
                })
              }
            />
          ) : null,
      }),
      columnHelper.accessor("title", {
        header: "Page Title",
        enableSorting: false,
        cell: ({ row }) => {
          const missing = missingAuthorIDs.has(row.original.id);
          return (
            // Marks the row for the red highlight and "Next Missing Author" (see the wrapper).
            <div
              data-missing={missing}
              className="flex items-center gap-1"
              style={{ paddingLeft: `${row.original.depth * 16}px` }}
            >
              {missing && (
                <Tooltip content="No author on this page" placement="top">
                  <IconAlertTriangle size={14} aria-label="No author on this page" />
                </Tooltip>
              )}
              <Link href={row.original.url} target="_blank" rel="noopener noreferrer">
                {row.original.title}
                <IconExternalLink size={12} className="ml-1 inline" aria-hidden="true" />
              </Link>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "page",
        header: `Page ${role.label}`,
        cell: ({ row }) => {
          const own = creditsFor(row.original.entry?.pageCredits, roleKey);
          return (
            <div className="flex items-start justify-between gap-2">
              {own.length ? (
                <CreditList refs={own} />
              ) : bookRoleCredits.length ? (
                <span className="text-sm italic">
                  No page {role.label.toLowerCase()} (book:{" "}
                  {bookRoleCredits.map(authorRefLabel).join(", ")})
                </span>
              ) : (
                <Dash />
              )}
              {isCompleted && row.original.entry && (
                <IconButton
                  icon={<IconEdit size={14} />}
                  aria-label={`Edit credits of ${row.original.title}`}
                  tooltip="Edit credits"
                  variant="ghost"
                  size="sm"
                  loading={updatePending && updateVariables?.pageID === row.original.id}
                  disabled={bulkRunning}
                  onClick={() =>
                    openEditor({ id: row.original.id, title: row.original.title, isBook: false })
                  }
                />
              )}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "source",
        header: () => (
          <Tooltip
            content={`The ${role.label.toLowerCase()} of the page this page is transcluded from`}
            placement="bottom"
          >
            <span>Source {role.label}</span>
          </Tooltip>
        ),
        cell: ({ row }) => (
          <CreditList refs={creditsFor(row.original.entry?.sourceCredits, roleKey)} />
        ),
      }),
      columnHelper.display({
        id: "content",
        header: () => (
          <Tooltip content={`${role.label}s of content reused within this page`} placement="bottom">
            <span>Content {role.label}s</span>
          </Tooltip>
        ),
        cell: ({ row }) => (
          <CreditList refs={creditsFor(row.original.entry?.contentCredits, roleKey)} />
        ),
      }),
      columnHelper.display({
        id: "status",
        header: "Status",
        size: 100,
        cell: ({ row }) =>
          row.original.entry ? capitalizeFirstLetter(row.original.entry.status) : <Dash />,
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, roleKey, selectedIds, allSelected, isCompleted, updatePending, updateVariables, bulkRunning, bookRoleCredits, missingAuthorIDs],
  );

  if (tocLoading) return <Spinner />;
  if (tocError) return <div>Error loading table of contents.</div>;

  const dialogRole = roleInfo(dialogRoleKey);
  const bulkRole = roleInfo(bulkRoleKey);
  const dialogEntry = editTarget
    ? editTarget.isBook
      ? bookEntry
      : entries.get(editTarget.id)
    : undefined;

  return (
    <Stack direction="vertical" gap="md" className="py-8 px-16">
      <Stack direction="vertical" gap="xs" className="mb-2">
        <Heading level={2}>Attribution Manager</Heading>
        {!isLoadingProject && project?.title && (
          <Breadcrumb className="ml-1">
            <Breadcrumb.Item href="/projects">Projects</Breadcrumb.Item>
            <Breadcrumb.Item href={`/projects/${projectID}`}>{project.title}</Breadcrumb.Item>
            <Breadcrumb.Item isCurrent>Attribution Manager</Breadcrumb.Item>
          </Breadcrumb>
        )}
      </Stack>

      <Card variant="elevated">
        <Card.Body>
          <Stack direction="horizontal" gap="sm" align="start" className="justify-between">
            <Stack direction="vertical" gap="xs" className="min-w-0 grow">
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
              <Text size="sm">Status: {capitalizeFirstLetter(status ?? "")}</Text>

              <div className="mt-2">
                <Stack direction="horizontal" gap="xs" align="center">
                  <Text size="sm" weight="semibold">
                    Book credits
                  </Text>
                  {isCompleted && bookPageID && (
                    <IconButton
                      icon={<IconEdit size={14} />}
                      aria-label="Edit book credits"
                      tooltip="Edit book credits"
                      variant="ghost"
                      size="sm"
                      loading={updatePending && updateVariables?.pageID === bookPageID}
                      disabled={bulkRunning}
                      onClick={() =>
                        openEditor({
                          id: bookPageID,
                          title: tocData?.toc?.title ?? "Book",
                          isBook: true,
                        })
                      }
                    />
                  )}
                </Stack>
                <dl className="mt-1 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                  {CREDIT_ROLES.map((r) => (
                    <div key={r.key} className="contents">
                      <dt className="text-gray-600">{r.label}</dt>
                      <dd>
                        <CreditList refs={creditsFor(bookEntry?.pageCredits, r.key)} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {isProcessing && (
                <Stack direction="horizontal" gap="sm" align="center" role="status" aria-live="polite">
                  <Spinner size="sm" />
                  <Text size="sm">
                    {progress && progress.total > 0
                      ? `Loading credit data… processed ${progress.completed + progress.failed} of ${progress.total} pages. This page updates automatically when it's ready.`
                      : "Loading credit data… this can take a few minutes."}
                  </Text>
                </Stack>
              )}
            </Stack>

            <Stack direction="vertical" gap="sm">
              <Button
                variant="primary"
                icon={<IconRefresh size={16} />}
                loading={reloadPending || isProcessing}
                disabled={!projectID || bulkRunning}
                onClick={() => reload()}
              >
                Refresh Credit Data
              </Button>
              {missingAuthorIDs.size > 0 && (
                <Button
                  variant="secondary"
                  onClick={handleNextMissing}
                  icon={<IconArrowDown size={16} />}
                >
                  <span className="flex items-center gap-1">
                    <IconAlertTriangle size={14} className="text-red-600" />
                    {`Next Missing Author (${missingAuthorIDs.size})`}
                  </span>
                </Button>
              )}
              {isCompleted && (
                <Button
                  variant="secondary"
                  icon={<IconUsers size={16} />}
                  disabled={selectedIds.size === 0 || bulkRunning}
                  loading={bulkRunning}
                  onClick={openBulk}
                >
                  {selectedIds.size > 0
                    ? `Set Credits (${selectedIds.size} selected)`
                    : "Set Credits (select pages)"}
                </Button>
              )}
              {selectedIds.size > 0 && (
                <Button variant="outline" onClick={() => setSelectedIds(new Set())}>
                  Clear Selection
                </Button>
              )}
            </Stack>
          </Stack>
        </Card.Body>
      </Card>

      {/* Switches only the role columns of the one table below. The table is never remounted,
          so you stay at the same place in the list while flipping between roles. */}
      <RadioGroup
        name="attribution-role"
        label="Show credits for"
        orientation="horizontal"
        value={roleKey}
        onChange={(value) => setRoleKey(value as CreditRole)}
        options={CREDIT_ROLES.map((r) => ({ value: r.key, label: `${r.label} (${counts[r.key]})` }))}
      />

      <div
        ref={tableContainerRef}
        className="[&_tbody_tr:has([data-missing=true])]:!bg-[#fee2e2] [&_tbody_tr:has([data-missing=true])_td]:!bg-[#fee2e2] [&_tbody_tr:has([data-missing=true])_td]:!text-[#991b1b]"
      >
        <DataTable<AuthorshipRow>
          data={rows}
          columns={columns}
          maxHeight="calc(100vh - 320px)"
          stickyHeader
          striped
          bordered
          density="compact"
          classNames={{
            table: "table-fixed w-full",
            cell: "!py-1 relative !whitespace-normal min-w-0 break-words",
            headerCell: "!py-0",
          }}
        />
      </div>

      {/* One page, every role: pick a role, set the person, pick the next role, without leaving
          the dialog. */}
      <Modal open={editTarget !== null} onClose={() => setEditTarget(null)} size="lg">
        <Modal.Header>
          <Modal.Title>
            {editTarget?.isBook ? "Book credits" : `Credits for “${editTarget?.title ?? ""}”`}
          </Modal.Title>
          <Modal.Close />
        </Modal.Header>
        <Modal.Body className="min-h-[24rem]">
          {editTarget && (
            <Stack direction="vertical" gap="md">
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 rounded border border-gray-200 p-3 text-sm">
                {CREDIT_ROLES.map((r) => (
                  <div key={r.key} className="contents">
                    <dt className={r.key === dialogRoleKey ? "font-semibold" : "text-gray-600"}>
                      <button
                        type="button"
                        className="cursor-pointer rounded text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        onClick={() => setDialogRoleKey(r.key)}
                        aria-pressed={r.key === dialogRoleKey}
                      >
                        {r.label}
                      </button>
                    </dt>
                    <dd>
                      <CreditList refs={creditsFor(dialogEntry?.pageCredits, r.key)} />
                    </dd>
                  </div>
                ))}
              </dl>
              <RadioGroup
                name="dialog-role"
                label="Role to set"
                orientation="horizontal"
                value={dialogRoleKey}
                onChange={(value) => {
                  setDialogRoleKey(value as CreditRole);
                  setPendingEdit(null);
                }}
                options={CREDIT_ROLES.map((r) => ({ value: r.key, label: r.label }))}
              />
              <AuthorPicker
                // Remount per role so the search box starts empty for each role.
                key={dialogRoleKey}
                label={dialogRole.label}
                disabled={updatePending}
                onSelect={(author) => setPendingEdit({ author })}
              />
              <PendingSummary
                pending={pendingEdit}
                roleLabel={dialogRole.label}
                roleTag={dialogRole.tag}
              />
              {editSubpageCount > 0 && (
                <Stack direction="vertical" gap="xs">
                  <RadioGroup
                    name="dialog-scope"
                    label="Apply to"
                    orientation="horizontal"
                    value={includeSubpages ? "subpages" : "page"}
                    onChange={(value) => setIncludeSubpages(value === "subpages")}
                    options={[
                      {
                        value: "page",
                        label: editTarget?.isBook ? "The book only" : "This page only",
                      },
                      {
                        value: "subpages",
                        label: `${editTarget?.isBook ? "The book" : "This page"} and its ${editSubpageCount} subpage${editSubpageCount !== 1 ? "s" : ""}`,
                      },
                    ]}
                  />
                  {includeSubpages && pendingEdit && (
                    <Text size="sm" color="muted">
                      {editSubpageChanges} subpage{editSubpageChanges !== 1 ? "s" : ""} will change;{" "}
                      {editSubpageCount - editSubpageChanges} already{" "}
                      {editSubpageCount - editSubpageChanges === 1 ? "has" : "have"} this credit and
                      will be skipped.
                    </Text>
                  )}
                  {includeSubpages && bulkRunning && (
                    <Text size="sm" color="muted" role="status">
                      An update to subpages is running. Apply and OK are available again when it
                      finishes.
                    </Text>
                  )}
                </Stack>
              )}
            </Stack>
          )}
        </Modal.Body>
        <Modal.Footer>
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              disabled={!pendingEdit || updatePending || (includeSubpages && bulkRunning)}
              loading={updatePending}
              onClick={() => submitEdit(true)}
            >
              Apply
            </Button>
            <Button
              variant="primary"
              disabled={!pendingEdit || updatePending || (includeSubpages && bulkRunning)}
              onClick={() => submitEdit(false)}
            >
              OK
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      <Modal open={bulkOpen} onClose={closeBulk} size="lg">
        <Modal.Header>
          <Modal.Title>Set Credits for {selectedIds.size} Page(s)</Modal.Title>
          <Modal.Close />
        </Modal.Header>
        <Modal.Body className="min-h-[22rem]">
          <Stack direction="vertical" gap="md">
            <RadioGroup
              name="bulk-role"
              label="Role to set"
              orientation="horizontal"
              value={bulkRoleKey}
              onChange={(value) => {
                setBulkRoleKey(value as CreditRole);
                setPendingBulk(null);
              }}
              disabled={bulkPending}
              options={CREDIT_ROLES.map((r) => ({ value: r.key, label: r.label }))}
            />
            <AuthorPicker
              // Remount per role so the search box starts empty for each role.
              key={bulkRoleKey}
              label={bulkRole.label}
              disabled={bulkPending}
              onSelect={(author) => setPendingBulk({ author })}
            />
            <PendingSummary
              pending={pendingBulk}
              roleLabel={bulkRole.label}
              roleTag={bulkRole.tag}
              pageCount={selectedIds.size}
            />
            {bulkRunning && (
              <Text size="sm" color="muted" role="status">
                An update is running. Apply and OK are available again when it finishes.
              </Text>
            )}
          </Stack>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={closeBulk}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              disabled={!pendingBulk || bulkRunning}
              loading={bulkPending}
              onClick={() => submitBulk(true)}
            >
              Apply
            </Button>
            <Button
              variant="primary"
              disabled={!pendingBulk || bulkRunning}
              onClick={() => submitBulk(false)}
            >
              OK
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </Stack>
  );
};

export default Authorship;
