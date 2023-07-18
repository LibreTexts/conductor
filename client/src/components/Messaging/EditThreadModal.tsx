import { Modal, Form, Dropdown, Button, Icon, Input } from "semantic-ui-react";
import { Thread } from "../../types";
import { useState, useEffect } from "react";
import { THREADS_NOTIFY_OPTIONS } from "../../utils/threadsHelpers";
import useGlobalError from "../error/ErrorHooks";
import axios from "axios";

type EditThreadModalProps = {
  show: boolean;
  onClose: () => void;
  onSave: () => void;
  thread: Partial<Thread>;
};
const EditThreadModal: React.FC<EditThreadModalProps> = ({
  show,
  onClose,
  onSave,
  thread,
}) => {
  const { handleGlobalError } = useGlobalError();
  const [threadTitle, setThreadTitle] = useState("");
  const [threadDefaultNotifSubject, setThreadDefaultNotifSubject] =
    useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show && thread.threadID) {
      setThreadTitle(thread.title ?? "");
      setThreadDefaultNotifSubject(thread.defaultNotifSubject ?? "");
    }
  }, [show, thread]);

  async function save() {
    try {
      if (!thread.threadID || !threadTitle || !threadDefaultNotifSubject) {
        return;
      }
      setLoading(true);

      const updateRes = await axios.patch("/project/thread", {
        threadID: thread.threadID,
        title: threadTitle,
        defaultNotifSubject: threadDefaultNotifSubject,
      });

      if (updateRes.data.err) {
        throw new Error(updateRes.data.errMsg);
      }
      onSave();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal open={show} onClose={onClose}>
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
              onChange={(e) => setThreadTitle(e.target.value)}
              value={threadTitle}
            />
          </Form.Field>
          <Form.Field>
            <label>Default Notification Setting</label>
            <Dropdown
              placeholder="Select a default notification setting"
              selection
              options={THREADS_NOTIFY_OPTIONS}
              onChange={(_e, { value }) => {
                setThreadDefaultNotifSubject(value?.toString() ?? "");
              }}
              value={threadDefaultNotifSubject}
            />
          </Form.Field>
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="green" loading={loading} onClick={save}>
          <Icon name="save" />
          Save
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default EditThreadModal;
