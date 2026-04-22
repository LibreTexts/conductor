import { Button, Modal, Spinner } from "@libretexts/davis-react";
import { useState } from "react";
import NewFolderModal from "./NewPinnedProjectsFolderModal";
import {
  useAddFolderMutation,
  usePinnedProjects,
  usePinProjectMutation,
} from "./hooks";
import { IconFolder, IconPlus } from "@tabler/icons-react";

interface AddPinnedProjectModalProps {
  show: boolean;
  onClose: () => void;
  projectID: string;
}

const AddPinnedProjectModal: React.FC<AddPinnedProjectModalProps> = ({
  show,
  onClose,
  projectID,
}) => {
  const addFolderMutation = useAddFolderMutation();
  const pinProjectMutation = usePinProjectMutation();
  const { data, isLoading } = usePinnedProjects();

  const [showNewFolderModal, setShowNewFolderModal] = useState(false);

  return (
    <>
      <Modal open={show} onClose={() => onClose()} size="sm">
        <Modal.Header>
          <Modal.Title className="!text-base !font-semibold">Pin to Folder</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-gray-500">Select a folder to pin this project to</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowNewFolderModal(true)}
              icon={<IconPlus size={14} />}
            >
              New Folder
            </Button>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-1">
              {data?.map((item) => (
                <button
                  key={item.folder}
                  className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors text-sm text-gray-800"
                  onClick={() => {
                    pinProjectMutation.mutate({ folderName: item.folder, projectID });
                    onClose();
                  }}
                >
                  <IconFolder size={15} className="text-gray-400 shrink-0" />
                  <span>{item.folder}</span>
                </button>
              ))}
            </div>
          )}
        </Modal.Body>
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
    </>
  );
};

export default AddPinnedProjectModal;
