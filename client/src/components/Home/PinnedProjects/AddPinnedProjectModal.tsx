import {
  Button,
  Icon,
  List,
  ListContent,
  ListHeader,
  ListIcon,
  ListItem,
  Modal,
  ModalProps,
} from "semantic-ui-react";
import LoadingSpinner from "../../LoadingSpinner";
import { useState } from "react";
import NewFolderModal from "./NewPinnedProjectsFolderModal";
import {
  useAddFolderMutation,
  usePinnedProjects,
  usePinProjectMutation,
} from "./hooks";

interface AddPinnedProjectModalProps extends ModalProps {
  show: boolean;
  onClose: () => void;
  projectID: string;
}

const AddPinnedProjectModal: React.FC<AddPinnedProjectModalProps> = ({
  show,
  onClose,
  projectID,
  ...rest
}) => {
  const addFolderMutation = useAddFolderMutation();
  const pinProjectMutation = usePinProjectMutation();
  const { data, isLoading } = usePinnedProjects();

  const [showNewFolderModal, setShowNewFolderModal] = useState(false);

  return (
    <Modal open={show} onClose={() => onClose()} size="small" {...rest}>
      <Modal.Header className="!flex !justify-between !items-center">
        <p className="!text-xl !font-semibold">
          Select a folder to pin this project to
        </p>
        <Button
          color="blue"
          onClick={() => setShowNewFolderModal(true)}
          size="small"
        >
          <Icon name="plus" />
          Add Folder
        </Button>
      </Modal.Header>
      <Modal.Content scrolling>
        {isLoading && <LoadingSpinner />}

        <List verticalAlign="middle">
          {data?.map((item) => {
            return (
              <ListItem
                key={item.folder}
                className="!first:pt-0 !pt-2 hover:!bg-gray-200 hover:!cursor-pointer !p-2 !rounded-md text-lg"
                onClick={() => {
                  pinProjectMutation.mutate({
                    folderName: item.folder,
                    projectID: projectID,
                  });
                  onClose();
                }}
              >
                <ListIcon name="folder" />
                <ListContent>
                  <ListHeader className="!flex justify-between items-start">
                    {item.folder}
                  </ListHeader>
                </ListContent>
              </ListItem>
            );
          })}
        </List>
      </Modal.Content>
      <NewFolderModal
        open={showNewFolderModal}
        onClose={() => setShowNewFolderModal(false)}
        onSave={(newVal: string) => {
          if (!newVal) return;
          setShowNewFolderModal(false);
          addFolderMutation.mutate(newVal);
        }}
      />
    </Modal>
  );
};

export default AddPinnedProjectModal;
