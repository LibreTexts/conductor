import { List, Grid, Header, Segment, Button, Icon } from "semantic-ui-react";
import { Link } from "react-router-dom-v5-compat";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../api";
import { Project, TableOfContents } from "../../../types";
import { useModals } from "../../../context/ModalContext";
import EditMetadataModal from "../../../components/projects/TextbookCuration/EditMetadataModal";
import { useState } from "react";
import ConfirmAISummariesModal from "../../../components/projects/TextbookCuration/ConfirmAISummariesModal";

type WithUIState = Omit<TableOfContents, "children"> & {
  expanded: boolean;
  isRoot: boolean;
  children: WithUIState[];
};

const TextbookCuration = () => {
  const { id: projectID } = useParams<{ id: string }>();
  const { openModal } = useModals();
  const queryClient = useQueryClient();
  const [bookTitle, setBookTitle] = useState<string>("");
  const { data: projectData, isLoading: projectLoading } = useQuery<
    Project | undefined
  >({
    queryKey: ["project", projectID],
    queryFn: async () => {
      if (!projectID) return undefined;
      const res = await api.getProject(projectID);
      if (res.data.err) {
        throw res.data.errMsg;
      }

      return res.data.project;
    },
    enabled: !!projectID,
  });

  const { data, isLoading } = useQuery<WithUIState[]>({
    queryKey: ["textbook-structure", projectID],
    queryFn: async () => {
      if (!projectData?.libreLibrary || !projectData.libreCoverID) {
        return [] as WithUIState[];
      }

      const res = await api.getBookTOC(
        `${projectData.libreLibrary}-${projectData.libreCoverID}`
      );
      setBookTitle(res.data?.toc.title || "No Title");
      const content = res.data?.toc?.children; // Skip the first level of the TOC

      // Recursively add expanded state to each node
      const addExpandedState = (
        nodes: TableOfContents[],
        isRoot = false
      ): WithUIState[] => {
        return nodes.map((node) => {
          return {
            ...node,
            isRoot,
            expanded: false,
            children: addExpandedState(node.children),
          };
        });
      };

      const withUIState = addExpandedState(content, true);

      return withUIState;
    },
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled:
      !!projectData && !!projectData.libreLibrary && !!projectData.libreCoverID,
  });

  const handleToggle = (id: string) => {
    const toggleNode = (nodes: WithUIState[]): WithUIState[] => {
      return nodes.map((node) => {
        if (node.id === id) {
          return { ...node, expanded: !node.expanded };
        }
        return { ...node, children: toggleNode(node.children) };
      });
    };

    const updatedData = toggleNode(data!);
    queryClient.setQueryData(["textbook-structure", projectID], updatedData);
  };

  const handleOpenEditModal = (
    library: string,
    pageID: string,
    title: string
  ) => {
    if (!projectData?.libreCoverID || !projectData?.libreLibrary) {
      return;
    }

    openModal(
      <EditMetadataModal
        library={library}
        pageID={pageID}
        title={title}
        coverPageID={`${projectData?.libreLibrary}-${projectData?.libreCoverID}`}
      />
    );
  };

  const handleOpenBulkSummariesModal = () => {
    if (!projectData?.libreLibrary || !projectData?.libreCoverID) {
      return;
    }

    openModal(
      <ConfirmAISummariesModal
        library={projectData?.libreLibrary}
        pageID={projectData?.libreCoverID}
      />
    );
  };

  const renderNodes = (nodes: WithUIState[], indentLevel = 1) => {
    if (!projectData?.libreLibrary || !projectData?.libreCoverID) {
      return (
        <div>
          <p>
            This project does not have a textbook associated with it. Please
            return to the main project page to create or connect one.
          </p>
        </div>
      );
    }
    return (
      <List divided verticalAlign="middle">
        {nodes.map((node, idx) => {
          return (
            <List.Item
              key={`tree-node-${node.id}-${idx}`}
              style={{
                paddingLeft: indentLevel === 1 ? "" : `${indentLevel}rem`,
              }}
            >
              <List.Content>
                <List.Header
                  className={`${
                    node.isRoot ? "py-4" : "py-2"
                  } !flex justify-between w-full items-center`}
                >
                  <div>
                    {node.children && node.children.length !== 0 && (
                      <Icon
                        className="cursor-pointer"
                        name={node.expanded ? "caret down" : "caret right"}
                        onClick={(e: any) => {
                          e.preventDefault();
                          handleToggle(node.id);
                        }}
                      />
                    )}
                    <Link to={node.url} target="_blank">
                      {node.title}
                    </Link>
                  </div>
                  {!node.isRoot && (
                    <div className="flex">
                      <Button
                        color="blue"
                        onClick={() => {
                          handleOpenEditModal(
                            projectData?.libreLibrary,
                            node.id,
                            node.title
                          );
                        }}
                      >
                        <Icon name="edit" />
                        Edit Metadata
                      </Button>
                    </div>
                  )}
                </List.Header>
                {node.children &&
                  node.expanded &&
                  renderNodes(node.children, indentLevel + 1)}
              </List.Content>
            </List.Item>
          );
        })}
      </List>
    );
  };

  return (
    <Grid className="component-container">
      <Grid.Column>
        <div>
          <Link to={`/projects/${projectID}`}>
            <Icon name="arrow circle left" />
            Back to Project Overview
          </Link>
        </div>
        <Header as="h2" dividing className="component-header">
          Textbook Curation: {projectData?.title}
        </Header>
        <Segment.Group size="large" raised className="mb-4p">
          <Segment loading={isLoading}>
            {data ? (
              <>
                <div className="flex flex-row justify-between items-center">
                  <p className="text-xl">
                    <span className="font-semibold">Title:</span> {bookTitle}
                  </p>
                  <div className="flex flex-row items-center">
                    <p className="mr-4 font-semibold">Bulk Actions:</p>
                    <Button primary onClick={handleOpenBulkSummariesModal}>
                      <Icon name="magic" />
                      AI Page Summaries
                    </Button>
                  </div>
                </div>
                {renderNodes(data)}
              </>
            ) : (
              <div>
                <p className="text-center muted-text">
                  <em>No content available.</em>
                </p>
              </div>
            )}
          </Segment>
        </Segment.Group>
      </Grid.Column>
    </Grid>
  );
};

export default TextbookCuration;
