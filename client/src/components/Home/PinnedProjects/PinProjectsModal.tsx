import { useCallback, useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Icon,
  List,
  ListContent,
  ListHeader,
  ListIcon,
  ListItem,
  ListList,
  Modal,
  ModalProps,
} from "semantic-ui-react";
import { GenericKeyTextValueObj, Project, User } from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import { useQuery } from "@tanstack/react-query";
import api from "../../../api";
import ConfirmModal from "../../ConfirmModal";
import NewFolderModal from "./NewPinnedProjectsFolderModal";
import {
  useAddFolderMutation,
  useMoveProjectMutation,
  usePinnedProjects,
  useRemoveFolderMutation,
  useUnpinProjectMutation,
} from "./hooks";

interface PinProjectsModalProps extends ModalProps {
  show: boolean;
  onClose: () => void;
  directAddID?: string;
}

type PinnedProjectType = NonNullable<
  User["pinnedProjects"]
>[0]["projects"][number];

const SCROLL_MARGIN = 50;
const SCROLL_SPEED = 15;

const PinProjectsModal: React.FC<PinProjectsModalProps> = ({
  show,
  onClose,
  rest,
  directAddID,
}) => {
  const { handleGlobalError } = useGlobalError();
  const { data, isLoading: loadingPinnedProjects } = usePinnedProjects();
  const moveProjectMutation = useMoveProjectMutation();
  const unpinProjectMutation = useUnpinProjectMutation();
  const addFolderMutation = useAddFolderMutation();
  const removeFolderMutation = useRemoveFolderMutation();
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // const { data: userProjects, isLoading } = useQuery<Project[]>({
  //   queryKey: ["userProjects"],
  //   queryFn: async () => {
  //     const res = await api.getUserProjects();
  //     if (res.data.err) {
  //       throw new Error(res.data.errMsg);
  //     }
  //     return res.data.projects;
  //   },
  //   refetchOnMount: false,
  //   refetchOnWindowFocus: false,
  //   staleTime: 1000 * 60 * 5, // 5 minutes
  // });

  // const [loading, setLoading] = useState<boolean>(false);
  // const [projectsOptions, setProjectsOptions] = useState<
  //   GenericKeyTextValueObj<string>[]
  // >([]);

  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showDeleteFolderModal, setShowDeleteFolderModal] =
    useState<boolean>(false);
  const [folderToDelete, setFolderToDelete] = useState<string>("");

  // // Effects & Callbacks
  // useEffect(() => {
  //   if (show) {
  //     getPinnableProjects();
  //   }
  // }, [show]);

  /**
   * Loads the user's projects from the server, then filters already-pinned projects before
   * saving the list to state.
   */
  // const getPinnableProjects = useCallback(async () => {
  //   try {
  //     setLoading(true);
  //     if (!userProjects) return;

  //     const pinnedFlatted =
  //       data?.reduce((acc, item) => {
  //         if (item.projects) {
  //           for (const project of item.projects) {
  //             if (typeof project === "string") {
  //               continue;
  //             }

  //             acc.push(project);
  //           }
  //         }
  //         return acc;
  //       }, [] as PinnedProjectType[]) || [];

  //     const pinnedFiltered = userProjects
  //       .filter((item: Project) => {
  //         const foundMatch = pinnedFlatted.find((pinned) => {
  //           if (typeof pinned === "string") return false;
  //           return pinned.projectID === item.projectID;
  //         });
  //         if (foundMatch) {
  //           return false;
  //         }
  //         return true;
  //       })
  //       .sort((a: Project, b: Project) => {
  //         let normalA = String(a.title)
  //           .toLowerCase()
  //           .replace(/[^A-Za-z]+/g, "");
  //         let normalB = String(b.title)
  //           .toLowerCase()
  //           .replace(/[^A-Za-z]+/g, "");
  //         if (normalA < normalB) return -1;
  //         if (normalA > normalB) return 1;
  //         return 0;
  //       })
  //       .map((item: Project) => {
  //         return {
  //           key: item.projectID,
  //           value: item.projectID,
  //           text: item.title,
  //         };
  //       });

  //     setProjectsOptions(pinnedFiltered);
  //   } catch (err) {
  //     handleGlobalError(err);
  //   } finally {
  //     setLoading(false);
  //   }
  // }, [data, setLoading, setProjectsOptions, handleGlobalError, userProjects]);

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    projectID: string
  ) => {
    e.dataTransfer.setData("text/plain", projectID);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    folderName: string
  ) => {
    e.preventDefault();
    const projectID = e.dataTransfer.getData("text/plain");
    if (!projectID || !folderName) return;

    // if the project is already in the folder, do nothing
    const isCurrentFolder = data?.some(
      (item) =>
        item.folder === folderName &&
        item.projects?.some((p) =>
          typeof p === "string" ? p === projectID : p.projectID === projectID
        )
    );
    if (isCurrentFolder) return;

    moveProjectMutation.mutate({
      folderName: folderName,
      projectID: projectID,
    });
  };

  const onInitClickDeleteFolder = (folder: string) => {
    if (!folder) return;
    setFolderToDelete(folder);
    setShowDeleteFolderModal(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const offsetTop = e.clientY - rect.top;
    const offsetBottom = rect.bottom - e.clientY;

    if (offsetTop < SCROLL_MARGIN) {
      // Near the top — scroll up
      container.scrollTop -= SCROLL_SPEED;
    } else if (offsetBottom < SCROLL_MARGIN) {
      // Near the bottom — scroll down
      container.scrollTop += SCROLL_SPEED;
    }
  }, []);

  const startAutoScroll = () => {
    stopAutoScroll(); // Clear any existing
    intervalRef.current = setInterval(() => {
      document.addEventListener("mousemove", handleMouseMove);
    }, 50);
  };

  const stopAutoScroll = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    document.removeEventListener("mousemove", handleMouseMove);
  };

  useEffect(() => {
    document.addEventListener("dragstart", startAutoScroll);
    document.addEventListener("dragend", stopAutoScroll);

    return () => {
      document.removeEventListener("dragstart", startAutoScroll);
      document.removeEventListener("dragend", stopAutoScroll);
      stopAutoScroll();
    };
  }, [handleMouseMove]);

  return (
    <Modal open={show} onClose={() => onClose()} size="large" {...rest}>
      <Modal.Header>
        {directAddID ? "Select Folder to Pin To" : "Edit Pinned Projects"}
      </Modal.Header>
      <Modal.Content
        scrolling
        id="edit-pinned-projects-content"
        ref={containerRef}
      >
        <div className="flex justify-between items-start mb-4">
          <p className="text-gray-600">
            Drag and drop projects to move them between folders. You can also
            unpin projects from here.
          </p>
          <div className="flex items-center">
            <Button color="blue" onClick={() => setShowNewFolderModal(true)}>
              <Icon name="plus" />
              Add Folder
            </Button>
          </div>
        </div>
        {/* <Form noValidate>
          <Form.Select
            search
            label="Select from your Projects"
            placeholder="Choose or start typing to search..."
            options={projectsOptions}
            onChange={(_e, { value }) => setProjectToPin(value as string)}
            value={projectToPin}
            loading={loading}
            disabled={loading}
          />
          <Button
            fluid
            disabled={!projectToPin}
            color="blue"
            loading={loading}
            onClick={pinProjectInModal}
          >
            <Icon name="pin" />
            Pin Project
          </Button>
        </Form>
        <Divider /> */}
        <List verticalAlign="middle" className="!px-2 !rounded-md">
          {data?.map((item) => {
            return (
              <ListItem
                key={item.folder}
                className="!first:pt-0 !pt-2"
                onDragOver={handleDragOver}
                onDrop={(e: React.DragEvent<HTMLDivElement>) =>
                  handleDrop(e, item.folder)
                }
              >
                <ListIcon name="folder" />
                <ListContent>
                  <ListHeader className="!flex justify-between items-start">
                    {item.folder}
                    {item.folder !== "Default" && (
                      <Button
                        onClick={() => onInitClickDeleteFolder(item.folder)}
                        icon
                        size="mini"
                        color="red"
                      >
                        <Icon name="trash" />
                      </Button>
                    )}
                  </ListHeader>
                </ListContent>
                <ListList className="!mb-4">
                  {item.projects?.length === 0 && (
                    <p className="text-gray-500 !ml-5">No projects pinned here</p>
                  )}
                  {item.projects?.length > 0 &&
                    item.projects?.map((p) => {
                      if (typeof p === "string") {
                        return null;
                      }

                      return (
                        <ListItem
                          key={p.projectID}
                          className="!border !border-gray-200 ml-5 bg-gray-100 hover:!bg-gray-200 !rounded-md !p-2 !mb-1 hover:!cursor-pointer !shadow-sm"
                          draggable
                          onDragStart={(e: React.DragEvent<HTMLDivElement>) =>
                            handleDragStart(e, p.projectID)
                          }
                        >
                          <ListContent className="!flex justify-between items-center [&.is-dragging]:cursor-grabbing">
                            <Link
                              to={`/projects/${p.projectID}`}
                              className="text-blue-800 hover:text-blue-900 hover:underline font-semibold"
                            >
                              {p.title}
                            </Link>
                            <Button
                              onClick={() =>
                                unpinProjectMutation.mutate(p.projectID)
                              }
                              className="!mb-0.5"
                              icon
                              size="mini"
                              color="red"
                            >
                              <Icon.Group className="icon">
                                <Icon name="pin" />
                                <Icon corner name="x" />
                              </Icon.Group>
                            </Button>
                          </ListContent>
                        </ListItem>
                      );
                    })}
                </ListList>
              </ListItem>
            );
          })}
        </List>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => onClose()} color="blue">
          Done
        </Button>
      </Modal.Actions>
      <NewFolderModal
        open={showNewFolderModal}
        onClose={() => setShowNewFolderModal(false)}
        onSave={(newVal: string) => {
          if (!newVal) return;
          setShowNewFolderModal(false);
          addFolderMutation.mutate(newVal);
        }}
      />
      {showDeleteFolderModal && (
        <ConfirmModal
          onCancel={() => {
            setShowDeleteFolderModal(false);
            setFolderToDelete("");
          }}
          onConfirm={() => {
            setShowDeleteFolderModal(false);
            removeFolderMutation.mutate(folderToDelete);
            setFolderToDelete("");
          }}
          text={`Are you sure you want to delete the folder "${folderToDelete}"? All projects in this folder will be unpinned.`}
          confirmText="Delete"
          cancelText="Cancel"
          confirmColor="red"
        />
      )}
    </Modal>
  );
};

export default PinProjectsModal;
