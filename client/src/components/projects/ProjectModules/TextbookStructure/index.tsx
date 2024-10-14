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

type WithUIState = TableOfContents & { expanded: boolean };

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
      const withUIState = content.map((item) => {
        return { ...item, expanded: false };
      });

      return withUIState;
    },
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
    enabled: !!libreLibrary && !!libreCoverID,
  });

  const handleToggle = (id: string) => {
    const updatedData = data?.map((item) => {
      if (item.id === id) {
        return { ...item, expanded: !item.expanded };
      }
      return item;
    });

    queryClient.setQueryData(["textbook-structure", projectID], updatedData);
  };

  const handleOpenEditModal = (library: string, pageID: string, title:string) => {
    openModal(<EditMetadataModal library={library} pageID={pageID} title={title}/>);
  };

  return (
    <Grid.Column>
      <Header as="h2" dividing>
        Textbook Structure (Beta)
      </Header>
      <Segment.Group size="large" raised className="mb-4p">
        <Segment loading={isLoading}>
          {data ? (
            <List divided verticalAlign="middle">
              {data.map((item, idx) => {
                return (
                  <List.Item key={`tree-node-${idx}`}>
                    <List.Content>
                      <List.Header className="py-4">
                        <Icon
                          className="cursor-pointer"
                          name={item.expanded ? "caret down" : "caret right"}
                          onClick={(e: any) => {
                            e.preventDefault();
                            handleToggle(item.id);
                          }}
                        />
                        <Link to={item.url}>{item.title}</Link>
                      </List.Header>
                      {item.children && item.expanded && (
                        <div
                          className={
                            item.expanded ? "w-[98%] ml-auto" : "hidden"
                          }
                        >
                          <List divided verticalAlign="middle">
                            {item.children.map((subItem, idx) => {
                              return (
                                <List.Item
                                  key={`tree-node-${idx}`}
                                  className="pl-4 !py-4 border-b border-slate-300 last:border-none"
                                >
                                  <List.Content>
                                    <List.Header className="!flex justify-between w-full items-center">
                                      <Link to={subItem.url}>
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
                      )}
                    </List.Content>
                  </List.Item>
                );
              })}
            </List>
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
  );
};

export default TextbookStructure;
