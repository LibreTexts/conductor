import { Button, Icon, Modal } from "semantic-ui-react";
import { useState } from "react";
import useGlobalError from "../../error/ErrorHooks";
import "../Projects.css";
import { useModals } from "../../../context/ModalContext";
import { useNotifications } from "../../../context/NotificationContext";
import api from "../../../api";

interface ConfirmAISummariesModalProps {
  library: string;
  pageID: string;
}

const ConfirmAISummariesModal: React.FC<ConfirmAISummariesModalProps> = ({
  library,
  pageID,
}) => {
  const { handleGlobalError } = useGlobalError();
  const { closeAllModals } = useModals();
  const { addNotification } = useNotifications();
  const [loading, setLoading] = useState<boolean>(false);

  async function handleSubmit() {
    try {
      if (!library || !pageID) {
        throw new Error("Missing library or page ID");
      }

      setLoading(true);

      const res = await api.batchApplyPageAISummary(`${library}-${pageID}`);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      addNotification({
        type: "success",
        message:
          "We're generating AI summaries for all pages in this book. We'll send you an email when it's complete.",
      });
      closeAllModals();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal size="large" open={true} onClose={closeAllModals}>
      <Modal.Header>Generate AI Page Summaries?</Modal.Header>
      <Modal.Content>
        <p className="text-lg mb-2">
          Are you sure you want to generate AI summaries for all pages in this
          book? This will overwrite any existing summaries.
        </p>
        <p className="text-lg mb-2">
          <strong>Note:</strong> Structural pages like the Table of Contents,
          chapter cover pages, etc., will not be summarized. This operation may
          take some time, so we'll send you an email when it's complete.
        </p>
        <p className="text-sm text-center text-slate-500 italic px-12 mt-6">
          Caution: AI-generated output may not always be accurate. Please
          thoroughly review content before publishing. LibreTexts is not
          responsible for any inaccuracies in AI-generated content.
        </p>
      </Modal.Content>
      <Modal.Actions>
        <Button color="grey" onClick={closeAllModals} loading={loading}>
          Cancel
        </Button>
        <Button color="green" onClick={handleSubmit} loading={loading}>
          <Icon name="magic" /> Generate AI Summaries
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default ConfirmAISummariesModal;
