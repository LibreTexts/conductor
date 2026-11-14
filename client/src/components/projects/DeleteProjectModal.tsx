import { useState } from "react";
import { Alert, Button, Modal, Text } from "@libretexts/davis-react";
import { IconTrash } from "@tabler/icons-react";
import api from "../../api";
import useGlobalError from "../error/ErrorHooks";

interface DeleteProjectModalProps {
  show: boolean;
  projectID: string;
  onCancel: () => void;
}

const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({
  show,
  projectID,
  onCancel,
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
    <Modal open={show} onClose={() => {}} size="sm">
      <Modal.Header>
        <Modal.Title>Confirm Project Deletion</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert
          variant="warning"
          message="Are you sure you want to delete this project? This cannot be undone."
        />
        <Text size="xs" color="muted" className="mt-2 block">
          All project tasks, discussions, and metadata associated with this
          project will be permanently removed.
        </Text>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onCancel()} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            icon={<IconTrash size={15} />}
            iconClassName="items-center justify-center"
            loading={loading}
            onClick={submitDeleteProject}
          >
            Delete Project
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default DeleteProjectModal;
