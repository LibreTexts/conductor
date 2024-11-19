import { Button, Loader, Modal } from "semantic-ui-react";
import { useModals } from "../../context/ModalContext";
import { useState } from "react";
import useGlobalError from "../error/ErrorHooks";
import api from "../../api";
import { useNotifications } from "../../context/NotificationContext";

interface RequestToPublishModalProps {
  projectID: string;
  onClose: () => void;
}

const RequestToPublishModal: React.FC<RequestToPublishModalProps> = ({
  projectID,
  onClose,
}) => {
  const { handleGlobalError } = useGlobalError();
  const { closeAllModals } = useModals();
  const { addNotification } = useNotifications();

  const [loading, setLoading] = useState(false);

  async function handleRequestToPublish() {
    try {
      if (!projectID) return;
      setLoading(true);

      const res = await api.requestProjectPublishing(projectID);
      if (res.data.err) {
        throw new Error(
          res.data.errMsg || "An error occurred while requesting publishing."
        );
      }

      addNotification({
        type: "success",
        message: "Request to publish successfully sent!",
      });

      onClose();
    } catch (err) {
      console.error(err);
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={true} onClose={closeAllModals}>
      <Modal.Header>Request to Publish</Modal.Header>
      <Modal.Content>
        {loading ? (
          <Loader active inline="centered" />
        ) : (
          <p>
            Are you sure you want to request publishing? This will send a
            request to the LibreTexts team.
          </p>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button color="grey" onClick={closeAllModals}>
          Cancel
        </Button>
        <Button color="blue" onClick={handleRequestToPublish} loading={loading}>
          Confirm
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default RequestToPublishModal;
