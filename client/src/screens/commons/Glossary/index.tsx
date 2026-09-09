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
  Link,
  Stack,
} from "@libretexts/davis-react";
import {
  IconFoldDown,
  IconFoldUp,
  IconPlus,
  IconTableImport,
  IconFileTypeCsv,
  IconSettings,
} from "@tabler/icons-react";
import TOCTreeView from "./TOCTreeView";
import GlossaryForm from "./manager";
import "./Glossary.css";
import {
  extractLibraryFromURL,
  findTocNode,
  getPageAncestors,
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

  // `undefined` = Add/Edit Term modal closed; `null` = open for a new term;
  // a usageID = open editing that term. Folding "is it open" into this
  // value (rather than a separate boolean) is what lets the modal's
  // presence be derived instead of tracked twice.
  const [editingUsageID, setEditingUsageID] = useState<
    string | null | undefined
  >(undefined);
  const [tocExpandAll, setTocExpandAll] = useState(false);

  const handleEditUsageID = (usageID: string) => {
    setEditingUsageID(usageID);
  };

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

  if (!resourceType) {
    return <PageNotFound />;
  }
  // An empty array doubles as "Add Page modal closed" — there is never a
  // reason to show it with nothing selected.
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const onNodeClick = (nodeId: string) => {
    setSelectedPageIds([nodeId]);
  };
  const handleAddTermsToPages = async () => {
    const res = await api.addGlossaryTermsToPages({
      pageIds: selectedPageIds,
      usageIds: selectedTerms.map((term) => term.usageID),
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
    setSelectedPageIds([]);
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

  // `openModal`/`closeModal` are recreated on every render by ModalsProvider,
  // so they're deliberately left out of these dependency arrays — including
  // them would re-fire the effect on every modal open/close anywhere in the
  // app. Each effect re-registers its modal's content whenever the data it
  // depends on changes, which is what keeps content fresh while the modal
  // stays open (e.g. re-matching an existing term while typing, or removing
  // a page badge). Whether the modal is open is derived from the triggering
  // state itself (`editingUsageID`/`selectedPageIds`) rather than a
  // separate boolean.

  useEffect(() => {
    if (editingUsageID === undefined) {
      closeModal(ADD_TERM_MODAL_ID);
      return;
    }
    openModal(
      <GlossaryForm
        open={true}
        glossaryID={glossaryID}
        onClose={() => setEditingUsageID(undefined)}
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
          glossaryEntries.find((term) => term.usageID === editingUsageID) ??
          null
        }
        setEditingUsageID={setEditingUsageID}
        existingTerms={glossaryEntries}
      />,
      ADD_TERM_MODAL_ID,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editingUsageID,
    glossaryEntries,
    glossaryID,
    coverID,
    library,
    id,
    projectMatch,
    addNotification,
  ]);

  useEffect(() => {
    if (selectedPageIds.length === 0 || !bookTOC) {
      closeModal(ADD_PAGE_MODAL_ID);
      return;
    }
    openModal(
      <AddPageDialog
        open={true}
        onClose={() => setSelectedPageIds([])}
        pageIds={selectedPageIds}
        selectedTerms={selectedTerms}
        toc={bookTOC}
        setSelectedPageIds={setSelectedPageIds}
        handleAddTermsToPages={handleAddTermsToPages}
        editingUsageID={editingUsageID ?? null}
        setEditingUsageID={handleEditUsageID}
        glossaryEntries={glossaryEntries}
      />,
      ADD_PAGE_MODAL_ID,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedPageIds,
    selectedTerms,
    bookTOC,
    editingUsageID,
    glossaryEntries,
  ]);

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
                onClick={() => setEditingUsageID(null)}
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
            setEditingUsageID={handleEditUsageID}
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
          <p className="text-sm text-neutral-600">
            {bookTOC && (
              <Link href={bookTOC.url} external={true} showExternalIcon={true}>
                {bookTOC.title}
              </Link>
            )}
          </p>
        </div>
        <Card padding="sm" className="glossary-page__card">
          {bookTOC && bookTOC.children.length > 0 ? (
            <TOCTreeView
              items={bookTOC.children}
              expandAll={tocExpandAll}
              storageKey={id ? `glossary-toc-expanded:${resourceType}:${id}` : undefined}
              onNodeClick={onNodeClick}
              bookId={bookTOC?.id}
              onImportGlossary={(auxGlossaryID, auxGlossaryParentID) =>
                importGlossaryTermsMutation.mutate({
                  auxGlossaryID,
                  auxGlossaryParentID,
                })
              }
              importingGlossary={importGlossaryTermsMutation.isLoading}
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
