import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  Heading,
  IconButton,
  Link,
  Modal,
  Spinner,
  Stack,
  Text,
  Tooltip,
} from "@libretexts/davis-react";
import { DataTable, createColumnHelper } from "@libretexts/davis-react-table";
import { IconEdit, IconExternalLink, IconRefresh, IconUsers } from "@tabler/icons-react";
import api from "../../../api";
import type { AuthorSearchResult, AuthorshipAuthorRef, AuthorshipEntry } from "../../../types";
import { useNotifications } from "../../../context/NotificationContext";
import { useModals } from "../../../context/ModalContext";
import useProject from "../../../hooks/useProject";
import { capitalizeFirstLetter, truncateString } from "../../util/HelperFunctions";
import { expandWithDescendants } from "../Restacker/util";
import AuthorPicker from "./AuthorPicker";
import SubpageAuthorModal from "./SubpageAuthorModal";
import { authorRefLabel, flattenToc, isUnchanged, type AuthorshipRow } from "./util";

const columnHelper = createColumnHelper<AuthorshipRow>();

const errorMessage = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { errMsg?: string } } })?.response?.data?.errMsg || fallback;

const Dash = () => <span className="text-gray-400">—</span>;

/** One author tag: the resolved author (linked when it has a URL) or the tag text as written. */
const AuthorChip = ({ refValue }: { refValue: AuthorshipAuthorRef }) => {
  const author = refValue.author;
  const label = authorRefLabel(refValue);
  const tooltip = author
    ? [author.nameKey, author.campusName].filter(Boolean).join(" · ")
    : `Not linked to an author record (${refValue.tag}${refValue.value})`;
  return (
    <Tooltip content={tooltip} placement="top">
      <span className="inline-flex items-center gap-1">
        {author?.nameURL ? (
          <Link href={author.nameURL} target="_blank" rel="noopener noreferrer">
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

const AuthorList = ({ refs }: { refs?: AuthorshipAuthorRef[] }) =>
  refs?.length ? (
    <Stack direction="vertical" gap="xs">
      {refs.map((r, i) => (
        <AuthorChip key={`${r.tag}${r.value}${i}`} refValue={r} />
      ))}
    </Stack>
  ) : (
    <Dash />
  );

/**
 * Authorship: set the book's and each page's author (an `author@<key>` tag on the library page),
 * and see the authors of the content each page reuses. Modeled on the License Restacker.
 */
const Authorship = () => {
  const { id } = useParams<{ id: string }>();
  const projectID = id ?? "";
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const { openModal, closeAllModals } = useModals();
  const { project, isLoading: isLoadingProject } = useProject(projectID);

  // The book or page whose author is being edited. The picker opens in a dialog: inline, its
  // dropdown would be clipped by the card and the table's scroll container.
  const [editTarget, setEditTarget] = useState<{
    id: string;
    title: string;
    isBook: boolean;
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
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
        message: `Author update stopped after ${finishedJob.processed} of ${finishedJob.total} page(s). Refresh to see which pages changed.`,
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
    mutationFn: (data: { pageID: string; author: AuthorSearchResult | null }) =>
      api.updateAuthorshipAuthor(projectID, {
        pageID: data.pageID,
        authorKey: data.author?.nameKey ?? null,
      }),
    onSuccess: (_res, { pageID, author }) => {
      // Reflect the change straight away; the server stored the same thing.
      queryClient.setQueryData(
        ["authorship", projectID],
        (current: { pages?: AuthorshipEntry[] } | undefined) =>
          current?.pages
            ? {
                ...current,
                pages: current.pages.map((p) =>
                  p.id === pageID
                    ? {
                        ...p,
                        pageAuthors: author
                          ? [{ tag: "author@" as const, value: author.nameKey, author }]
                          : p.pageAuthors.filter((r) => r.tag !== "author@"),
                      }
                    : p,
                ),
              }
            : current,
      );
      setEditTarget(null);
    },
    onError: (err) =>
      addNotification({ type: "error", message: errorMessage(err, "Error updating author.") }),
  });

  const { mutate: updateBulk, isPending: bulkPending } = useMutation({
    mutationFn: (data: { pageIDs: string[]; authorKey: string | null }) =>
      api.bulkUpdateAuthorshipAuthor(projectID, data),
    onSuccess: async (data) => {
      if (data.jobID) {
        setBulkJobID(data.jobID);
        await queryClient.invalidateQueries({ queryKey: ["authorship-status", projectID] });
        return;
      }
      addNotification({
        type: "success",
        message: `No pages changed; ${data.skipped.length} already had this author.`,
      });
    },
    onError: (err) =>
      addNotification({ type: "error", message: errorMessage(err, "Failed to update authors.") }),
  });

  const bulkRunning = bulkPending || bulkJobID !== null;

  /**
   * Sets one page's (or the book's) author. When it has subpages, first asks whether to apply
   * the same author to them, as the License Restacker does for licenses.
   */
  const applyAuthor = (
    target: { id: string; title: string; isBook: boolean },
    author: AuthorSearchResult | null,
  ) => {
    const applyHere = () => updateOne({ pageID: target.id, author });

    const subpageIDs = target.isBook
      ? new Set(rows.map((r) => r.id))
      : expandWithDescendants(rows, new Set([target.id]));
    subpageIDs.delete(target.id);
    if (subpageIDs.size === 0) {
      applyHere();
      return;
    }

    const authorKey = author?.nameKey ?? null;
    const plan = rows
      .filter((r) => subpageIDs.has(r.id))
      .map((row) => ({ row, skip: isUnchanged(row.entry, authorKey) }));

    openModal(
      <SubpageAuthorModal
        pageTitle={target.title}
        authorLabel={author?.name ?? null}
        plan={plan}
        onCancel={closeAllModals}
        onThisPageOnly={() => {
          closeAllModals();
          applyHere();
        }}
        onIncludeSubpages={(ids) => {
          closeAllModals();
          applyHere();
          updateBulk({ pageIDs: ids, authorKey });
        }}
      />,
    );
  };

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const bookAuthorRefs = bookEntry?.pageAuthors ?? [];

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
        header: "Page",
        enableSorting: false,
        cell: ({ row }) => (
          <div style={{ paddingLeft: `${row.original.depth * 16}px` }}>
            <Link href={row.original.url} target="_blank" rel="noopener noreferrer">
              {row.original.title}
              <IconExternalLink size={12} className="ml-1 inline" aria-hidden="true" />
            </Link>
          </div>
        ),
      }),
      columnHelper.display({
        id: "pageAuthor",
        header: "Page Author",
        cell: ({ row }) => {
          const entry = row.original.entry;
          const own = entry?.pageAuthors ?? [];
          return (
            <div className="flex items-start justify-between gap-2">
              {own.length ? (
                <AuthorList refs={own} />
              ) : bookAuthorRefs.length ? (
                <span className="text-sm italic text-gray-500">
                  Inherits book author ({bookAuthorRefs.map(authorRefLabel).join(", ")})
                </span>
              ) : (
                <Dash />
              )}
              {isCompleted && (
                <IconButton
                  icon={<IconEdit size={14} />}
                  aria-label={`Edit author of ${row.original.title}`}
                  tooltip="Edit author"
                  variant="ghost"
                  size="sm"
                  loading={updatePending && updateVariables?.pageID === row.original.id}
                  disabled={bulkRunning}
                  onClick={() =>
                    setEditTarget({ id: row.original.id, title: row.original.title, isBook: false })
                  }
                />
              )}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "sourceAuthor",
        header: () => (
          <Tooltip content="The author of the page this page is transcluded from" placement="bottom">
            <span>Source Author</span>
          </Tooltip>
        ),
        cell: ({ row }) => {
          const source = row.original.entry?.sourceAuthor;
          return source ? <AuthorChip refValue={source} /> : <Dash />;
        },
      }),
      columnHelper.display({
        id: "contentAuthors",
        header: () => (
          <Tooltip content="Authors of content reused within this page" placement="bottom">
            <span>Content Authors</span>
          </Tooltip>
        ),
        cell: ({ row }) => <AuthorList refs={row.original.entry?.contentAuthors} />,
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
    [rows, selectedIds, allSelected, isCompleted, updatePending, updateVariables, bulkRunning, bookAuthorRefs],
  );

  if (tocLoading) return <Spinner />;
  if (tocError) return <div>Error loading table of contents.</div>;

  return (
    <Stack direction="vertical" gap="md" className="py-8 px-16">
      <Stack direction="vertical" gap="xs" className="mb-2">
        <Heading level={2}>Authorship</Heading>
        {!isLoadingProject && project?.title && (
          <Breadcrumb className="ml-1">
            <Breadcrumb.Item href="/projects">Projects</Breadcrumb.Item>
            <Breadcrumb.Item href={`/projects/${projectID}`}>{project.title}</Breadcrumb.Item>
            <Breadcrumb.Item isCurrent>Authorship</Breadcrumb.Item>
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

              <div className="mt-1">
                <Text size="sm" weight="semibold">
                  Book Author
                </Text>
                <div className="flex items-center gap-2">
                  <AuthorList refs={bookAuthorRefs} />
                  {isCompleted && bookPageID && (
                    <IconButton
                      icon={<IconEdit size={14} />}
                      aria-label="Edit book author"
                      tooltip="Edit book author"
                      variant="ghost"
                      size="sm"
                      loading={updatePending && updateVariables?.pageID === bookPageID}
                      disabled={bulkRunning}
                      onClick={() =>
                        setEditTarget({
                          id: bookPageID,
                          title: tocData?.toc?.title ?? "Book",
                          isBook: true,
                        })
                      }
                    />
                  )}
                </div>
              </div>

              {isProcessing && (
                <Stack direction="horizontal" gap="sm" align="center" role="status" aria-live="polite">
                  <Spinner size="sm" />
                  <Text size="sm">
                    {progress && progress.total > 0
                      ? `Loading author data… processed ${progress.completed + progress.failed} of ${progress.total} pages. This page updates automatically when it's ready.`
                      : "Loading author data… this can take a few minutes."}
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
                Refresh Author Data
              </Button>
              {isCompleted && (
                <Button
                  variant="secondary"
                  icon={<IconUsers size={16} />}
                  disabled={selectedIds.size === 0 || bulkRunning}
                  loading={bulkRunning}
                  onClick={() => setBulkOpen(true)}
                >
                  {selectedIds.size > 0
                    ? `Set Author (${selectedIds.size} selected)`
                    : "Set Author (select pages)"}
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

      <Modal open={editTarget !== null} onClose={() => setEditTarget(null)} size="md">
        <Modal.Header>
          <Modal.Title>
            {editTarget?.isBook ? "Book Author" : `Author of “${editTarget?.title ?? ""}”`}
          </Modal.Title>
          <Modal.Close />
        </Modal.Header>
        <Modal.Body className="min-h-[18rem]">
          {editTarget && (
            <AuthorPicker
              label={editTarget.isBook ? "Book author" : "Page author"}
              disabled={updatePending}
              onSelect={(author) => {
                const target = editTarget;
                // Close first: choosing may open the "apply to subpages?" prompt.
                setEditTarget(null);
                applyAuthor(target, author);
              }}
              onCancel={() => setEditTarget(null)}
            />
          )}
        </Modal.Body>
      </Modal>

      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} size="md">
        <Modal.Header>
          <Modal.Title>Set Author for {selectedIds.size} Page(s)</Modal.Title>
          <Modal.Close />
        </Modal.Header>
        <Modal.Body className="min-h-[18rem]">
          <AuthorPicker
            label="Author"
            disabled={bulkPending}
            onSelect={(author) =>
              updateBulk(
                { pageIDs: [...selectedIds], authorKey: author?.nameKey ?? null },
                {
                  onSuccess: () => {
                    setBulkOpen(false);
                    setSelectedIds(new Set());
                  },
                },
              )
            }
            onCancel={() => setBulkOpen(false)}
          />
        </Modal.Body>
      </Modal>

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
    </Stack>
  );
};

export default Authorship;
