import { Button, Modal } from "@libretexts/davis-react";
import { IconCircleMinus } from "@tabler/icons-react";
import useProjectTasks from "../../../hooks/useProjectTasks";
import useProjectTaskMutations from "../../../hooks/useProjectTaskMutations";
import { getDependencyIDs } from "../../../utils/projectTaskHelpers";
import { ProjectTaskRef } from "../../../types";
import TaskModalTitle from "./TaskModalTitle";

interface RemoveTaskDependencyModalProps {
  projectID: string;
  taskID: string;
  dependency: ProjectTaskRef;
  onClose: () => void;
}

const RemoveTaskDependencyModal: React.FC<RemoveTaskDependencyModalProps> = ({
  projectID,
  taskID,
  dependency,
  onClose,
}) => {
  const { byID, getTaskTitle } = useProjectTasks(projectID);
  const { updateTask } = useProjectTaskMutations(projectID);

  const task = byID.get(taskID);
  const title = task?.title ?? "Loading...";
  const dependencyTitle = dependency.title || "Unknown Task";

  const handleRemove = () => {
    if (!task) return;
    updateTask.mutate(
      {
        taskID,
        dependencies: getDependencyIDs(task).filter((id) => id !== dependency.taskID),
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal open onClose={() => onClose()} size="lg">
      <TaskModalTitle
        parentTitle={task?.parent ? getTaskTitle(task.parent) : undefined}
        taskTitle={title}
        action="Remove Dependency"
      />
      <Modal.Body>
        <p className="text-lg">
          Are you sure you want to remove <em>{dependencyTitle}</em> as a dependency of{" "}
          <em>{title}</em>?
        </p>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={updateTask.isLoading}
            onClick={handleRemove}
            icon={<IconCircleMinus size={18} />}
          >
            Remove Dependency
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default RemoveTaskDependencyModal;
