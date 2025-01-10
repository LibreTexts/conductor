import {
  List,
  Grid,
  Header,
  Segment,
  Search,
  Button,
  Icon,
  Popup,
  Image,
  Label,
} from "semantic-ui-react";
import Breakpoint from "../../../util/Breakpoints";
import { Link } from "react-router-dom-v5-compat";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../../api";
import TreeView from "../../../TreeView";
import { TableOfContents } from "../../../../types";
import { useModals } from "../../../../context/ModalContext";
import EditMetadataModal from "./EditMetadataModal";

type WithUIState = Omit<TableOfContents, "children"> & {
  expanded: boolean;
  isRoot: boolean;
  children: WithUIState[];
};

interface TextbookStructureProps {
  projectID: string;
  libreLibrary?: string;
  libreCoverID?: string;
}

const TextbookStructure: React.FC<TextbookStructureProps> = ({
  projectID,
  libreLibrary,
  libreCoverID,
}) => {
  const { openModal, closeAllModals } = useModals();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<WithUIState[]>({
    queryKey: ["textbook-structure", projectID],
    queryFn: async () => {
      const res = await api.getBookTOC(`${libreLibrary}-${libreCoverID}`);
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
    retry: 2,
    enabled: !!libreLibrary && !!libreCoverID,
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
    openModal(
      <EditMetadataModal library={library} pageID={pageID} title={title} />
    );
  };

  const renderNodes = (nodes: WithUIState[], indentLevel = 1) => {
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
                <List.Header className={`${node.isRoot ? 'py-4' : 'py-2'} !flex justify-between w-full items-center`}>
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
                            libreLibrary!,
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
                {/* <div className={node.expanded ? "w-[98%] ml-auto" : "hidden"}>
                    renderNodes(node.children)
                     <List divided verticalAlign="middle">
                      {node.children.map((subnode, idx) => {
                        return (
                          <List.Item
                            key={`tree-node-${idx}`}
                            className="pl-4 !py-4 border-b border-slate-300 last:border-none"
                          >
                            <List.Content>
                              <List.Header className="!flex justify-between w-full items-center">
                                <Link to={subItem.url} target="_blank">
                                  {subItem.title}
                                </Link>
                                <div className="flex">
                                  <Button
                                    color="blue"
                                    onClick={() => {
                                      handleOpenEditModal(
                                        libreLibrary!,
                                        subItem.id,
                                        subItem.title
                                      );
                                    }}
                                  >
                                    <Icon name="edit" />
                                    Edit Metadata
                                  </Button>
                                </div>
                              </List.Header>
                            </List.Content>
                          </List.Item>
                        );
                      })}
                    </List>
                  </div>
                )} */}
              </List.Content>
            </List.Item>
          );
        })}
      </List>
    );
  };

  return (
    <Grid.Column>
      <Header as="h2" dividing>
        Textbook Structure (<span className="italic">Beta</span>)
      </Header>
      <Segment.Group size="large" raised className="mb-4p">
        <Segment loading={isLoading}>
          {data ? (
            renderNodes(data)
          ) : (
            // <List divided verticalAlign="middle">
            //   {data.map((item, idx) => {
            //     return (
            //       <List.Item key={`tree-node-${idx}`}>
            //         <List.Content>
            //           <List.Header className="py-4">
            //             <Icon
            //               className="cursor-pointer"
            //               name={item.expanded ? "caret down" : "caret right"}
            //               onClick={(e: any) => {
            //                 e.preventDefault();
            //                 handleToggle(item.id);
            //               }}
            //             />
            //             <Link to={item.url} target="_blank">
            //               {item.title}
            //             </Link>
            //           </List.Header>
            //           {item.children && item.expanded && (
            //             <div
            //               className={
            //                 item.expanded ? "w-[98%] ml-auto" : "hidden"
            //               }
            //             >
            //               <List divided verticalAlign="middle">
            //                 {item.children.map((subItem, idx) => {
            //                   return (
            //                     <List.Item
            //                       key={`tree-node-${idx}`}
            //                       className="pl-4 !py-4 border-b border-slate-300 last:border-none"
            //                     >
            //                       <List.Content>
            //                         <List.Header className="!flex justify-between w-full items-center">
            //                           <Link to={subItem.url} target="_blank">
            //                             {subItem.title}
            //                           </Link>
            //                           <div className="flex">
            //                             <Button
            //                               color="blue"
            //                               onClick={() => {
            //                                 handleOpenEditModal(
            //                                   libreLibrary!,
            //                                   subItem.id,
            //                                   subItem.title
            //                                 );
            //                               }}
            //                             >
            //                               <Icon name="edit" />
            //                               Edit Metadata
            //                             </Button>
            //                           </div>
            //                         </List.Header>
            //                       </List.Content>
            //                     </List.Item>
            //                   );
            //                 })}
            //               </List>
            //             </div>
            //           )}
            //         </List.Content>
            //       </List.Item>
            //     );
            //   })}
            // </List>
            <div>
              <p className="text-center muted-text">
                <em>No content available.</em>
              </p>
            </div>
          )}
        </Segment>
      </Segment.Group>
    </Grid.Column>
  );
};

export default TextbookStructure;
