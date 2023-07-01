import { Modal, Form, Checkbox, Input, Button, Icon } from "semantic-ui-react";

interface BatchTaskAddModalProps {
  show: boolean;
  onClose: () => void;
  batchTasks: number;
  batchTitle: string;
  batchAddSubtasks: boolean;
  batchSubtasks: number;
  batchSubtitle: string;
  batchAddLoading: boolean;
  batchTitleErr: boolean;
  batchTasksErr: boolean;
  batchSubtasksErr: boolean;
  batchSubtitleErr: boolean;
  setBatchTasks: (value: number) => void;
  setBatchTitle: (value: string) => void;
  setBatchAddSubtasks: (value: boolean) => void;
  setBatchSubtasks: (value: number) => void;
  setBatchSubtitle: (value: string) => void;
  onRequestSave: () => void;
}

const BatchTaskAddModal: React.FC<BatchTaskAddModalProps> = ({
  show,
  onClose,
  batchTasks,
  batchTitle,
  batchAddSubtasks,
  batchSubtasks,
  batchSubtitle,
  batchAddLoading,
  batchTitleErr,
  batchTasksErr,
  batchSubtasksErr,
  batchSubtitleErr,
  setBatchTasks,
  setBatchTitle,
  setBatchAddSubtasks,
  setBatchSubtasks,
  setBatchSubtitle,
  onRequestSave,
}) => {
  return (
    <Modal open={show} onClose={onClose}>
      <Modal.Header>Batch Add Tasks</Modal.Header>
      <Modal.Content>
        <Form noValidate>
          <Form.Field error={batchTasksErr}>
            <label>Number of Tasks to Add</label>
            <Input
              type="number"
              placeholder="Number..."
              min={1}
              max={100}
              onChange={(_e, { value }) => setBatchTasks(parseInt(value))}
              value={batchTasks}
            />
          </Form.Field>
          <Form.Field error={batchTitleErr}>
            <label>Task Title Prefix</label>
            <Input
              type="text"
              placeholder="Title prefix..."
              onChange={(_e, { value }) => setBatchTitle(value)}
              value={batchTitle}
            />
          </Form.Field>
          <p>
            <strong>Example: </strong>
            <em>{batchTitle !== "" ? batchTitle : "<Title prefix>"} 1</em>
          </p>
          <Form.Field>
            <Checkbox
              toggle
              label="Add Subtasks to Each"
              onChange={(_e, data) =>
                setBatchAddSubtasks(data.checked ?? false)
              }
              checked={batchAddSubtasks}
            />
          </Form.Field>
          {batchAddSubtasks && (
            <div>
              <Form.Field error={batchSubtasksErr}>
                <label>Number of Subtasks to Add to Each</label>
                <Input
                  type="number"
                  placeholder="Number..."
                  min={1}
                  max={100}
                  onChange={(_e, { value }) =>
                    setBatchSubtasks(parseInt(value))
                  }
                  value={batchSubtasks}
                />
              </Form.Field>
              <Form.Field error={batchSubtitleErr}>
                <label>Subtask Title Prefix</label>
                <Input
                  type="text"
                  placeholder="Title prefix..."
                  onChange={(_e, { value }) => setBatchSubtitle(value)}
                  value={batchSubtitle}
                />
              </Form.Field>
              <p>
                <strong>Example: </strong>
                <em>
                  {batchSubtitle !== "" ? batchSubtitle : "<Subtitle prefix>"}{" "}
                  1.1
                </em>
              </p>
            </div>
          )}
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="green" loading={batchAddLoading} onClick={onRequestSave}>
          <Icon name="add" />
          Add Tasks
        </Button>
      </Modal.Actions>
    </Modal>
  );
};
export default BatchTaskAddModal;
