import { useState } from "react";
import { Button, Checkbox, Input, Modal } from "@libretexts/davis-react";
import { IconPlus } from "@tabler/icons-react";
import useProjectTaskMutations from "../../../hooks/useProjectTaskMutations";

interface BatchTaskAddModalProps {
  projectID: string;
  onClose: () => void;
}

const MIN_BATCH = 1;
const MAX_BATCH = 100;

const isValidCount = (n: number) => Number.isInteger(n) && n >= MIN_BATCH && n <= MAX_BATCH;

const BatchTaskAddModal: React.FC<BatchTaskAddModalProps> = ({ projectID, onClose }) => {
  const { batchAddTasks } = useProjectTaskMutations(projectID);

  const [taskCount, setTaskCount] = useState(1);
  const [titlePrefix, setTitlePrefix] = useState("");
  const [addSubtasks, setAddSubtasks] = useState(false);
  const [subtaskCount, setSubtaskCount] = useState(1);
  const [subtitlePrefix, setSubtitlePrefix] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const errors = {
    taskCount: !isValidCount(taskCount),
    titlePrefix: titlePrefix.trim() === "",
    subtaskCount: addSubtasks && !isValidCount(subtaskCount),
    subtitlePrefix: addSubtasks && subtitlePrefix.trim() === "",
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const handleSave = () => {
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    batchAddTasks.mutate(
      {
        tasks: taskCount,
        titlePrefix,
        ...(addSubtasks
          ? { addSubtasks: true, subtasks: subtaskCount, subtitlePrefix }
          : {}),
      },
      { onSuccess: onClose }
    );
  };

  const countError = `Enter a number from ${MIN_BATCH} to ${MAX_BATCH}.`;

  return (
    <Modal open onClose={() => onClose()}>
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
            min={MIN_BATCH}
            max={MAX_BATCH}
            required
            onChange={(e) => setTaskCount(parseInt(e.target.value))}
            value={Number.isNaN(taskCount) ? "" : taskCount}
            error={showErrors && errors.taskCount}
            errorMessage={showErrors && errors.taskCount ? countError : undefined}
          />
          <Input
            name="batch-title"
            label="Task Title Prefix"
            type="text"
            placeholder="Title prefix..."
            required
            onChange={(e) => setTitlePrefix(e.target.value)}
            value={titlePrefix}
            error={showErrors && errors.titlePrefix}
            errorMessage={showErrors && errors.titlePrefix ? "Enter a title prefix." : undefined}
          />
          <p>
            <strong>Example: </strong>
            <em>{titlePrefix !== "" ? titlePrefix : "<Title prefix>"} 1</em>
          </p>
          <Checkbox
            name="batch-add-subtasks"
            label="Add Subtasks to Each"
            checked={addSubtasks}
            onChange={setAddSubtasks}
          />
          {addSubtasks && (
            <div className="flex flex-col gap-4 pl-2 border-l-2 border-gray-200">
              <Input
                name="batch-subtasks"
                label="Number of Subtasks to Add to Each"
                type="number"
                placeholder="Number..."
                min={MIN_BATCH}
                max={MAX_BATCH}
                required
                onChange={(e) => setSubtaskCount(parseInt(e.target.value))}
                value={Number.isNaN(subtaskCount) ? "" : subtaskCount}
                error={showErrors && errors.subtaskCount}
                errorMessage={showErrors && errors.subtaskCount ? countError : undefined}
              />
              <Input
                name="batch-subtitle"
                label="Subtask Title Prefix"
                type="text"
                placeholder="Title prefix..."
                required
                onChange={(e) => setSubtitlePrefix(e.target.value)}
                value={subtitlePrefix}
                error={showErrors && errors.subtitlePrefix}
                errorMessage={
                  showErrors && errors.subtitlePrefix ? "Enter a subtask title prefix." : undefined
                }
              />
              <p>
                <strong>Example: </strong>
                <em>
                  {subtitlePrefix !== "" ? subtitlePrefix : "<Subtitle prefix>"} 1.1
                </em>
              </p>
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={<IconPlus size={15} />}
            loading={batchAddTasks.isLoading}
            onClick={handleSave}
          >
            Add Tasks
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default BatchTaskAddModal;
