import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  Heading,
  IconButton,
  Modal,
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

const columnHelper = createColumnHelper<ReferenceEntry>();
const BOOK_REFERENCES_QUERY_KEY = "bookReferencesFormat";

/** The server's `errMsg` (e.g. "Citation key … is already used"), else `fallback`. */
function errorMessageFrom(error: unknown, fallback: string): string {
  const serverMessage = (
    error as { response?: { data?: { errMsg?: string } } }
  )?.response?.data?.errMsg;
  return (
    serverMessage || (error instanceof Error && error.message) || fallback
  );
}

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
  const [deleteFromReferences, setDeleteFromReferences] = useState(false);
  const [editingReference, setEditingReference] =
    useState<ReferenceEntry | null>(null);

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

  const populateJob = hasPopulateJobData(populateDetails?.data)
    ? populateDetails.data
    : null;
  const hasPopulateJob = !!populateJob;

  useEffect(() => {
    if (hasPopulateJob) {
      setShowPopulateModal(true);
    }
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
      appendEntriesToCache(entries);
      addNotification({
        type: "success",
        message: "References added successfully",
      });
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
      setDeleteFromReferences(false);
      addNotification({
        type: "success",
        message: variables.deleteFromReferences
          ? "Reference permanently deleted"
          : "Reference removed from project",
      });
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
    setDeleteFromReferences(false);
  };

  const confirmDelete = () => {
    if (!pendingDelete || !id) return;
    const isOwned = pendingDelete.projectID === id;
    deleteReference({
      referenceID: pendingDelete.referenceID,
      deleteFromReferences: isOwned ? deleteFromReferences : false,
    });
  };

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
        header: () => <span className="block w-full text-right">Actions</span>,
        size: 112,
        enableSorting: false,
        enableColumnFilter: false,
        cell: ({ row }) => (
          <Stack direction="horizontal" gap="xs" className="justify-end">
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
    [],
  );

  const pendingIsOwned = !!pendingDelete && pendingDelete.projectID === id;

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
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPopulateModal(true)}
                disabled={isUpdatingFormat || !id}
              >
                Populate book
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
            <DataTable<ReferenceEntry>
              data={entries}
              columns={columns}
              aria-label="References"
              stickyHeader
              striped
              bordered
              density="compact"
              maxHeight="calc(100vh - 420px)"
              enableSorting
              enableGlobalFilter
              enableColumnFilters
              toolbar={{
                globalSearch: true,
                globalSearchPlaceholder: "Search references…",
              }}
              emptyState="No references match your search."
              classNames={{
                table: "table-fixed w-full",
                cell: "!whitespace-normal min-w-0 break-words",
              }}
            />
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

      <Modal
        open={!!pendingDelete}
        onClose={() => {
          if (isDeleting) return;
          setPendingDelete(null);
          setDeleteFromReferences(false);
        }}
        size="sm"
      >
        <Modal.Header>
          <Modal.Title>Remove reference</Modal.Title>
          <Modal.Close aria-label="Close" />
        </Modal.Header>
        <Modal.Body>
          <Stack direction="vertical" gap="md">
            <Text size="sm">
              Remove{" "}
              <span className="font-semibold">
                {pendingDelete?.citationKey}
              </span>{" "}
              from this project?
            </Text>
            {pendingIsOwned && (
              <Checkbox
                name="deleteFromReferences"
                label="Also permanently delete this reference (owned by this project)"
                checked={deleteFromReferences}
                onChange={(checked) =>
                  setDeleteFromReferences(checked === true)
                }
              />
            )}
          </Stack>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline"
            onClick={() => {
              setPendingDelete(null);
              setDeleteFromReferences(false);
            }}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirmDelete}
            loading={isDeleting}
            disabled={isDeleting}
          >
            Remove
          </Button>
        </Modal.Footer>
      </Modal>
    </Stack>
  );
};

export default ReferenceManager;
