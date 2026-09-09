import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouteMatch } from "react-router-dom";
import PageNotFound from "../../../components/util/PageNotFound";

import { useMutation, useQuery } from "@tanstack/react-query";
import { TableOfContents } from "../../../types/Book";

import api from "../../../api";
import {
  Breadcrumb,
  Button,
  Card,
  Grid,
  IconButton,
  Link,
  Stack,
} from "@libretexts/davis-react";
import {
  IconFoldDown,
  IconFoldUp,
  IconPlus,
  IconTableImport,
  IconTableExport,
  IconFileTypeCsv,
  IconSettings,
} from "@tabler/icons-react";
import TOCTreeView from "./TOCTreeView";
import GlossaryForm from "./manager";
import "./Glossary.css";
import {
  downloadCsv,
  extractLibraryFromURL,
  filterGlossaryEntriesForPage,
  findTocNode,
  getPageAncestors,
  glossaryEntriesToCsv,
  slugifyForFilename,
} from "./services";
import GlossaryList from "./GlossaryList";
import { GlossaryEntry } from "./model";
import AddPageDialog from "./AddPageDialog";
import GlossaryCsvImportDialog from "./GlossaryCsvImportDialog";
import GlossaryConfigModal from "./GlossaryConfigModal";
import { useNotifications } from "../../../context/NotificationContext";
import { useModals } from "../../../context/ModalContext";
import useProject from "../../../hooks/useProject";

const ADD_TERM_MODAL_ID = "glossary-add-term-modal";
const CSV_IMPORT_MODAL_ID = "glossary-csv-import-modal";
const CONFIG_MODAL_ID = "glossary-config-modal";
const ADD_PAGE_MODAL_ID = "glossary-add-page-modal";

type GlossaryResourceType = "book" | "project";

const GlossaryManager: React.FC = () => {
  const { addNotification } = useNotifications();
  const { openModal, closeModal } = useModals();
  const { id } = useParams<{ id: string }>();
  const projectMatch = useRouteMatch({
    path: "/glossary/project/:id",
    exact: true,
  });
  const bookMatch = useRouteMatch({ path: "/glossary/book/:id", exact: true });

  const [selectedTerms, setSelectedTerms] = useState<GlossaryEntry[]>([]);

  let resourceType: GlossaryResourceType | null = null;
  if (projectMatch) {
    resourceType = "project";
  } else if (bookMatch) {
    resourceType = "book";
  }

  const { project, isLoading: isLoadingProject } =
    resourceType === "project"
      ? useProject(id!)
      : { project: undefined, isLoading: false };

  const { data: bookTOC, isLoading: loadingTOC } = useQuery<TableOfContents>({
    queryKey: ["book-toc", id, resourceType],
    queryFn: async () => {
      const res = await (resourceType === "book"
        ? api.getBookTOC(id!)
        : api.getProjectTOC(id!));
      return res.data?.toc;
    },
    enabled: !!id && !!resourceType,
  });

  const library = useMemo(
    () => extractLibraryFromURL(bookTOC?.url ?? "") ?? "",
    [bookTOC?.url],
  );
  const coverID = useMemo(() => bookTOC?.id ?? "", [bookTOC?.id]);

  const [tocExpandAll, setTocExpandAll] = useState(false);

  const [glossaryEntries, setGlossaryEntries] = useState<GlossaryEntry[]>([]);
  const {
    // data: glossaryEntries = [],
    isLoading: loadingGlossary,
    isError: glossaryFetchFailed,
    error: glossaryError,
    refetch: refetchGlossary,
  } = useQuery<GlossaryEntry[]>({
    queryKey: ["book-glossary", library, coverID],
    queryFn: async () => {
      const res = await api.getBookGlossary(library, coverID);
      if (res.err) {
        throw new Error(res.errMsg ?? "Failed to load glossary.");
      }
      setGlossaryEntries(res.data ?? []);
      return res.data ?? [];
    },
    enabled: !!library && !!coverID,
  });

  /** Page ids with at least one glossary term — gates the TOC row export icon. */
  const pageIdsWithTerms = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of glossaryEntries) {
      for (const page of entry.pages) {
        ids.add(page.pageID);
      }
    }
    return ids;
  }, [glossaryEntries]);

  if (!resourceType) {
    return <PageNotFound />;
  }

  const handleAddTermsToPages = async (
    pageIds: string[],
    termUsageIds: string[],
  ) => {
    const res = await api.addGlossaryTermsToPages({
      pageIds,
      usageIds: termUsageIds,
      library: library,
      coverID: coverID,
    });

    if (res.err) {
      addNotification({
        message: res.errMsg ?? "Failed to add glossary terms to pages.",
        type: "error",
      });
      return;
    }
    addNotification({
      message: "Glossary terms added to pages successfully",
      type: "success",
    });
    closeModal(ADD_PAGE_MODAL_ID);
    refetchGlossary();
  };

  const glossaryID = useMemo(() => {
    if (!bookTOC) return undefined;
    return findTocNode(
      bookTOC,
      (node) =>
        node.title === "Glossary" &&
        node.url.endsWith("zz%3A_Back_Matter/20%3A_Glossary"),
    )?.id;
  }, [bookTOC]);

  const importGlossaryTermsMutation = useMutation({
    mutationFn: async (vars?: {
      auxGlossaryID?: string;
      auxGlossaryParentID?: string;
    }) => {
      if (!glossaryID) {
        throw new Error("No glossary ID found.");
      }
      const res = await api.importGlossaryTermsFromExistingGlossary({
        library: library,
        coverID: coverID,
        glossaryID: glossaryID,
        auxGlossaryID: vars?.auxGlossaryID,
        auxGlossaryParentID: vars?.auxGlossaryParentID,
      });
      if (res.err) {
        throw new Error(
          res.errMsg ??
            "Failed to import glossary terms from existing glossary.",
        );
      }
    },
    onSuccess: () => {
      addNotification({
        message: "Glossary terms imported from existing glossary successfully",
        type: "success",
      });
      refetchGlossary();
    },
    onError: (error) => {
      addNotification({
        message:
          error instanceof Error
            ? error.message
            : "Failed to import glossary terms from existing glossary.",
        type: "error",
      });
    },
  });

  // Each modal is opened by calling these directly from an event handler
  // (button click, TOC node click) instead of reacting to a piece of state
  // via `useEffect` — the modal's content is a plain function argument, so
  // there's nothing to keep "in sync" after the fact.
  const openAddTermModal = (usageID: string | null) => {
    openModal(
      <GlossaryForm
        open={true}
        glossaryID={glossaryID}
        onClose={() => closeModal(ADD_TERM_MODAL_ID)}
        coverID={coverID}
        bookID={!projectMatch ? (id ?? "") : ""}
        library={library}
        onTermCreated={() => {
          if (coverID && library) {
            refetchGlossary();
          }
        }}
        addNotification={addNotification}
        editingTerm={
          usageID
            ? (glossaryEntries.find((term) => term.usageID === usageID) ??
              null)
            : null
        }
        existingTerms={glossaryEntries}
      />,
      ADD_TERM_MODAL_ID,
    );
  };

  const openAddPageModal = (pageIds: string[]) => {
    if (!bookTOC) return;
    openModal(
      <AddPageDialog
        open={true}
        onClose={() => closeModal(ADD_PAGE_MODAL_ID)}
        initialPageIds={pageIds}
        selectedTerms={selectedTerms}
        setSelectedTerms={setSelectedTerms}
        toc={bookTOC}
        onSubmit={handleAddTermsToPages}
      />,
      ADD_PAGE_MODAL_ID,
    );
  };

  const openCsvImportModal = () => {
    openModal(
      <GlossaryCsvImportDialog
        open={true}
        onClose={() => closeModal(CSV_IMPORT_MODAL_ID)}
        library={library}
        coverID={coverID}
        glossaryID={glossaryID}
        addNotification={addNotification}
        onImported={() => refetchGlossary()}
      />,
      CSV_IMPORT_MODAL_ID,
    );
  };

  const handleExportBookCsv = () => {
    if (glossaryEntries.length === 0) {
      addNotification({
        message: "There are no glossary terms to export yet.",
        type: "info",
      });
      return;
    }
    downloadCsv(
      `${slugifyForFilename(bookTOC?.title ?? "glossary")}-glossary.csv`,
      glossaryEntriesToCsv(glossaryEntries),
    );
  };

  const handleExportPageCsv = (pageId: string, pageTitle: string) => {
    const pageEntries = filterGlossaryEntriesForPage(glossaryEntries, pageId);
    if (pageEntries.length === 0) {
      addNotification({
        message: `“${pageTitle}” has no glossary terms to export.`,
        type: "info",
      });
      return;
    }
    downloadCsv(
      `${slugifyForFilename(pageTitle)}-glossary.csv`,
      glossaryEntriesToCsv(pageEntries),
    );
  };

  const openConfigModal = () => {
    if (!bookTOC) return;
    openModal(
      <GlossaryConfigModal
        open={true}
        onClose={() => closeModal(CONFIG_MODAL_ID)}
        library={library}
        coverID={coverID}
        bookTOC={bookTOC}
        glossaryPageId={glossaryID}
        addNotification={addNotification}
      />,
      CONFIG_MODAL_ID,
    );
  };

  return (
    <Grid cols={3} gap="lg" className="glossary-page px-4 py-6">
      <div className="glossary-page__column commons-glossary col-span-2">
        <div className="glossary-page__column-header">
          <Stack direction="horizontal" align="center" justify="between">
            <Stack direction="vertical"  gap="sm">
              <h4 className="text-2xl font-semibold">Book Glossary</h4>
              {resourceType === "project" &&
                !isLoadingProject &&
                project?.title && (
                  <Breadcrumb className="ml-1">
                    <Breadcrumb.Item href="/projects">Projects</Breadcrumb.Item>
                    <Breadcrumb.Item href={`/projects/${id}`}>
                      {project?.title}
                    </Breadcrumb.Item>
                    <Breadcrumb.Item isCurrent>Glossary</Breadcrumb.Item>
                  </Breadcrumb>
                )}
            </Stack>
            <Stack direction="horizontal" gap="sm">
              <Button
                size="sm"
                onClick={() => openAddTermModal(null)}
                icon={<IconPlus size={16} />}
                iconPosition="left"
              >
                Add Term
              </Button>
              <Button
                size="sm"
                onClick={openCsvImportModal}
                icon={<IconFileTypeCsv size={16} />}
                iconPosition="left"
              >
                Import CSV
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={openConfigModal}
                disabled={!bookTOC}
                icon={<IconSettings size={16} />}
                iconPosition="left"
              >
                Configure Glossary
              </Button>
              {glossaryID && (
                <Button
                  size="sm"
                  onClick={() => importGlossaryTermsMutation.mutate(undefined)}
                  loading={importGlossaryTermsMutation.isLoading}
                  disabled={importGlossaryTermsMutation.isLoading}
                  icon={<IconTableImport size={16} />}
                  iconPosition="left"
                >
                  Import from existing glossary
                </Button>
              )}
            </Stack>
          </Stack>
          <p className="text-sm text-neutral-600"></p>
        </div>
        <div className="glossary-page__panel-scroll">
          <GlossaryList
            entries={glossaryEntries}
            isLoading={loadingGlossary}
            toc={bookTOC}
            library={library}
            coverID={coverID}
            error={
              glossaryFetchFailed
                ? ((glossaryError as Error)?.message ??
                  "Failed to load glossary.")
                : null
            }
            selectedTerms={selectedTerms}
            setSelectedTerms={setSelectedTerms}
            addNotification={addNotification}
            refetchGlossary={refetchGlossary}
            setEditingUsageID={openAddTermModal}
            bookTOC={bookTOC!}
          />
        </div>
      </div>
      <div className="glossary-page__column commons-glossary">
        <div className="glossary-page__column-header">
          <Stack direction="horizontal" align="center" justify="between">
            <h4 className="text-2xl font-semibold">Table of Contents</h4>
            {bookTOC && bookTOC.children.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                icon={
                  tocExpandAll ? (
                    <IconFoldUp size={16} />
                  ) : (
                    <IconFoldDown size={16} />
                  )
                }
                iconPosition="left"
                onClick={() => setTocExpandAll((v) => !v)}
              >
                {tocExpandAll ? "Collapse All" : "Expand All"}
              </Button>
            )}
          </Stack>
          <div className="text-sm text-neutral-600">
            {bookTOC && (
              <Stack direction="horizontal" align="center" gap="xs">
                <Link href={bookTOC.url} external={true} showExternalIcon={true}>
                  {bookTOC.title}
                </Link>
                <IconButton
                  size="sm"
                  variant="ghost"
                  icon={<IconTableExport size={16} />}
                  title="Export whole-book glossary as CSV"
                  aria-label="Export whole-book glossary as CSV"
                  onClick={handleExportBookCsv}
                />
              </Stack>
            )}
          </div>
        </div>
        <Card padding="sm" className="glossary-page__card">
          {bookTOC && bookTOC.children.length > 0 ? (
            <TOCTreeView
              items={bookTOC.children}
              expandAll={tocExpandAll}
              storageKey={id ? `glossary-toc-expanded:${resourceType}:${id}` : undefined}
              onNodeClick={(nodeId) => openAddPageModal([nodeId])}
              bookId={bookTOC?.id}
              onImportGlossary={(auxGlossaryID, auxGlossaryParentID) =>
                importGlossaryTermsMutation.mutate({
                  auxGlossaryID,
                  auxGlossaryParentID,
                })
              }
              importingGlossary={importGlossaryTermsMutation.isLoading}
              onExportPageCsv={handleExportPageCsv}
              pageIdsWithTerms={pageIdsWithTerms}
            />
          ) : (
            <p>
              <em>Table of contents unavailable.</em>
            </p>
          )}
        </Card>
      </div>
    </Grid>
  );
};

export default GlossaryManager;
