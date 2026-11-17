import { useMemo, useState } from "react";
import { Button, Checkbox, Modal, Select } from "@libretexts/davis-react";
import { IconPlus } from "@tabler/icons-react";
import useProject from "../../../hooks/useProject";
import useProjectTasks from "../../../hooks/useProjectTasks";
import useProjectTaskMutations from "../../../hooks/useProjectTaskMutations";
import { buildAssigneeOptions } from "../../../utils/projectTaskHelpers";
import TaskModalTitle from "./TaskModalTitle";

interface AddTaskAssigneeModalProps {
  projectID: string;
  taskID: string;
  onClose: () => void;
}

const AddTaskAssigneeModal: React.FC<AddTaskAssigneeModalProps> = ({
  projectID,
  taskID,
  onClose,
}) => {
  const { project } = useProject(projectID);
  const { byID, getTaskTitle } = useProjectTasks(projectID);
  const { addAssignee } = useProjectTaskMutations(projectID);
  const [assigneeUUID, setAssigneeUUID] = useState("");
  const [includeSubtasks, setIncludeSubtasks] = useState(false);
  const [showError, setShowError] = useState(false);

  const task = byID.get(taskID);
  const title = task?.title ?? "Loading...";
  const isSubtask = !!task?.parent;
  const options = useMemo(
    () =>
      project && task
        ? buildAssigneeOptions(project, task).map(({ value, label }) => ({ value, label }))
        : [],
    [project, task]
  );

  const handleAdd = () => {
    if (!assigneeUUID) {
      setShowError(true);
      return;
    }
    addAssignee.mutate(
      { taskID, assignee: assigneeUUID, subtasks: includeSubtasks },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal open onClose={() => onClose()} size="lg">
      <TaskModalTitle
        parentTitle={isSubtask ? getTaskTitle(task?.parent) : undefined}
        taskTitle={title}
        action="Add Assignee"
      />
      <Modal.Body className="min-h-[18rem]">
        <p className="mb-6 text-lg">
          Select a user to assign to <em>{title}</em>.
        </p>
        <Select
          name="task-assignee"
          label="Task assignee"
          labelClassName="sr-only"
          placeholder="Select assignee..."
          options={options}
          value={assigneeUUID}
          onChange={(e) => {
            setAssigneeUUID(e.target.value);
            setShowError(false);
          }}
          disabled={addAssignee.isLoading}
          error={showError}
          errorMessage={showError ? "Select a user." : undefined}
          className={isSubtask ? "mb-4" : "mb-6"}
        />
        {!isSubtask && (
          <Checkbox
            name="assign-assignee-to-subtasks"
            checked={includeSubtasks}
            onChange={setIncludeSubtasks}
            label="Assign to all subtasks"
          />
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={addAssignee.isLoading}
            onClick={handleAdd}
            icon={<IconPlus size={18} />}
          >
            Add Assignee
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default AddTaskAssigneeModal;
