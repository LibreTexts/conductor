import React, { useMemo, useState } from "react";
import { useParams, useRouteMatch } from "react-router-dom";
import PageNotFound from "../../../components/util/PageNotFound";

import { useQuery } from "@tanstack/react-query";
import { TableOfContents } from "../../../types/Book";

import api from "../../../api";
import { Button, Card, Grid, Link, Stack } from "@libretexts/davis-react";
import { IconPlus } from "@tabler/icons-react";
import TOCTreeView from "./TOCTreeView";
import GlossaryForm from "./manager";
import "./Glossary.css";
import { extractLibraryFromURL, findTocNode, getPageAncestors } from "./services";
import GlossaryList from "./GlossaryList";
import { GlossaryEntry } from "./model";
import AddPageDialog from "./AddPageDialog";
import { useNotifications } from "../../../context/NotificationContext";

type GlossaryResourceType = "book" | "project";

const GlossaryManager: React.FC = () => {
  const { addNotification } = useNotifications();
  const { id } = useParams<{ id: string }>();
  const projectMatch = useRouteMatch({
    path: "/glossary/:id/project",
    exact: true,
  });
  const bookMatch = useRouteMatch({ path: "/glossary/:id/book", exact: true });



  const [selectedTerms, setSelectedTerms] = useState<GlossaryEntry[]>([]);

  let resourceType: GlossaryResourceType | null = null;
  if (projectMatch) {
    resourceType = "project";
  } else if (bookMatch) {
    resourceType = "book";
  }

 

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

  const [glossaryEntries, setGlossaryEntries] = useState<GlossaryEntry[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddPageModal, setShowAddPageModal] = useState(false);
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
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const onNodeClick = (nodeId: string) => {
    var pageIds: string[] =[];
    // show nodeId and its parents pageIds
    pageIds = getPageAncestors(bookTOC!, nodeId);
    setSelectedPageIds([...pageIds]);
    setShowAddPageModal(true);
  }
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
    setShowAddPageModal(false);
    setSelectedPageIds([]);
    refetchGlossary();
  }

  const glossaryID = useMemo(() => {
    if (!bookTOC) return undefined;
    return findTocNode(
      bookTOC,
      (node) =>
        node.title === "Glossary" &&
        node.url.endsWith("zz%3A_Back_Matter/20%3A_Glossary"),
    )?.id;
  }, [bookTOC]);
  
  return (
    <Grid cols={2} gap="lg" className="glossary-page px-4 py-6">
      <div className="glossary-page__column commons-glossary">
        <div className="glossary-page__column-header">
          <Stack direction="horizontal" align="center" justify="between">
            <h4 className="text-2xl font-semibold">Book Glossary</h4>
            <Button
              size="sm"
              onClick={() => setShowAddModal(true)}
              icon={<IconPlus size={16} />}
              iconPosition="left"
            >
              Add Term 
            </Button>
          </Stack>
          <p className="text-sm text-neutral-600">
           
          </p>
        </div>
        <GlossaryForm
          open={showAddModal}
          glossaryID={glossaryID}
          onClose={() => setShowAddModal(false)}
          selectedNode={null}
          coverID={coverID}
          bookID={!projectMatch ? (id ?? "") : ""}
          library={library}
          onTermCreated={() => {
            if (coverID && library) {
              refetchGlossary();
            }
          }}
          addNotification={addNotification}
        />
        <div className="glossary-page__panel-scroll">
          <GlossaryList
            entries={glossaryEntries}
            isLoading={loadingGlossary}
            toc={bookTOC}
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
          />
        </div>
      </div>
      <div className="glossary-page__column commons-glossary">
        <div className="glossary-page__column-header">
          <h4 className="text-2xl font-semibold">Table of Contents</h4>
          <p className="text-sm text-neutral-600">
            {bookTOC && (
              <Link href={bookTOC.url} external={true} showExternalIcon={true}>
                {bookTOC.title}
              </Link>
            )}
          </p>
        </div>
        <Card padding="sm" className="glossary-page__card">
          <Stack
            direction="horizontal"
            gap="sm"
            align="center"
            justify="between"
            className="shrink-0"
          ></Stack>
          {bookTOC && bookTOC.children.length > 0 ? (
            <TOCTreeView
              items={bookTOC.children}
              onNodeClick={onNodeClick}
             
            />
          ) : (
            <p>
              <em>Table of contents unavailable.</em>
            </p>
          )}
        </Card>
      </div>
      <AddPageDialog
        open={showAddPageModal}
        onClose={() => setShowAddPageModal(false)}
        pageIds={ selectedPageIds}
        selectedTerms={selectedTerms}
        toc={bookTOC!}
        setSelectedPageIds={setSelectedPageIds}
        handleAddTermsToPages={handleAddTermsToPages}
      />
    </Grid>
  );
};

export default GlossaryManager;
