import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Heading,
  IconButton,
  Select,
  Spinner,
  Stack,
  Text,
} from "@libretexts/davis-react";
import useProject from "../../../hooks/useProject";
import { useParams } from "react-router-dom";
import {
  ReferenceEntry,
  ReferenceFormatType,
  ReferenceFormatTypes,
  ReferenceFormData,
  ReferenceDisplayLocation,
  ReferenceScopeGroup,
  ReferenceScopeMode,
  generateCitationKey,
  compareCitations,
  type CitationCheckResult,
  EntryTypes,
  scopeModeForDisplayLocation,
} from "./model";
import AddContent from "./ReferenceEntry/AddContent";
import EditReference from "./ReferenceEntry/EditReference";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../api";
import { useNotifications } from "../../../context/NotificationContext";
import { DataTable, createColumnHelper } from "@libretexts/davis-react-table";
import {
  IconAlertTriangle,
  IconCopy,
  IconExternalLink,
  IconListTree,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { buildLibraryPageGoURL } from "../../../utils/projectHelpers";
import Configure, { type ConfigureSettings } from "./Scope/Configure";
import Populate, { hasPopulateJobData } from "./Populate";
import CitationCheck from "./CitationCheck";
import BulkRemoveModal from "./BulkRemoveModal";
import { useRowsMaxHeight } from "./useRowsMaxHeight";
import ReferenceWarningsModal, {
  type ReferenceWarning,
} from "./ReferenceWarningsModal";

const columnHelper = createColumnHelper<ReferenceEntry>();
const BOOK_REFERENCES_QUERY_KEY = "bookReferencesFormat";

/**
 * Warnings for every reference, by referenceID. Only references with at least
 * one warning are included. New kinds of warning are added here.
 */
function buildReferenceWarnings(
  check: CitationCheckResult | null | undefined,
): Map<string, ReferenceWarning[]> {
  const warnings = new Map<string, ReferenceWarning[]>();
  const add = (referenceID: string, warning: ReferenceWarning) =>
    warnings.set(referenceID, [...(warnings.get(referenceID) ?? []), warning]);

  for (const reference of check?.unused ?? []) {
    add(reference.referenceID, {
      id: "not-cited",
      title: "Not cited",
      detail:
        "The last citation scan found no page that cites this reference, so it appears in no reference list. Cite it on a page and scan again, or remove it from this book.",
    });
  }
  return warnings;
}

/** The server's `errMsg` (e.g. "Citation key … is already used"), else `fallback`. */
function errorMessageFrom(error: unknown, fallback: string): string {
  const serverMessage = (
    error as { response?: { data?: { errMsg?: string } } }
  )?.response?.data?.errMsg;
  return (
    serverMessage || (error instanceof Error && error.message) || fallback
  );
}

/** Which references the table shows, by whether the last scan found them cited. */
type CitationFilter = "all" | "cited" | "notCited";

/** One-line description of where reference lists appear, as the scope editor names it. */
function describeScope({
  scopeMode,
  scopeGroups,
  displayLocation,
  pageTitle,
}: {
  scopeMode?: ReferenceScopeMode;
  scopeGroups?: ReferenceScopeGroup[];
  displayLocation?: ReferenceDisplayLocation;
  pageTitle?: string;
}): string {
  const mode = scopeMode ?? scopeModeForDisplayLocation(displayLocation);
  if (mode === "CHAPTER") {
    const count = scopeGroups?.length;
    return count
      ? `References by chapter (${count} group${count === 1 ? "" : "s"})`
      : "References by chapter";
  }
  if (mode === "BACKMATTER") {
    return `One “${pageTitle?.trim() || "References"}” page in the back matter`;
  }
  return "References at the end of each page";
}

type BookReferencesQueryData = Awaited<
  ReturnType<typeof api.getBookReferenceDetails>
>;

const ReferenceManager: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const [showAddContentModal, setShowAddContentModal] = useState(false);
  const [showConfigureModal, setShowConfigureModal] = useState(false);
  const [showPopulateModal, setShowPopulateModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ReferenceEntry | null>(
    null,
  );
  const [editingReference, setEditingReference] =
    useState<ReferenceEntry | null>(null);
  const [warningReference, setWarningReference] =
    useState<ReferenceEntry | null>(null);
  const [citationFilter, setCitationFilter] = useState<CitationFilter>("all");
  /** Selected table rows, by referenceID. */
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>(
    {},
  );
  const [showBulkRemove, setShowBulkRemove] = useState(false);

  const {
    project,
    isLoading: isLoadingProject,
    isError: isErrorProject,
    bookID,
  } = useProject(id ?? "");

  const bookReferencesQueryKey = [BOOK_REFERENCES_QUERY_KEY, id] as const;

  const projectBookURL =
    project?.libreLibrary && project?.libreCoverID
      ? buildLibraryPageGoURL(project.libreLibrary, project.libreCoverID)
      : undefined;


  const {
    data: bookReferencesDetails,
    isLoading: isLoadingBookReferencesFormat,
  } = useQuery({
    queryKey: bookReferencesQueryKey,
    queryFn: () => api.getBookReferenceDetails(id ?? ""),
    enabled: !!id,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    onError: () => {
      addNotification({
        type: "error",
        message: "Error loading book references format",
      });
    },
  });

  const { data: bookToc } = useQuery({
    queryKey: [
      "referenceBookToc",
      id,
      project?.libreLibrary,
      project?.libreCoverID,
    ],
    queryFn: () =>
      api.getReferenceTOC(id ?? "", {
        toc: true,
        bookID: `${project?.libreLibrary}-${project?.libreCoverID}`,
      }),
    enabled: !!id && !!project?.libreLibrary && !!project?.libreCoverID,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    onError: () => {
      addNotification({
        type: "error",
        message: "Error loading book TOC",
      });
    },
  });


  const referenceFormat = bookReferencesDetails?.data?.format;
  const displayLocation = bookReferencesDetails?.data?.displayLocation;
  const pageTitle = bookReferencesDetails?.data?.pageTitle;
  const entries = bookReferencesDetails?.data?.entries ?? [];

  /** Keys already used by this book's references, optionally ignoring one. */
  const citationKeysExcept = (referenceID?: string) =>
    entries
      .filter((entry) => entry.referenceID !== referenceID)
      .map((entry) => entry.citationKey);

  const { data: populateDetails } = useQuery({
    queryKey: ["populateReferences", id],
    queryFn: () => api.populateReferencesDetails(id ?? ""),
    enabled: !!id,
    refetchOnWindowFocus: false,
    retry: false,
    refetchInterval: (data, query) => {
      try {
        if (query.state.status === "error" || data?.err) return false;
        const job = data?.data;
        if (job.status === "pending") return 2000;
        // Stop on completed, failed, or any other terminal status.
        return false;
      } catch (error) {
        return false;
      }
    },
  });

  // The latest scan, running or finished.
  const populateJob = hasPopulateJobData(populateDetails?.data)
    ? populateDetails.data
    : null;
  const hasPopulateJob = populateJob?.status === "pending";

  useEffect(() => {
    if (hasPopulateJob) {
      setShowPopulateModal(true);
    }
  }, [hasPopulateJob]);

  // When a running scan finishes, reload the book's data so the citation
  // check reflects it.
  const scanWasRunning = useRef(false);
  useEffect(() => {
    if (scanWasRunning.current && !hasPopulateJob) {
      queryClient.invalidateQueries({ queryKey: bookReferencesQueryKey });
    }
    scanWasRunning.current = hasPopulateJob;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPopulateJob]);

  const updateBookReferencesCache = (
    updater: (current: BookReferencesQueryData) => BookReferencesQueryData,
  ) => {
    queryClient.setQueryData<BookReferencesQueryData>(
      bookReferencesQueryKey,
      (current) => (current ? updater(current) : current),
    );
  };

  /** Format-only change from the toolbar dropdown. */
  const { mutate: updateFormat, isPending: isUpdatingFormat } = useMutation({
    mutationFn: (
      settings: Parameters<typeof api.updateBookReferenceFormat>[1],
    ) => api.updateBookReferenceFormat(id ?? "", settings),
    onMutate: async (settings) => {
      await queryClient.cancelQueries({ queryKey: bookReferencesQueryKey });
      const previous = queryClient.getQueryData<BookReferencesQueryData>(
        bookReferencesQueryKey,
      );
      updateBookReferencesCache((current) => ({
        ...current,
        data: {
          ...current.data,
          format: settings.format,
          displayLocation: settings.displayLocation,
          pageTitle: settings.pageTitle,
          selectedList: settings.selectedList,
        },
      }));
      return { previous };
    },
    onSuccess: (data, settings) => {
      updateBookReferencesCache((current) => ({
        ...current,
        data: {
          ...current.data,
          format: data.data.format,
          displayLocation:
            data.data.displayLocation ?? settings.displayLocation,
          pageTitle: data.data.pageTitle ?? settings.pageTitle,
          selectedList: data.data.selectedList ?? settings.selectedList,
        },
      }));
      addNotification({
        type: "success",
        message:
          "Book references settings updated successfully with format: " +
          settings.format,
      });
    },
    onError: (_error, _settings, context) => {
      if (context?.previous) {
        queryClient.setQueryData(bookReferencesQueryKey, context.previous);
      }
      addNotification({
        type: "error",
        message: "Error updating book references settings",
      });
    },
  });

  /** Format + scope from the Configure modal (the glossary scope model). */
  const { mutateAsync: saveScope, isPending: isSavingScope } = useMutation({
    mutationFn: async (settings: ConfigureSettings) => {
      const res = await api.saveReferenceScope(id ?? "", settings);
      if (res.err) throw new Error(res.errMsg ?? "Failed to save settings");
      return res;
    },
    onSuccess: (res) => {
      updateBookReferencesCache((current) => ({
        ...current,
        data: { ...current.data, ...res.data },
      }));
      addNotification({
        type: "success",
        message: "Reference settings saved",
      });
    },
    onError: (error) => {
      addNotification({
        type: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "Error saving reference settings",
      });
    },
  });

  const { mutateAsync: resetScope } = useMutation({
    mutationFn: async () => {
      const res = await api.resetReferenceScope(id ?? "");
      if (res.err) throw new Error(res.errMsg ?? "Failed to reset scope");
    },
    onSuccess: () => {
      updateBookReferencesCache((current) => ({
        ...current,
        data: { ...current.data, scopeMode: undefined, scopeGroups: undefined },
      }));
      addNotification({ type: "success", message: "Saved reference scope reset" });
    },
    onError: () => {
      addNotification({ type: "error", message: "Error resetting reference scope" });
    },
  });

  const appendEntriesToCache = (entriesToAdd: ReferenceEntry[]) => {
    if (entriesToAdd.length === 0) return;

    updateBookReferencesCache((current) => {
      const existing = current.data.entries ?? [];
      const existingIds = new Set(existing.map((entry) => entry.referenceID));
      return {
        ...current,
        data: {
          ...current.data,
          entries: [
            ...existing,
            ...entriesToAdd.filter(
              (entry) => !existingIds.has(entry.referenceID),
            ),
          ],
        },
      };
    });
  };

  const { mutate: removeReferences, isPending: isRemovingReferences } =
    useMutation({
      mutationFn: async ({
        referenceIDs,
        deleteFromReferences: permanentlyDelete,
      }: {
        referenceIDs: string[];
        deleteFromReferences: boolean;
      }) => {
        const res = await api.deleteBookReferences(
          id ?? "",
          referenceIDs,
          permanentlyDelete,
        );
        if (res.err) throw new Error(res.errMsg);
        return res.data;
      },
      onSuccess: ({ removed, failed }) => {
        const removedSet = new Set(removed);
        updateBookReferencesCache((current) => ({
          ...current,
          data: {
            ...current.data,
            entries: (current.data.entries ?? []).filter(
              (entry) => !removedSet.has(entry.referenceID),
            ),
          },
        }));
        // Keep failed rows selected so they can be retried or inspected.
        setRowSelection(
          Object.fromEntries(failed.map((f) => [f.referenceID, true])),
        );
        setShowBulkRemove(false);
        if (removed.length > 0) {
          addNotification({
            type: "success",
            message: `Removed ${removed.length} reference${removed.length === 1 ? "" : "s"}`,
          });
        }
        if (failed.length > 0) {
          addNotification({
            type: "error",
            message: `${failed.length} reference${failed.length === 1 ? " wasn't" : "s weren't"} removed: ${failed[0].message}`,
          });
        }
      },
      onError: (error) => {
        addNotification({
          type: "error",
          message: errorMessageFrom(error, "Error removing references"),
        });
      },
    });

  const removeEntryFromCache = (referenceID: string) => {
    updateBookReferencesCache((current) => ({
      ...current,
      data: {
        ...current.data,
        entries: (current.data.entries ?? []).filter(
          (entry) => entry.referenceID !== referenceID,
        ),
      },
    }));
  };

  const { mutateAsync: addReference } = useMutation({
    mutationFn: (data: ReferenceFormData) =>
      api.addBookReference(id ?? "", data),
    onSuccess: (response, data) => {
      if (response.err || !response.data) return;
      appendEntriesToCache([
        {
          ...data,
          referenceID: response.data.referenceID,
          citationKey: response.data.citationKey,
          projectID: id,
        },
      ]);
      addNotification({
        type: "success",
        message: "Reference added successfully",
      });
    },
    onError: (error) => {
      addNotification({
        type: "error",
        message: errorMessageFrom(error, "Error adding reference"),
      });
    },
  });

  const { mutateAsync: addExistingReferencesMutation } = useMutation({
    mutationFn: (entries: ReferenceEntry[]) =>
      api.addReferencesToProject(
        id ?? "",
        entries.map((entry) => entry.referenceID),
      ),
    onSuccess: (response, entries) => {
      if (response.err) return;
      const added = new Set(response.data.added);
      appendEntriesToCache(
        entries.filter((entry) => added.has(entry.referenceID)),
      );
      const keyClashes = response.data.skipped
        .filter((skip) => skip.reason === "key-in-use")
        .map(
          (skip) =>
            entries.find((entry) => entry.referenceID === skip.referenceID)
              ?.citationKey ?? skip.referenceID,
        );
      if (added.size > 0) {
        addNotification({
          type: "success",
          message: `Added ${added.size} reference${added.size === 1 ? "" : "s"}`,
        });
      }
      if (response.data.skipped.length > 0) {
        addNotification({
          type: "error",
          message: keyClashes.length
            ? `Not added: this book already uses the citation key${keyClashes.length === 1 ? "" : "s"} ${keyClashes.join(", ")} for a different reference.`
            : "Some references could not be found and were not added.",
        });
      }
    },
    onError: () => {
      addNotification({
        type: "error",
        message: "Error adding references",
      });
    },
  });

  const { mutate: deleteReference, isPending: isDeleting } = useMutation({
    mutationFn: ({
      referenceID,
      deleteFromReferences: permanentlyDelete,
    }: {
      referenceID: string;
      deleteFromReferences: boolean;
    }) => api.deleteBookReference(id ?? "", referenceID, permanentlyDelete),
    onSuccess: (_data, variables) => {
      removeEntryFromCache(variables.referenceID);
      setPendingDelete(null);
      addNotification({ type: "success", message: "Reference removed" });
    },
    onError: (error) => {
      addNotification({
        type: "error",
        message: errorMessageFrom(error, "Error deleting reference"),
      });
    },
  });

  const { mutate: updateReference, isPending: isUpdatingReference } =
    useMutation({
      mutationFn: async (
        data: ReferenceFormData & { referenceID: string },
      ) => {
        const entry = data.citationKey.trim()
          ? data
          : {
              ...data,
              citationKey: generateCitationKey(
                data,
                citationKeysExcept(data.referenceID),
              ),
            };
        const res = await api.updateBookReference(id ?? "", entry);
        if (res.err) throw new Error(res.errMsg);
        return { res, entry };
      },
      onSuccess: ({ res, entry }) => {
        const previousID = entry.referenceID;
        const savedID = res.data.referenceID;
        updateBookReferencesCache((current) => ({
          ...current,
          data: {
            ...current.data,
            entries: (current.data.entries ?? []).map((existing) =>
              existing.referenceID === previousID
                ? {
                    ...existing,
                    ...entry,
                    referenceID: savedID,
                    citationKey: res.data.citationKey,
                    // A different ID means the server made this project's own copy.
                    projectID:
                      savedID === previousID ? existing.projectID : id,
                  }
                : existing,
            ),
          },
        }));
        setEditingReference(null);
        addNotification({ type: "success", message: "Reference updated" });
      },
      onError: (error) => {
        addNotification({
          type: "error",
          message: errorMessageFrom(error, "Error updating reference"),
        });
      },
    });

  const handleAddReference = async (
    data: ReferenceFormData,
  ): Promise<boolean> => {
    if (!id) {
      addNotification({
        type: "error",
        message: "Project ID is required",
      });
      return false;
    }
    try {
      const entry = data.citationKey.trim()
        ? data
        : {
            ...data,
            citationKey: generateCitationKey(data, citationKeysExcept()),
          };
      const response = await addReference(entry);
      return !response.err;
    } catch {
      return false;
    }
  };

  const { mutateAsync: addBookPageAsReferenceMutation } = useMutation({
    mutationFn: (data: { bookID: string; pageID: string }) =>
      api.addBookPageAsReference(id ?? "", data),
    onSuccess: (response) => {
      if (response.err || !response.data) return;
      appendEntriesToCache([
        {
          referenceID: response.data.referenceID,
          citationKey: response.data.citationKey,
          entryType: "misc",
          author: response.data.author,
          title: response.data.title,
          year: response.data.year,
          url: response.data.url,
          projectID: id,
        },
      ]);
      addNotification({
        type: "success",
        message: "Reference added successfully",
      });
    },
    onError: () => {
      addNotification({ type: "error", message: "Error adding reference" });
    },
  });

  const handleAddBookPageAsReference = async (data: {
    bookID: string;
    pageID: string;
  }): Promise<boolean> => {
    if (!id) {
      addNotification({
        type: "error",
        message: "Project ID is required",
      });
      return false;
    }
    try {
      const response = await addBookPageAsReferenceMutation(data);
      return !response.err;
    } catch {
      return false;
    }
  };

  const handleAddExistingReferences = async (
    entries: ReferenceEntry[],
  ): Promise<boolean> => {
    if (!id) {
      addNotification({
        type: "error",
        message: "Project ID is required",
      });
      return false;
    }
    try {
      const response = await addExistingReferencesMutation(entries);
      return !response.err;
    } catch {
      return false;
    }
  };

  const openDeleteDialog = (entry: ReferenceEntry) => {
    setPendingDelete(entry);
  };

  const confirmDelete = () => {
    if (!pendingDelete || !id) return;
    // A reference this book owns is deleted, or handed over to another book
    // still using it; a borrowed one is only removed from this book.
    deleteReference({
      referenceID: pendingDelete.referenceID,
      deleteFromReferences: pendingDelete.projectID === id,
    });
  };

  // The last scan's citations compared with the references the book has now,
  // so adding or removing a reference updates the check and the filter.
  const citationScan = bookReferencesDetails?.data?.citationCheck;
  const citationCheck = useMemo<CitationCheckResult | null>(
    () =>
      citationScan
        ? {
            checkedAt: citationScan.checkedAt,
            ...compareCitations(citationScan.citations, entries),
          }
        : null,
    [citationScan, entries],
  );
  /** Each reference's warnings; references without any aren't in the map. */
  const referenceWarnings = useMemo(
    () => buildReferenceWarnings(citationCheck),
    [citationCheck],
  );
  // Whether a reference is cited is only known after a citation scan.
  const notCitedIDs = useMemo(
    () => new Set(citationCheck?.unused.map((ref) => ref.referenceID)),
    [citationCheck],
  );
  // Rows scroll inside the table, sized to the window below it.
  const rowsArea = useRowsMaxHeight<HTMLDivElement>();

  const selectedEntries = entries.filter(
    (entry) => rowSelection[entry.referenceID],
  );
  const activeCitationFilter: CitationFilter = citationCheck
    ? citationFilter
    : "all";
  const tableEntries =
    activeCitationFilter === "all"
      ? entries
      : entries.filter(
          (entry) =>
            notCitedIDs.has(entry.referenceID) ===
            (activeCitationFilter === "notCited"),
        );

  const columns = useMemo(
    () => [
      columnHelper.accessor("citationKey", {
        header: "Citation key",
        size: 160,
        enableSorting: true,
        enableColumnFilter: false,
      }),
      columnHelper.accessor("entryType", {
        header: "Type",
        size: 120,
        cell: (info) =>
          EntryTypes.find((type) => type.value === info.getValue())?.label ||
          info.getValue() ||
          "—",
      }),
      columnHelper.accessor("author", {
        header: "Author",
        size: 180,
        cell: (info) => info.getValue() || "—",
      }),
      columnHelper.accessor("title", {
        header: "Title",
        size: 280,
        cell: (info) => info.getValue() || "—",
      }),
      columnHelper.accessor("year", {
        header: "Year",
        size: 80,
        cell: (info) => info.getValue() || "—",
      }),
      columnHelper.display({
        id: "actions",
        header: () =>
          citationCheck ? (
            <div className="flex w-full justify-end">
              <span className="sr-only">Actions</span>
              <Select
                name="references-citation-filter"
                label="Filter by citation"
                labelClassName="sr-only"
                placeholder="Filter"
                size="sm"
                className="w-36 [&>div]:mt-0"
                options={[
                  { label: `All (${entries.length})`, value: "all" },
                  {
                    label: `Cited (${entries.length - notCitedIDs.size})`,
                    value: "cited",
                  },
                  { label: `Not cited (${notCitedIDs.size})`, value: "notCited" },
                ]}
                value={activeCitationFilter}
                onChange={(e) => {
                  setCitationFilter(e.target.value as CitationFilter);
                  setRowSelection({});
                }}
              />
            </div>
          ) : (
            <span className="block w-full text-right">Actions</span>
          ),
        size: 160,
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <Stack direction="horizontal" gap="xs" className="justify-end">
            {referenceWarnings.has(row.original.referenceID) && (
              <IconButton
                name="reference-warnings"
                title="Show warnings"
                aria-label={`Show warnings for ${row.original.citationKey}`}
                variant="outline"
                size="sm"
                icon={<IconAlertTriangle className="text-amber-600" />}
                onClick={() => setWarningReference(row.original)}
              />
            )}
            <IconButton
              name="copy-citation-key"
              title="Copy citation key to clipboard"
              aria-label={`Copy \\librecite{${row.original.citationKey}} to clipboard`}
              variant="primary"
              size="sm"
              icon={<IconCopy />}
              onClick={() => {
                navigator.clipboard
                  .writeText(`\\librecite{${row.original.citationKey}}`)
                  .then(() =>
                    addNotification({
                      type: "success",
                      message: "Citation key copied to clipboard",
                    }),
                  )
                  .catch(() =>
                    addNotification({
                      type: "error",
                      message: "Couldn't copy to the clipboard",
                    }),
                  );
              }}
            />
            <IconButton
              name="edit-reference"
              title="Edit reference"
              aria-label={`Edit ${row.original.citationKey}`}
              variant="primary"
              size="sm"
              icon={<IconPencil />}
              onClick={() => setEditingReference(row.original)}
            />
            <IconButton
              name="Delete"
              title="Remove reference"
              aria-label={`Remove ${row.original.citationKey}`}
              variant="primary"
              size="sm"
              icon={<IconTrash />}
              onClick={() => openDeleteDialog(row.original)}
            />
          </Stack>
        ),
      }),
    ],
    [referenceWarnings, citationCheck, activeCitationFilter, notCitedIDs, entries.length],
  );


  const scopeSummary = describeScope({
    scopeMode: bookReferencesDetails?.data?.scopeMode,
    scopeGroups: bookReferencesDetails?.data?.scopeGroups,
    displayLocation,
    pageTitle,
  });

  return (
    <Stack direction="vertical" gap="lg" className="px-4 py-8 md:px-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Stack direction="vertical" gap="xs">
          <Heading level={2}>Reference Manager</Heading>
          {!isLoadingProject && project?.title && (
            <Breadcrumb className="ml-1">
              <Breadcrumb.Item href="/projects">Projects</Breadcrumb.Item>
              <Breadcrumb.Item href={`/projects/${id}`}>
                {project?.title}
              </Breadcrumb.Item>
              <Breadcrumb.Item isCurrent>Reference Manager</Breadcrumb.Item>
            </Breadcrumb>
          )}
        </Stack>
        {projectBookURL && (
          <Button
            as="a"
            href={projectBookURL}
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
            size="sm"
            icon={<IconExternalLink size={16} aria-hidden="true" />}
            iconPosition="right"
          >
            Project Link
            <span className="sr-only"> (opens in a new tab)</span>
          </Button>
        )}
      </div>

      {isErrorProject && (
        <Alert variant="error" message="Error loading project" />
      )}

      {!isLoadingProject && !isErrorProject && (
        <Card variant="elevated">
          <Card.Body>
            <section aria-labelledby="citation-settings-heading">
              <Heading
                level={3}
                id="citation-settings-heading"
                className="mb-4 text-lg"
              >
                Citation settings
              </Heading>
              {/* One grid so the labels share a row and the controls share a
                  row; plain elements avoid Semantic UI's paragraph margins. */}
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-x-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <label
                  htmlFor="bookReferencesFormat"
                  className="block text-base/6 font-medium text-gray-700"
                >
                  Format
                </label>
                <span
                  id="citation-scope-summary"
                  title={scopeSummary}
                  className="block min-w-0 truncate text-right text-base/6 font-medium text-gray-700"
                >
                  {scopeSummary}
                </span>
                <Select
                  className="w-full"
                  name="bookReferencesFormat"
                  label=""
                  labelClassName="sr-only"
                  options={ReferenceFormatTypes.map((format) => ({
                    label: format,
                    value: format,
                  }))}
                  placeholder="Select a format"
                  value={referenceFormat ?? ""}
                  disabled={isUpdatingFormat || !id}
                  onChange={(e) => {
                    const format = e.target.value as ReferenceFormatType;
                    if (!format || !id || format === referenceFormat) return;
                    // Format only: the scope (and the display fields
                    // derived from it) stays as saved.
                    updateFormat({
                      format,
                      displayLocation: displayLocation ?? "endOfPage",
                      pageTitle: pageTitle ?? "",
                    });
                  }}
                />
                {/* The Select puts its field 6px below its (hidden) label, so
                    the same top padding here keeps the button level with it,
                    and stretching makes it exactly the field's height. */}
                <div className="flex justify-end pt-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-full"
                    icon={<IconListTree size={16} aria-hidden="true" />}
                    iconPosition="left"
                    aria-describedby="citation-scope-summary"
                    disabled={!id}
                    onClick={() => setShowConfigureModal(true)}
                  >
                    Scope
                  </Button>
                </div>
              </div>
              {!isLoadingBookReferencesFormat && !referenceFormat && (
                <Text size="sm" className="mt-4 block text-neutral-600">
                  This book doesn't have references set up yet. Choose a
                  format to start adding references.
                </Text>
              )}
            </section>
          </Card.Body>
        </Card>
      )}

      {referenceFormat && citationCheck && citationCheck.missing.length > 0 && (
        <CitationCheck
          missing={citationCheck.missing}
          checkedAt={citationCheck.checkedAt}
          library={project?.libreLibrary}
        />
      )}

      {isLoadingBookReferencesFormat ? (
        <Spinner text="Loading references…" />
      ) : referenceFormat ? (
        <section
          aria-labelledby="references-heading"
          className="flex flex-col gap-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Heading level={3} id="references-heading" className="text-lg">
              References ({entries.length})
            </Heading>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPopulateModal(true)}
                disabled={isUpdatingFormat || !id}
              >
                Scan Citations
              </Button>
              <Button
                variant="primary"
                icon={<IconPlus size={16} aria-hidden="true" />}
                iconPosition="left"
                onClick={() => setShowAddContentModal(true)}
                disabled={isUpdatingFormat || !id}
              >
                Add Reference
              </Button>
            </div>
          </div>
          {entries.length === 0 ? (
            <Text size="sm" className="text-neutral-500">
              No references yet. Use Add Reference to create the first one.
            </Text>
          ) : (
            <div ref={rowsArea.ref}>
            <DataTable<ReferenceEntry>
              data={tableEntries}
              columns={columns}
              aria-label="References"
              stickyHeader
              striped
              bordered
              density="compact"
              maxHeight={"calc(60vh)"}
              enableSorting
              enableGlobalFilter
              enableColumnFilters
              enableRowSelection
              tableOptions={{
                getRowId: (row) => row.referenceID,
                state: { rowSelection },
                onRowSelectionChange: (updater) =>
                  setRowSelection((current) =>
                    typeof updater === "function" ? updater(current) : updater,
                  ),
              }}
              toolbar={{
                globalSearch: true,
                globalSearchPlaceholder: "Search references…",
                end:
                  selectedEntries.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Text size="sm" role="status" className="text-neutral-700">
                        {selectedEntries.length} selected
                      </Text>
                      <Button
                        variant="destructive"
                        size="sm"
                        icon={<IconTrash size={16} aria-hidden="true" />}
                        iconPosition="left"
                        onClick={() => setShowBulkRemove(true)}
                      >
                        Remove selected
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRowSelection({})}
                      >
                        Clear
                      </Button>
                    </div>
                  ) : undefined,
              }}
              emptyState="No references match your search."
              classNames={{
                table: "table-fixed w-full",
                cell: "!whitespace-normal min-w-0 break-words",
              }}
            />
            </div>
          )}
        </section>
      ) : null}
      <Configure
        open={showConfigureModal}
        onClose={() => setShowConfigureModal(false)}
        format={referenceFormat}
        displayLocation={displayLocation}
        pageTitle={pageTitle}
        scopeMode={bookReferencesDetails?.data?.scopeMode}
        scopeGroups={bookReferencesDetails?.data?.scopeGroups}
        backmatterPageID={bookReferencesDetails?.data?.backmatterPageID}
        onSubmit={async (settings) => {
          await saveScope(settings);
        }}
        onResetScope={async () => {
          await resetScope();
        }}
        submitDisabled={isUpdatingFormat || isSavingScope || !id}
        addNotification={addNotification}
        bookToc={bookToc?.toc ?? undefined}
      />
      <AddContent
        open={showAddContentModal}
        onClose={() => setShowAddContentModal(false)}
        onAdd={handleAddReference}
        addExistingReferences={handleAddExistingReferences}
        onAddBookPageAsReference={handleAddBookPageAsReference}
        referenceFormat={referenceFormat}
        projectID={id ?? ""}
      />
      <BulkRemoveModal
        open={showBulkRemove}
        references={selectedEntries}
        citedIDs={
          citationCheck
            ? new Set(
                selectedEntries
                  .filter((entry) => !notCitedIDs.has(entry.referenceID))
                  .map((entry) => entry.referenceID),
              )
            : undefined
        }
        removing={isRemovingReferences}
        onCancel={() => setShowBulkRemove(false)}
        onConfirm={() =>
          removeReferences({
            referenceIDs: selectedEntries.map((entry) => entry.referenceID),
            // The server applies this only to references this book owns.
            deleteFromReferences: true,
          })
        }
      />
      <ReferenceWarningsModal
        reference={warningReference}
        warnings={
          warningReference
            ? (referenceWarnings.get(warningReference.referenceID) ?? [])
            : []
        }
        onClose={() => setWarningReference(null)}
      />
      <EditReference
        reference={editingReference}
        projectID={id ?? ""}
        referenceFormat={referenceFormat}
        saving={isUpdatingReference}
        onClose={() => setEditingReference(null)}
        onSave={(data) => updateReference(data)}
      />
      <Populate
        open={showPopulateModal}
        onClose={() => setShowPopulateModal(false)}
        projectID={id ?? ""}
        job={populateJob}
      />

      <BulkRemoveModal
        open={!!pendingDelete}
        references={pendingDelete ? [pendingDelete] : []}
        citedIDs={
          citationCheck && pendingDelete
            ? new Set(
                notCitedIDs.has(pendingDelete.referenceID)
                  ? []
                  : [pendingDelete.referenceID],
              )
            : undefined
        }
        removing={isDeleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </Stack>
  );
};

export default ReferenceManager;
