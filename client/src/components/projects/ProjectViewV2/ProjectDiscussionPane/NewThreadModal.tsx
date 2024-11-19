import { useState } from "react";
import { Button, Form, Icon, Input, Modal } from "semantic-ui-react";
import useProjectDiscussions from "../../../../hooks/projects/useProjectDiscussions";

interface NewThreadModal {
  projectID: string;
  onClose: () => void;
}

const NewThreadModal: React.FC<NewThreadModal> = ({ projectID, onClose }) => {
  const { createThread } = useProjectDiscussions({ id: projectID });

  const [newThreadTitle, setNewThreadTitle] = useState("");

  async function submitNewThread() {
    if (!newThreadTitle) return;
    await createThread.mutateAsync({ projectID, title: newThreadTitle });
    onClose();
  }

  return (
    <Modal open={true} onClose={onClose}>
      <Modal.Header>Create a Thread</Modal.Header>
      <Modal.Content>
        <Form noValidate>
          <Form.Field>
            <label>Thread Title</label>
            <Input
              type="text"
              icon="comments"
              iconPosition="left"
              placeholder="Enter thread title or topic..."
              onChange={(e) => setNewThreadTitle(e.target.value)}
              value={newThreadTitle}
            />
          </Form.Field>
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          color="green"
          loading={createThread.isLoading}
          onClick={submitNewThread}
        >
          <Icon name="add" />
          Create Thread
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default NewThreadModal;
