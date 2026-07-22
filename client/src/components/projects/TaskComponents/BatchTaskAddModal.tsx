import { Button, Checkbox, Input, Modal } from "@libretexts/davis-react";
import { IconPlus } from "@tabler/icons-react";

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
    <Modal open={show} onClose={(v) => { if (!v) onClose(); }}>
      <Modal.Header>
        <Modal.Title>Batch Add Tasks</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="flex flex-col gap-4">
          <Input
            name="batch-tasks"
            label="Number of Tasks to Add"
            type="number"
            placeholder="Number..."
            min={1}
            max={100}
            onChange={(e) => setBatchTasks(parseInt(e.target.value))}
            value={batchTasks}
            error={batchTasksErr}
          />
          <Input
            name="batch-title"
            label="Task Title Prefix"
            type="text"
            placeholder="Title prefix..."
            onChange={(e) => setBatchTitle(e.target.value)}
            value={batchTitle}
            error={batchTitleErr}
          />
          <p>
            <strong>Example: </strong>
            <em>{batchTitle !== "" ? batchTitle : "<Title prefix>"} 1</em>
          </p>
          <Checkbox
            name="batch-add-subtasks"
            label="Add Subtasks to Each"
            checked={batchAddSubtasks}
            onChange={(checked) => setBatchAddSubtasks(checked)}
          />
          {batchAddSubtasks && (
            <div className="flex flex-col gap-4 pl-2 border-l-2 border-gray-200">
              <Input
                name="batch-subtasks"
                label="Number of Subtasks to Add to Each"
                type="number"
                placeholder="Number..."
                min={1}
                max={100}
                onChange={(e) => setBatchSubtasks(parseInt(e.target.value))}
                value={batchSubtasks}
                error={batchSubtasksErr}
              />
              <Input
                name="batch-subtitle"
                label="Subtask Title Prefix"
                type="text"
                placeholder="Title prefix..."
                onChange={(e) => setBatchSubtitle(e.target.value)}
                value={batchSubtitle}
                error={batchSubtitleErr}
              />
              <p>
                <strong>Example: </strong>
                <em>
                  {batchSubtitle !== "" ? batchSubtitle : "<Subtitle prefix>"}{" "}
                  1.1
                </em>
              </p>
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon={<IconPlus size={15} />}
            loading={batchAddLoading}
            onClick={onRequestSave}
          >
            Add Tasks
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default BatchTaskAddModal;
