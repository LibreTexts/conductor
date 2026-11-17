import { useMemo, useState } from "react";
import { Button, Modal, Select } from "@libretexts/davis-react";
import { IconPlus } from "@tabler/icons-react";
import useProjectTasks from "../../../hooks/useProjectTasks";
import useProjectTaskMutations from "../../../hooks/useProjectTaskMutations";
import { getDependencyCandidates, getDependencyIDs } from "../../../utils/projectTaskHelpers";
import TaskModalTitle from "./TaskModalTitle";

interface AddTaskDependencyModalProps {
  projectID: string;
  taskID: string;
  onClose: () => void;
}

const AddTaskDependencyModal: React.FC<AddTaskDependencyModalProps> = ({
  projectID,
  taskID,
  onClose,
}) => {
  const { byID, allTasks, getTaskTitle } = useProjectTasks(projectID);
  const { updateTask } = useProjectTaskMutations(projectID);
  const [selectedID, setSelectedID] = useState("");
  const [showError, setShowError] = useState(false);

  const task = byID.get(taskID);
  const title = task?.title ?? "Loading...";
  const options = useMemo(
    () => (task ? getDependencyCandidates(task, allTasks) : []),
    [task, allTasks]
  );

  const handleAdd = () => {
    if (!task) return;
    if (!selectedID) {
      setShowError(true);
      return;
    }
    updateTask.mutate(
      { taskID, dependencies: [...getDependencyIDs(task), selectedID] },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal open onClose={() => onClose()} size="lg">
      <TaskModalTitle
        parentTitle={task?.parent ? getTaskTitle(task.parent) : undefined}
        taskTitle={title}
        action="Add Dependency"
      />
      <Modal.Body className="min-h-[18rem]">
        <p className="mb-6 text-lg">
          Select a task to add as a dependency for <em>{title}</em>.
        </p>
        <Select
          name="task-dependency"
          label="Task dependency"
          labelClassName="sr-only"
          placeholder="Select task..."
          options={options}
          value={selectedID}
          onChange={(e) => {
            setSelectedID(e.target.value);
            setShowError(false);
          }}
          disabled={updateTask.isLoading}
          error={showError}
          errorMessage={showError ? "Select a task." : undefined}
        />
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={updateTask.isLoading}
            onClick={handleAdd}
            icon={<IconPlus size={18} />}
          >
            Add Dependency
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default AddTaskDependencyModal;
