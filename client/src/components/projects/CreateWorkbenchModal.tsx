import { Button, Modal, ModalProps } from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import axios from "axios";

interface CreateWorkbenchModalProps extends ModalProps {
  show: boolean;
  onClose: () => void;
}

const CreateWorkbenchModal: React.FC<CreateWorkbenchModalProps> = ({
  show,
  onClose,
  ...rest
}) => {
  const { handleGlobalError } = useGlobalError();
  async function createTestBench() {
    try {
      const res = await axios.post("/commons/book", {
        subdomain: "dev",
        title: "AnotherTestingBook",
        projectID: "WAy6MmnOqg",
      });
      console.log(res.data);
    } catch (err) {
      handleGlobalError(err);
    }
  }
  return (
    <Modal size="fullscreen" {...rest}>
      <Modal.Header>Create Workbench</Modal.Header>
      <Modal.Content>
        <Modal.Description>
          <p>Workbench Name</p>
          <Button color="blue" onClick={createTestBench}>
            Create Test Bench
          </Button>
        </Modal.Description>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onClose}>Save</Button>
      </Modal.Actions>
    </Modal>
  );
};

export default CreateWorkbenchModal;
