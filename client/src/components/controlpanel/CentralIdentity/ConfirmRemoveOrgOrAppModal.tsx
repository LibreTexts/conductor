import { useState } from "react";
import { Button, Modal, Spinner, Text } from "@libretexts/davis-react";
import useGlobalError from "../../error/ErrorHooks";
import axios from "axios";

interface ConfirmRemoveOrgOrAppModalProps {
  show: boolean;
  type: "org" | "app";
  userId: string;
  targetId: string;
  onClose: () => void;
}

const ConfirmRemoveOrgOrAppModal: React.FC<ConfirmRemoveOrgOrAppModalProps> = ({
  show,
  type,
  userId,
  targetId,
  onClose,
}) => {
  // Global state & hooks
  const { handleGlobalError } = useGlobalError();

  // Data & UI
  const [loading, setLoading] = useState(false);
  const label = type === "app" ? "Application" : "Organization";

  // Methods
  function submitRemoveOrgOrApp() {
    if (type === "app") {
      return submitRemoveApp();
    }
    return submitRemoveOrg();
  }

  async function submitRemoveApp() {
    try {
      if (!userId || !targetId) return;

      setLoading(true);

      const res = await axios.delete(
        `/central-identity/users/${userId}/applications/${targetId}`
      );

      if (res.data.err) {
        handleGlobalError(res.data.err);
        return;
      }

      onClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function submitRemoveOrg() {
    try {
      if (!userId || !targetId) return;

      setLoading(true);

      const res = await axios.delete(
        `/central-identity/users/${userId}/orgs/${targetId}`
      );

      if (res.data.err) {
        handleGlobalError(res.data.err);
        return;
      }

      onClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={show} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>Remove {label}</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <Text>
            Are you sure you want to remove this {label.toLowerCase()}?
          </Text>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={submitRemoveOrgOrApp}
          loading={loading}
        >
          Confirm
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConfirmRemoveOrgOrAppModal;
