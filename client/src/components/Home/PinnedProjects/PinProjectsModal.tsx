import { useCallback, useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button, Modal, Stack } from "@libretexts/davis-react";
import { User } from "../../../types";
import ConfirmModal from "../../ConfirmModal";
import NewFolderModal from "./NewPinnedProjectsFolderModal";
import {
  useAddFolderMutation,
  useMoveProjectMutation,
  usePinnedProjects,
  useRemoveFolderMutation,
  useUnpinProjectMutation,
} from "./hooks";
import { IconFolder, IconPinnedOff, IconPlus, IconTrash } from "@tabler/icons-react";

interface PinProjectsModalProps {
  show: boolean;
  onClose: () => void;
  directAddID?: string;
}

type PinnedProjectType = NonNullable<User["pinnedProjects"]>[0]["projects"][number];

const SCROLL_MARGIN = 50;
const SCROLL_SPEED = 15;

const PinProjectsModal: React.FC<PinProjectsModalProps> = ({
  show,
  onClose,
  directAddID,
}) => {
  const { data } = usePinnedProjects();
  const moveProjectMutation = useMoveProjectMutation();
  const unpinProjectMutation = useUnpinProjectMutation();
  const addFolderMutation = useAddFolderMutation();
  const removeFolderMutation = useRemoveFolderMutation();
  const bodyRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState("");

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, projectID: string) => {
    e.dataTransfer.setData("text/plain", projectID);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, folderName: string) => {
    e.preventDefault();
    const projectID = e.dataTransfer.getData("text/plain");
    if (!projectID || !folderName) return;

    const isCurrentFolder = data?.some(
      (item) =>
        item.folder === folderName &&
        item.projects?.some((p) =>
          typeof p === "string" ? p === projectID : p.projectID === projectID
        )
    );
    if (isCurrentFolder) return;

    moveProjectMutation.mutate({ folderName, projectID });
  };

  const onInitClickDeleteFolder = (folder: string) => {
    if (!folder) return;
    setFolderToDelete(folder);
    setShowDeleteFolderModal(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const container = bodyRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const offsetTop = e.clientY - rect.top;
    const offsetBottom = rect.bottom - e.clientY;
    if (offsetTop < SCROLL_MARGIN) container.scrollTop -= SCROLL_SPEED;
    else if (offsetBottom < SCROLL_MARGIN) container.scrollTop += SCROLL_SPEED;
  }, []);

  const startAutoScroll = () => {
    stopAutoScroll();
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
    <>
      <Modal open={show} onClose={() => onClose()} size="lg">
        <Modal.Header>
          <Modal.Title>
            {directAddID ? "Select Folder to Pin To" : "Edit Pinned Projects"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div ref={bodyRef} className="overflow-y-auto max-h-[60vh]">
            <div className="flex justify-between items-center mb-4">
              <p className="text-gray-600 text-sm">
                Drag and drop projects to move them between folders. You can also unpin projects from here.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowNewFolderModal(true)}
                icon={<IconPlus size={16} />}
              >
                Add Folder
              </Button>
            </div>
            <Stack direction="vertical" gap="md">
              {data?.map((item) => (
                <div
                  key={item.folder}
                  className="rounded-lg border border-gray-200 overflow-hidden"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, item.folder)}
                >
                  <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-b border-gray-200">
                    <span className="flex items-center gap-2 font-semibold text-gray-700">
                      <IconFolder size={16} />
                      {item.folder}
                    </span>
                    {item.folder !== "Default" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onInitClickDeleteFolder(item.folder)}
                        icon={<IconTrash size={14} />}
                      />
                    )}
                  </div>
                  <Stack direction="vertical" gap="xs" className="px-3 py-2">
                    {item.projects?.length === 0 && (
                      <p className="text-gray-400 text-sm py-2">No projects pinned here</p>
                    )}
                    {item.projects?.map((p) => {
                      if (typeof p === "string") return null;
                      return (
                        <div
                          key={p.projectID}
                          className="flex justify-between items-center border border-gray-200 bg-gray-100 hover:bg-gray-200 rounded-md p-2 cursor-grab active:cursor-grabbing shadow-sm"
                          draggable
                          onDragStart={(e) => handleDragStart(e, p.projectID)}
                        >
                          <Link
                            to={`/projects/${p.projectID}`}
                            className="text-blue-800 hover:text-blue-900 hover:underline font-semibold text-sm"
                          >
                            {p.title}
                          </Link>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => unpinProjectMutation.mutate(p.projectID)}
                            icon={<IconPinnedOff size={14} />}
                          />
                        </div>
                      );
                    })}
                  </Stack>
                </div>
              ))}
            </Stack>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </Modal.Footer>
      </Modal>
      <NewFolderModal
        open={showNewFolderModal}
        onClose={() => setShowNewFolderModal(false)}
        onSave={(newVal) => {
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
    </>
  );
};

export default PinProjectsModal;
