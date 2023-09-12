import { useState, useEffect } from "react";
import { Button, Modal, ModalProps } from "semantic-ui-react";
import LoadingSpinner from "../../LoadingSpinner";
import useGlobalError from "../../error/ErrorHooks";
import axios from "axios";

interface ConfirmRemoveOrgOrAppModalProps extends ModalProps {
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
  ...rest
}) => {
  // Global state & hooks
  const { handleGlobalError } = useGlobalError();

  // Data & UI
  const [loading, setLoading] = useState(false);

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
    <Modal open={show} onClose={onClose} {...rest}>
      <Modal.Header>
        Remove {type === "app" ? "Application" : "Organization"}
      </Modal.Header>
      <Modal.Content scrolling id="task-view-content">
        {loading && (
          <div className="my-4r">
            <LoadingSpinner />
          </div>
        )}
        {!loading && (
          <p className="pa-2r">
            Are you sure you want to remove this{" "}
            {type === "app" ? "application" : "organization"}?
          </p>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="red" onClick={submitRemoveOrgOrApp}>
          Confirm
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default ConfirmRemoveOrgOrAppModal;
