import { useState } from "react";
import { Button, Checkbox, Modal } from "@libretexts/davis-react";
import { IconCircleMinus } from "@tabler/icons-react";
import useProjectTasks from "../../../hooks/useProjectTasks";
import useProjectTaskMutations from "../../../hooks/useProjectTaskMutations";
import TaskModalTitle from "./TaskModalTitle";

interface RemoveTaskAssigneeModalProps {
  projectID: string;
  taskID: string;
  assignee: { uuid: string; name: string };
  onClose: () => void;
}

const RemoveTaskAssigneeModal: React.FC<RemoveTaskAssigneeModalProps> = ({
  projectID,
  taskID,
  assignee,
  onClose,
}) => {
  const { byID, getTaskTitle } = useProjectTasks(projectID);
  const { removeAssignee } = useProjectTaskMutations(projectID);
  const [includeSubtasks, setIncludeSubtasks] = useState(false);

  const task = byID.get(taskID);
  const title = task?.title ?? "Loading...";
  const isSubtask = !!task?.parent;

  const handleRemove = () => {
    removeAssignee.mutate(
      { taskID, assignee: assignee.uuid, subtasks: includeSubtasks },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal open onClose={() => onClose()} size="lg">
      <TaskModalTitle
        parentTitle={isSubtask ? getTaskTitle(task?.parent) : undefined}
        taskTitle={title}
        action="Remove Assignee"
      />
      <Modal.Body>
        <p className="text-lg">
          Are you sure you want to remove <strong>{assignee.name}</strong> as an assignee for{" "}
          <em>{title}</em>?
        </p>
        {!isSubtask && (
          <Checkbox
            name="remove-assignee-from-subtasks"
            checked={includeSubtasks}
            onChange={setIncludeSubtasks}
            label="Remove from all subtasks"
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
            variant="destructive"
            loading={removeAssignee.isLoading}
            onClick={handleRemove}
            icon={<IconCircleMinus size={18} />}
          >
            Remove Assignee
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default RemoveTaskAssigneeModal;
