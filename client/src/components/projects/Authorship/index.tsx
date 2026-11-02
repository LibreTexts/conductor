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
  IconListCheck,
  IconPlus,
  IconRefresh,
  IconUsers,
  IconWand,
  IconX,
} from "@tabler/icons-react";
import api from "../../../api";
import type {
  AuthorSearchResult,
  AuthorshipAuthorRef,
  AuthorshipEntry,
  BookCreditAddition,
  CreditRole,
} from "../../../types";
import { useNotifications } from "../../../context/NotificationContext";
import useProject from "../../../hooks/useProject";
import { capitalizeFirstLetter, truncateString } from "../../util/HelperFunctions";
import { expandWithDescendants } from "../Restacker/util";
import RefreshModeModal, { type RefreshMode } from "../Restacker/RefreshModeModal";
import AuthorPicker from "./AuthorPicker";
import {
  CREDIT_ROLES,
  authorRefLabel,
  bookCreditsFor,
  bookRows,
  creditsFor,
  isMissingAuthor,
  applyChangeToCredits,
  isUnchanged,
  planQuickFix,
  roleInfo,
  safeHref,
  type AuthorshipRow,
  type QuickFixPerson,
  type QuickFixSource,
  type RoleChange,
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

type EditTarget = { id: string; title: string };

/**
 * What a dialog will do on Apply/OK: something done with a picked person (see `PersonMode`),
 * clearing the role, or removing one value already on the page (which may be plain text).
 */
type PendingChoice =
  | { kind: "person"; author: AuthorSearchResult }
  | { kind: "clear" }
  | { kind: "remove"; value: string; label: string };

/** What a picked person does to the role: join the others, replace everyone, or be removed. */
type PersonMode = "add" | "set" | "remove";

const PERSON_MODE_OPTIONS: { value: PersonMode; label: string }[] = [
  { value: "add", label: "Add to this role" },
  { value: "set", label: "Replace everyone in this role" },
  { value: "remove", label: "Remove from this role" },
];

const toChange = (role: CreditRole, pending: PendingChoice, mode: PersonMode): RoleChange => {
  if (pending.kind === "clear") return { role, action: "set", authorKey: null };
  if (pending.kind === "remove") return { role, action: "remove", authorKey: pending.value };
  return { role, action: mode, authorKey: pending.author.nameKey };
};

/** Shows what Apply/OK will do with the picked choice. */
const PendingSummary = ({
  pending,
  mode,
  roleLabel,
  roleTag,
  pageCount,
}: {
  pending: PendingChoice | null;
  mode: PersonMode;
  roleLabel: string;
  roleTag: string;
  pageCount?: number;
}) => {
  const where = pageCount !== undefined ? ` on ${pageCount} page(s)` : "";
  const role = roleLabel.toLowerCase();
  if (!pending) {
    return (
      <Text size="sm" color="muted">
        Pick a person or group, or use “Clear author” to remove everyone in this role. A page can
        have several people in each role.
      </Text>
    );
  }
  if (pending.kind === "clear") {
    return (
      <Alert
        variant="warning"
        title={`Everyone in the ${role} role will be removed${where}`}
        message={`Their ${roleTag} tags are removed. Other tags, including other roles, are not changed.`}
      />
    );
  }
  const who =
    pending.kind === "remove" ? (
      <strong>{pending.label}</strong>
    ) : (
      <>
        <strong>{pending.author.name}</strong>{" "}
        <span className="font-mono text-xs text-gray-500">({pending.author.nameKey})</span>
      </>
    );
  const action = pending.kind === "remove" ? "remove" : mode;
  return (
    <Text size="sm">
      {action === "add" && (
        <>
          Will add {who} as {role}
          {where}, keeping anyone already in this role.
        </>
      )}
      {action === "set" && (
        <>
          Will make {who} the only {role}
          {where}, replacing anyone else in this role.
        </>
      )}
      {action === "remove" && (
        <>
          Will remove {who} as {role}
          {where}.
        </>
      )}
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
  // What a picked person does in each dialog. Adding is the default: pages can credit several
  // people per role.
  const [editMode, setEditMode] = useState<PersonMode>("add");
  const [bulkMode, setBulkMode] = useState<PersonMode>("add");
  // In the credits dialog of a page with subpages (or the book): also apply to the subpages.
  // Kept while switching roles, so several roles can be cascaded in one sitting.
  const [includeSubpages, setIncludeSubpages] = useState(false);
  const [bulkJobID, setBulkJobID] = useState<string | null>(null);
  // The role whose "Add" dialog is open in the Book credits section, and the person picked there.
  const [bookAddRole, setBookAddRole] = useState<CreditRole | null>(null);
  const [pendingBookAuthor, setPendingBookAuthor] = useState<AuthorSearchResult | null>(null);
  const [compileOpen, setCompileOpen] = useState(false);
  // Quick Fix: fill in missing roles from each page's parent or from the book attribution.
  const [quickFixOpen, setQuickFixOpen] = useState(false);
  const [quickFixRoles, setQuickFixRoles] = useState<CreditRole[]>(["author"]);
  const [quickFixSource, setQuickFixSource] = useState<QuickFixSource>("parent-then-book");
  const [quickFixSelectedOnly, setQuickFixSelectedOnly] = useState(false);

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
        message: `Attribution update stopped after ${finishedJob.processed} of ${finishedJob.total} page(s). Refresh to see which pages changed.`,
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
  // The main page is the first row, edited like any page; the book's own credits are separate.
  const rows = useMemo(() => bookRows(tocData?.toc, entries), [tocData, entries]);

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
    if (editTarget || bulkOpen || quickFixOpen) return;
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
  }, [authorship, editTarget, bulkOpen, quickFixOpen, getTableScroller]);

  /** Pages crediting each role, for the role switch. */
  const counts = useMemo(
    () =>
      Object.fromEntries(
        CREDIT_ROLES.map((r) => [
          r.key,
          rows.filter((row) => creditsFor(row.entry?.pageCredits, r.key).length > 0).length,
        ]),
      ) as Record<CreditRole, number>,
    [rows],
  );

  /** Scanned pages with no author of their own; highlighted like non-compliant licenses. */
  const missingAuthorIDs = useMemo(
    () => new Set(rows.filter((r) => isMissingAuthor(r.entry)).map((r) => r.id)),
    [rows],
  );

  const [refreshOpen, setRefreshOpen] = useState(false);
  const { mutate: reload, isPending: reloadPending } = useMutation({
    mutationFn: (mode: RefreshMode) => api.reloadAuthorship(projectID, mode),
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
    mutationFn: (data: { pageID: string; change: RoleChange; author?: AuthorSearchResult }) =>
      api.updateAuthorshipAuthor(projectID, { pageID: data.pageID, ...data.change }),
    onSuccess: (_res, { pageID, change, author }) => {
      // Reflect the change straight away, as the server stores it: only the role's `<role>@`
      // tags change and everything else is kept.
      queryClient.setQueryData(
        ["authorship", projectID],
        (current: { pages?: AuthorshipEntry[] } | undefined) =>
          current?.pages
            ? {
                ...current,
                pages: current.pages.map((p) =>
                  p.id === pageID
                    ? { ...p, pageCredits: applyChangeToCredits(p.pageCredits, change, author) }
                    : p,
                ),
              }
            : current,
      );
    },
    onError: (err) =>
      addNotification({ type: "error", message: errorMessage(err, "Error updating attribution.") }),
  });

  const { mutate: updateBulk, isPending: bulkPending } = useMutation({
    mutationFn: (data: { pageIDs: string[] } & RoleChange) =>
      api.bulkUpdateAuthorshipAuthor(projectID, data),
    onSuccess: async (data) => {
      if (data.jobID) {
        setBulkJobID(data.jobID);
        await queryClient.invalidateQueries({ queryKey: ["authorship-status", projectID] });
        return;
      }
      addNotification({
        type: "success",
        message: `No pages changed; ${data.skipped.length} already matched.`,
      });
    },
    onError: (err) =>
      addNotification({ type: "error", message: errorMessage(err, "Failed to update attributions.") }),
  });

  const bulkRunning = bulkPending || bulkJobID !== null;

  // Book credits are re-read from the server after each change, so they show resolved names.
  const refetchAuthorship = () =>
    queryClient.invalidateQueries({ queryKey: ["authorship", projectID] });

  const {
    mutate: updateBookCredit,
    isPending: bookCreditPending,
    variables: bookCreditVariables,
  } = useMutation({
    mutationFn: (data: { role: CreditRole; authorKey: string; action: "add" | "remove" }) =>
      api.updateBookCredit(projectID, data),
    onSuccess: refetchAuthorship,
    onError: (err) =>
      addNotification({ type: "error", message: errorMessage(err, "Error updating book attributions.") }),
  });

  const {
    mutate: previewCompile,
    data: compilePreview,
    isPending: compilePreviewPending,
    reset: resetCompilePreview,
  } = useMutation({
    mutationFn: () => api.compileBookCredits(projectID, false),
    onError: (err) => {
      setCompileOpen(false);
      addNotification({ type: "error", message: errorMessage(err, "Couldn't compile attributions.") });
    },
  });

  const { mutate: applyCompile, isPending: compileApplyPending } = useMutation({
    mutationFn: () => api.compileBookCredits(projectID, true),
    onSuccess: async (data) => {
      setCompileOpen(false);
      await refetchAuthorship();
      addNotification({
        type: "success",
        message: data.additions.length
          ? `Added ${data.additions.length} book attribution(s).`
          : "The book already attributes everyone attributed on its pages.",
      });
    },
    onError: (err) =>
      addNotification({ type: "error", message: errorMessage(err, "Couldn't add book attributions.") }),
  });

  const openCompile = () => {
    resetCompilePreview();
    setCompileOpen(true);
    previewCompile();
  };

  const closeBookAdd = () => {
    setBookAddRole(null);
    setPendingBookAuthor(null);
  };

  const submitBookAdd = () => {
    if (!bookAddRole || !pendingBookAuthor) return;
    updateBookCredit(
      { role: bookAddRole, authorKey: pendingBookAuthor.nameKey, action: "add" },
      { onSuccess: closeBookAdd },
    );
  };

  /** The compile preview's additions, grouped by role in display order. */
  const compileByRole = useMemo(() => {
    const additions: BookCreditAddition[] = compilePreview?.additions ?? [];
    return CREDIT_ROLES.map((r) => ({
      role: r,
      people: additions.filter((a) => a.role === r.key),
    })).filter((g) => g.people.length > 0);
  }, [compilePreview]);

  /** Per role, the book's attributed people that are author records (only those can be written). */
  const bookPeople = useMemo(
    () =>
      Object.fromEntries(
        CREDIT_ROLES.map((r) => [
          r.key,
          bookCreditsFor(bookEntry, r.key).flatMap((c) =>
            c.author ? [{ key: c.author.nameKey, name: c.author.name }] : [],
          ),
        ]),
      ) as Record<CreditRole, QuickFixPerson[]>,
    [bookEntry],
  );

  const quickFixScope =
    quickFixSelectedOnly && selectedIds.size > 0 ? selectedIds : undefined;
  // How many pages miss each role, for the role choices; independent of the source.
  const quickFixMissing = useMemo(
    () =>
      planQuickFix(rows, CREDIT_ROLES.map((r) => r.key), "parent", {}, quickFixScope).missing,
    [rows, quickFixScope],
  );
  const quickFixPlan = useMemo(
    () => planQuickFix(rows, quickFixRoles, quickFixSource, bookPeople, quickFixScope),
    [rows, quickFixRoles, quickFixSource, bookPeople, quickFixScope],
  );
  const quickFixUsesBook = quickFixSource !== "parent";

  const openQuickFix = () => {
    setQuickFixRoles([roleKey]);
    setQuickFixSelectedOnly(selectedIds.size > 0);
    setQuickFixOpen(true);
  };

  const { mutate: assignAuthors, isPending: assignPending } = useMutation({
    mutationFn: () =>
      api.assignAuthorshipAuthors(
        projectID,
        quickFixPlan.items.flatMap((i) =>
          i.people.map((p) => ({ pageID: i.pageID, role: i.role, authorKey: p.key })),
        ),
      ),
    onSuccess: async (data) => {
      setQuickFixOpen(false);
      if (data.jobID) {
        setBulkJobID(data.jobID);
        await queryClient.invalidateQueries({ queryKey: ["authorship-status", projectID] });
        return;
      }
      addNotification({ type: "success", message: "No pages needed changing." });
    },
    onError: (err) =>
      addNotification({ type: "error", message: errorMessage(err, "Quick Fix failed.") }),
  });

  const subpagesOf = (target: EditTarget) => {
    const ids = expandWithDescendants(rows, new Set([target.id]));
    ids.delete(target.id);
    return ids;
  };

  const editSubpageCount = editTarget ? subpagesOf(editTarget).size : 0;
  const editChange = pendingEdit ? toChange(dialogRoleKey, pendingEdit, editMode) : null;
  // How many subpages applying the picked choice would actually change.
  const editSubpageChanges =
    editTarget && editChange
      ? rows.filter((r) => subpagesOf(editTarget).has(r.id) && !isUnchanged(r.entry, editChange))
          .length
      : 0;

  /**
   * Applies one change to a page, and optionally to its subpages (skipping those it wouldn't
   * change). The subpage choice is made inside the dialog, so applying never closes it: the same
   * page and subpages can be given the next change straight away. With subpages, the page goes
   * in the same bulk job: every tag write holds the edit locks, so a separate single update
   * running alongside would make the job report "busy".
   */
  const applyCredit = (
    target: EditTarget,
    change: RoleChange,
    author: AuthorSearchResult | undefined,
    withSubpages: boolean,
  ) => {
    if (!withSubpages) {
      if (!isUnchanged(entries.get(target.id), change)) {
        updateOne({ pageID: target.id, change, author });
      }
      return;
    }
    const pageIDs = new Set([target.id, ...subpagesOf(target)]);
    const toUpdate = rows
      .filter((r) => pageIDs.has(r.id) && !isUnchanged(r.entry, change))
      .map((r) => r.id);
    if (toUpdate.length > 0) updateBulk({ pageIDs: toUpdate, ...change });
  };

  const openEditor = (target: EditTarget) => {
    setDialogRoleKey(roleKey);
    setPendingEdit(null);
    setEditMode("add");
    setIncludeSubpages(false);
    setEditTarget(target);
  };

  // Apply keeps the dialog open for the next role; OK closes it.
  const submitEdit = (keepOpen: boolean) => {
    if (!editTarget || !pendingEdit || !editChange) return;
    applyCredit(
      editTarget,
      editChange,
      pendingEdit.kind === "person" ? pendingEdit.author : undefined,
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
    setBulkMode("add");
    setBulkOpen(true);
  };

  // Apply keeps the dialog open for the next role; OK closes it. The selection is kept either
  // way. Bulk updates run one at a time, so the next one waits until this one finishes.
  const submitBulk = (keepOpen: boolean) => {
    if (!pendingBulk) return;
    const change = toChange(bulkRoleKey, pendingBulk, bulkMode);
    setPendingBulk(null);
    updateBulk(
      { pageIDs: [...selectedIds], ...change },
      { onSuccess: () => !keepOpen && closeBulk() },
    );
  };

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const bookRoleCredits = useMemo(() => bookCreditsFor(bookEntry, roleKey), [bookEntry, roleKey]);

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
              {row.original.isMainPage && <Badge label="Main page" size="sm" variant="default" />}
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
                  aria-label={`Edit attributions of ${row.original.title}`}
                  tooltip="Edit attributions"
                  variant="ghost"
                  size="sm"
                  loading={updatePending && updateVariables?.pageID === row.original.id}
                  disabled={bulkRunning}
                  onClick={() => openEditor({ id: row.original.id, title: row.original.title })}
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
  const dialogEntry = editTarget ? entries.get(editTarget.id) : undefined;
  const bookAddInfo = bookAddRole ? roleInfo(bookAddRole) : null;
  const bookEditsBlocked = !isCompleted || !bookPageID || bulkRunning || isProcessing;

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

              {/* The book's own credits: `book<role>@` tags on the main page, several people per
                  role. The main page's page-level credits are edited in its table row. */}
              <div className="mt-2">
                <Stack direction="horizontal" gap="sm" align="center">
                  <Text size="sm" weight="semibold">
                    Book attributions
                  </Text>
                  {isCompleted && bookPageID && (
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<IconListCheck size={14} />}
                      disabled={bookEditsBlocked || bookCreditPending}
                      onClick={openCompile}
                    >
                      Compile from pages
                    </Button>
                  )}
                </Stack>
                <dl className="mt-1 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                  {CREDIT_ROLES.map((r) => {
                    const credits = bookCreditsFor(bookEntry, r.key);
                    return (
                      <div key={r.key} className="contents">
                        <dt className="text-gray-600">{r.label}</dt>
                        <dd className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          {credits.length === 0 && <Dash />}
                          {credits.map((c) => {
                            const removing =
                              bookCreditPending &&
                              bookCreditVariables?.action === "remove" &&
                              bookCreditVariables.role === r.key &&
                              bookCreditVariables.authorKey === c.value;
                            return (
                              <span key={c.value} className="inline-flex items-center">
                                <CreditChip refValue={c} />
                                {isCompleted && (
                                  <IconButton
                                    icon={<IconX size={12} />}
                                    aria-label={`Remove ${authorRefLabel(c)} as book ${r.label.toLowerCase()}`}
                                    tooltip="Remove"
                                    variant="ghost"
                                    size="sm"
                                    loading={removing}
                                    disabled={bookEditsBlocked || bookCreditPending}
                                    onClick={() =>
                                      updateBookCredit({ role: r.key, authorKey: c.value, action: "remove" })
                                    }
                                  />
                                )}
                              </span>
                            );
                          })}
                          {isCompleted && (
                            <IconButton
                              icon={<IconPlus size={12} />}
                              aria-label={`Add a book ${r.label.toLowerCase()}`}
                              tooltip={`Add a book ${r.label.toLowerCase()}`}
                              variant="ghost"
                              size="sm"
                              disabled={bookEditsBlocked || bookCreditPending}
                              onClick={() => {
                                setPendingBookAuthor(null);
                                setBookAddRole(r.key);
                              }}
                            />
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>

              {isProcessing && (
                <Stack direction="horizontal" gap="sm" align="center" role="status" aria-live="polite">
                  <Spinner size="sm" />
                  <Text size="sm">
                    {progress && progress.total > 0
                      ? `Loading attribution data… processed ${progress.completed + progress.failed} of ${progress.total} pages. This page updates automatically when it's ready.`
                      : "Loading attribution data… this can take a few minutes."}
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
                onClick={() => setRefreshOpen(true)}
              >
                Refresh Attribution Data
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
                  icon={<IconWand size={16} />}
                  disabled={bulkRunning}
                  onClick={openQuickFix}
                >
                  Quick Fix Missing…
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
                    ? `Set Attributions (${selectedIds.size} selected)`
                    : "Set Attributions (select pages)"}
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

      {refreshOpen && (
        <RefreshModeModal
          title="Refresh Attribution Data"
          intro="Choose how much data to reload from the library. License data in the License Restacker is refreshed at the same time."
          pageDescription="Re-reads the attribution tags of the book and every page. Keeps the existing Source and Content attributions. Fast."
          contentDescription="Reviews every page's content again for Source and Content attributions (and licenses). Can take several minutes."
          onCancel={() => setRefreshOpen(false)}
          onConfirm={(mode) => {
            setRefreshOpen(false);
            reload(mode);
          }}
        />
      )}

      {/* Switches only the role columns of the one table below. The table is never remounted,
          so you stay at the same place in the list while flipping between roles. */}
      <RadioGroup
        name="attribution-role"
        label="Show attributions for"
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
            {`Attributions for “${editTarget?.title ?? ""}”`}
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
                      {r.key === dialogRoleKey ? (
                        // The role being edited: each own `<role>@` person can be removed.
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          {creditsFor(dialogEntry?.pageCredits, r.key).length === 0 && <Dash />}
                          {creditsFor(dialogEntry?.pageCredits, r.key).map((c, i) => (
                            <span key={`${c.tag}${c.value}${i}`} className="inline-flex items-center">
                              <CreditChip refValue={c} />
                              {c.tag === r.tag && (
                                <IconButton
                                  icon={<IconX size={12} />}
                                  aria-label={`Remove ${authorRefLabel(c)} as ${r.label.toLowerCase()}`}
                                  tooltip="Remove"
                                  variant="ghost"
                                  size="sm"
                                  disabled={updatePending}
                                  onClick={() =>
                                    setPendingEdit({ kind: "remove", value: c.value, label: authorRefLabel(c) })
                                  }
                                />
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <CreditList refs={creditsFor(dialogEntry?.pageCredits, r.key)} />
                      )}
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
                onSelect={(author) =>
                  setPendingEdit(author ? { kind: "person", author } : { kind: "clear" })
                }
              />
              {pendingEdit?.kind === "person" && (
                <RadioGroup
                  name="dialog-mode"
                  label="The picked person"
                  orientation="horizontal"
                  value={editMode}
                  onChange={(value) => setEditMode(value as PersonMode)}
                  options={PERSON_MODE_OPTIONS}
                />
              )}
              <PendingSummary
                pending={pendingEdit}
                mode={editMode}
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
                        label: "This page only",
                      },
                      {
                        value: "subpages",
                        label: `This page and its ${editSubpageCount} subpage${editSubpageCount !== 1 ? "s" : ""}`,
                      },
                    ]}
                  />
                  {includeSubpages && pendingEdit && (
                    <Text size="sm" color="muted">
                      {editSubpageChanges} subpage{editSubpageChanges !== 1 ? "s" : ""} will change;{" "}
                      {editSubpageCount - editSubpageChanges} already{" "}
                      {editSubpageCount - editSubpageChanges === 1 ? "is" : "are"} already like this and
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
          <Modal.Title>Set Attributions for {selectedIds.size} Page(s)</Modal.Title>
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
              onSelect={(author) =>
                setPendingBulk(author ? { kind: "person", author } : { kind: "clear" })
              }
            />
            {pendingBulk?.kind === "person" && (
              <RadioGroup
                name="bulk-mode"
                label="The picked person"
                orientation="horizontal"
                value={bulkMode}
                onChange={(value) => setBulkMode(value as PersonMode)}
                options={PERSON_MODE_OPTIONS}
              />
            )}
            <PendingSummary
              pending={pendingBulk}
              mode={bulkMode}
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

      <Modal open={quickFixOpen} onClose={() => setQuickFixOpen(false)} size="lg">
        <Modal.Header>
          <Modal.Title>Quick Fix Missing Attributions</Modal.Title>
          <Modal.Close />
        </Modal.Header>
        <Modal.Body className="min-h-[24rem]">
          <Stack direction="vertical" gap="md">
            <Text size="sm" color="muted">
              Fills in roles that pages have no attribution for, copying everyone the source has
              in that role. Pages that already have an attribution for a role are never changed.
            </Text>
            <fieldset>
              <legend className="mb-1 text-sm font-semibold">Roles to fix</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {CREDIT_ROLES.map((r) => (
                  <Checkbox
                    key={r.key}
                    name={`quick-fix-role-${r.key}`}
                    label={`${r.label} (${quickFixMissing[r.key] ?? 0} missing)`}
                    checked={quickFixRoles.includes(r.key)}
                    onChange={(checked) =>
                      setQuickFixRoles((prev) =>
                        checked
                          ? CREDIT_ROLES.map((x) => x.key).filter(
                              (k) => k === r.key || prev.includes(k),
                            )
                          : prev.filter((k) => k !== r.key),
                      )
                    }
                  />
                ))}
              </div>
            </fieldset>
            <RadioGroup
              name="quick-fix-source"
              label="Use"
              value={quickFixSource}
              onChange={(value) => setQuickFixSource(value as QuickFixSource)}
              options={[
                {
                  value: "parent-then-book",
                  label: "The nearest parent page's attribution, else the book attribution",
                },
                { value: "parent", label: "The nearest parent page's attribution only" },
                { value: "book", label: "The book attribution only" },
              ]}
            />
            {selectedIds.size > 0 && (
              <Checkbox
                name="quick-fix-selected-only"
                label={`Only the ${selectedIds.size} selected page(s)`}
                checked={quickFixSelectedOnly}
                onChange={setQuickFixSelectedOnly}
              />
            )}
            {quickFixUsesBook &&
              quickFixRoles.map((roleKeyToFix) => {
                const info = roleInfo(roleKeyToFix);
                const people = bookPeople[roleKeyToFix];
                if (people.length === 0) {
                  return (
                    <Text key={roleKeyToFix} size="sm" color="muted">
                      The book has no {info.label.toLowerCase()} attribution linked to an author
                      record, so only parent pages can fill this role.
                    </Text>
                  );
                }
                return null;
              })}

            {quickFixRoles.length > 0 && (
              <div className="rounded border border-gray-200 p-3 text-sm">
                {quickFixRoles.map((roleKeyToFix) => {
                  const info = roleInfo(roleKeyToFix);
                  const forRole = quickFixPlan.items.filter((i) => i.role === roleKeyToFix);
                  const fromParent = forRole.filter((i) => i.from === "parent").length;
                  const unresolved = quickFixPlan.unresolved[roleKeyToFix] ?? 0;
                  return (
                    <p key={roleKeyToFix}>
                      <strong>{info.label}:</strong> {forRole.length} page(s) will be filled
                      {forRole.length > 0 &&
                        ` (${fromParent} from a parent, ${forRole.length - fromParent} from the book)`}
                      {unresolved > 0 && `; ${unresolved} have no source and stay missing`}.
                    </p>
                  );
                })}
                {quickFixPlan.items.length > 0 && (
                  <ul className="mt-2 max-h-48 overflow-y-auto border-t border-gray-200 pt-2">
                    {quickFixPlan.items.slice(0, 200).map((i) => (
                      <li key={`${i.pageID}-${i.role}`}>
                        {i.title} → <strong>{i.people.map((p) => p.name).join(", ")}</strong>{" "}
                        <span className="text-gray-500">
                          ({roleInfo(i.role).label.toLowerCase()}, from {i.from === "parent" ? "parent" : "book"})
                        </span>
                      </li>
                    ))}
                    {quickFixPlan.items.length > 200 && (
                      <li className="text-gray-500">…and {quickFixPlan.items.length - 200} more</li>
                    )}
                  </ul>
                )}
              </div>
            )}
            {bulkRunning && (
              <Text size="sm" color="muted" role="status">
                An update is running. The Quick Fix is available again when it finishes.
              </Text>
            )}
          </Stack>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={() => setQuickFixOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={quickFixPlan.items.length === 0 || bulkRunning}
              loading={assignPending}
              onClick={() => assignAuthors()}
            >
              {`Fix ${quickFixPlan.items.length} attribution(s)`}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      <Modal open={bookAddRole !== null} onClose={closeBookAdd} size="md">
        <Modal.Header>
          <Modal.Title>Add a book {bookAddInfo?.label.toLowerCase()}</Modal.Title>
          <Modal.Close />
        </Modal.Header>
        <Modal.Body className="min-h-[16rem]">
          {bookAddInfo && (
            <Stack direction="vertical" gap="md">
              <Text size="sm" color="muted">
                Book attributions are written on the main page as{" "}
                <span className="font-mono">book{bookAddInfo.key}@</span> tags. A book can attribute
                several people per role; the main page&apos;s own attributions are not changed.
              </Text>
              <AuthorPicker
                key={bookAddInfo.key}
                label={bookAddInfo.label}
                allowClear={false}
                disabled={bookCreditPending}
                onSelect={(author) => setPendingBookAuthor(author)}
              />
              {pendingBookAuthor && (
                <Text size="sm">
                  Will add <strong>{pendingBookAuthor.name}</strong>{" "}
                  <span className="font-mono text-xs text-gray-500">({pendingBookAuthor.nameKey})</span>{" "}
                  as book {bookAddInfo.label.toLowerCase()}.
                </Text>
              )}
            </Stack>
          )}
        </Modal.Body>
        <Modal.Footer>
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={closeBookAdd}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!pendingBookAuthor || bookEditsBlocked}
              loading={bookCreditPending}
              onClick={submitBookAdd}
            >
              Add
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      <Modal open={compileOpen} onClose={() => setCompileOpen(false)} size="lg">
        <Modal.Header>
          <Modal.Title>Compile book attributions from pages</Modal.Title>
          <Modal.Close />
        </Modal.Header>
        <Modal.Body className="min-h-[16rem]">
          {compilePreviewPending || !compilePreview ? (
            <Spinner />
          ) : (
            <Stack direction="vertical" gap="md">
              <Text size="sm" color="muted">
                Collects every page&apos;s own attributions, the main page included, and adds the
                people not yet attributed on the book. Existing book attributions are kept. Uses the
                attribution data from the last refresh; if pages were edited outside this tool, refresh
                first.
              </Text>
              {compileByRole.length === 0 ? (
                <Alert
                  variant="info"
                  title="Nothing to add"
                  message="The book already attributes everyone attributed on its pages."
                />
              ) : (
                <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 rounded border border-gray-200 p-3 text-sm">
                  {compileByRole.map(({ role: r, people }) => (
                    <div key={r.key} className="contents">
                      <dt className="text-gray-600">{r.label}</dt>
                      <dd>
                        {people.map((p) => (
                          <span key={p.key} className="mr-3 inline-block">
                            {p.name} <span className="font-mono text-xs text-gray-500">({p.key})</span>
                          </span>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {compilePreview.unlinked > 0 && (
                <Text size="sm" color="muted">
                  {compilePreview.unlinked} page attribution{compilePreview.unlinked !== 1 ? "s are" : " is"}{" "}
                  not linked to an author record and can&apos;t be added.
                </Text>
              )}
            </Stack>
          )}
        </Modal.Body>
        <Modal.Footer>
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={() => setCompileOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!compilePreview?.additions.length || bookEditsBlocked}
              loading={compileApplyPending}
              onClick={() => applyCompile()}
            >
              Add to book
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </Stack>
  );
};

export default Authorship;
