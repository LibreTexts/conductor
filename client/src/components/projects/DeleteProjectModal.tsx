import { useState } from "react";
import { Button, Icon, Modal, ModalProps } from "semantic-ui-react";
import api from "../../api";
import useGlobalError from "../error/ErrorHooks";

interface DeleteProjectModalProps extends ModalProps {
  show: boolean;
  projectID: string;
  onCancel: () => void;
}

const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({
  show,
  projectID,
  onCancel,
  ...rest
}) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);

  /**
   * Submits a DELETE request to the server to delete the project,
   * then redirects to the Projects dashboard on success.
   */
  async function submitDeleteProject() {
    try {
      setLoading(true);
      if (!projectID) return;
      const res = await api.deleteProject(projectID);

      if (res.data.err) {
        throw new Error(res.data.err);
      }
      window.location.assign("/projects?projectDeleted=true");
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={show} closeOnDimmerClick={false} {...rest}>
      <Modal.Header>Confirm Project Deletion</Modal.Header>
      <Modal.Content>
        <p>
          Are you sure you want to delete this project?{" "}
          <strong>This cannot be undone.</strong>
        </p>
        <Button
          color="red"
          fluid
          loading={loading}
          onClick={submitDeleteProject}
        >
          <Icon name="trash alternate" />
          Delete Project
        </Button>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => onCancel()}>Cancel</Button>
      </Modal.Actions>
    </Modal>
  );
};

export default DeleteProjectModal;
