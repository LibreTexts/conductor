import { useState } from "react";
import { Button, Modal, Spinner, Text } from "@libretexts/davis-react";
import { IconSend } from "@tabler/icons-react";
import { useModals } from "../../context/ModalContext";
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
    <Modal open={true} onClose={(v) => !v && closeAllModals()} size="sm">
      <Modal.Header>
        <Modal.Title>Request to Publish</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner size="md" />
          </div>
        ) : (
          <Text size="sm" className="text-slate-700">
            Are you sure you want to request publishing? This will send a
            request to the LibreTexts team.
          </Text>
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={closeAllModals} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={<IconSend size={15} />}
            iconClassName="items-center justify-center"
            onClick={handleRequestToPublish}
            loading={loading}
          >
            Confirm
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default RequestToPublishModal;
