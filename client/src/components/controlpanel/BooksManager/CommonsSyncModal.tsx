import { useMutation } from "@tanstack/react-query";
import { Button, Icon, Modal } from "semantic-ui-react";
import api from "../../../api";
import useMasterCatalogV2 from "../../../hooks/useMasterCatalogV2";

interface CommonsSyncModalProps {
  open: boolean;
  onClose: () => void;
}

const CommonsSyncModal: React.FC<CommonsSyncModalProps> = ({
  open,
  onClose,
}) => {
  const { invalidate } = useMasterCatalogV2();

  const syncWithLibsMutation = useMutation({
    mutationFn: api.syncWithLibraries,
    onSuccess(data, variables, context) {
      invalidate();
    },
    meta: {
      errorMessage: "Failed to sync Commons with Libraries",
    },
  });

  return (
    <Modal open={open} closeOnDimmerClick={false}>
      <Modal.Header>Commons Sync</Modal.Header>
      <Modal.Content>
        <p>
          <strong>Caution:</strong> you are about to manually sync Commons with
          the LibreTexts libraries. This operation is resource-intensive and
          should not be performed often.
        </p>
        <p>
          <em>
            This may result in a brief service interruption while the database
            is updated.
          </em>
        </p>
        {!syncWithLibsMutation.isSuccess && (
          <Button
            color="blue"
            onClick={() => syncWithLibsMutation.mutate()}
            fluid
            loading={syncWithLibsMutation.isLoading}
          >
            <Icon name="sync alternate" />
            Sync Commons with Libraries
          </Button>
        )}
        {syncWithLibsMutation.isLoading && (
          <p className="text-center mt-1p">
            <strong>Sync Status:</strong> <em>In progress...</em>
          </p>
        )}
        {syncWithLibsMutation.data?.data.msg !== "" && (
          <p className="text-center mt-1p">
            <strong>Sync Status:</strong> {syncWithLibsMutation.data?.data.msg}
          </p>
        )}
      </Modal.Content>
      <Modal.Actions>
        {!syncWithLibsMutation.isSuccess && (
          <Button onClick={onClose} disabled={syncWithLibsMutation.isLoading}>
            Cancel
          </Button>
        )}
        {syncWithLibsMutation.isSuccess && (
          <Button
            onClick={onClose}
            disabled={syncWithLibsMutation.isLoading}
            color="blue"
          >
            Done
          </Button>
        )}
      </Modal.Actions>
    </Modal>
  );
};

export default CommonsSyncModal;
