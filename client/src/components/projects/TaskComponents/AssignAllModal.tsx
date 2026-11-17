import { useState } from "react";
import { Button, Checkbox, Modal } from "@libretexts/davis-react";
import { IconPlus } from "@tabler/icons-react";
import useProjectTasks from "../../../hooks/useProjectTasks";
import useProjectTaskMutations from "../../../hooks/useProjectTaskMutations";
import TaskModalTitle from "./TaskModalTitle";

interface AssignAllModalProps {
  projectID: string;
  taskID: string;
  onClose: () => void;
  /** Called after a successful assignment, in addition to onClose. */
  onAssigned?: () => void;
}

const AssignAllModal: React.FC<AssignAllModalProps> = ({
  projectID,
  taskID,
  onClose,
  onAssigned,
}) => {
  const { byID, getTaskTitle } = useProjectTasks(projectID);
  const { addAllAssignees } = useProjectTaskMutations(projectID);
  const [includeSubtasks, setIncludeSubtasks] = useState(false);

  const task = byID.get(taskID);
  const title = task?.title ?? "Loading...";
  const isSubtask = !!task?.parent;

  const handleAssignAll = () => {
    addAllAssignees.mutate(
      { taskID, subtasks: includeSubtasks },
      {
        onSuccess: () => {
          onClose();
          onAssigned?.();
        },
      }
    );
  };

  return (
    <Modal open onClose={() => onClose()} size="lg">
      <TaskModalTitle
        parentTitle={isSubtask ? getTaskTitle(task?.parent) : undefined}
        taskTitle={title}
        action="Assign All Members to Task"
      />
      <Modal.Body>
        <p className="text-lg">
          Are you sure you want to assign all members of this project to <em>{title}</em>?
        </p>
        {!isSubtask && (
          <Checkbox
            name="assign-all-subtasks"
            checked={includeSubtasks}
            onChange={setIncludeSubtasks}
            label="Assign to all subtasks"
            className="mt-6"
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
            loading={addAllAssignees.isLoading}
            onClick={handleAssignAll}
            icon={<IconPlus size={18} />}
          >
            Assign All
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default AssignAllModal;
