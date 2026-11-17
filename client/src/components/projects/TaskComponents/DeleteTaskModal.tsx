import React from "react";
import { Button, Modal } from "@libretexts/davis-react";
import { IconTrash } from "@tabler/icons-react";
import useProjectTasks from "../../../hooks/useProjectTasks";
import useProjectTaskMutations from "../../../hooks/useProjectTaskMutations";
import TaskModalTitle from "./TaskModalTitle";

interface DeleteTaskModalProps {
  projectID: string;
  taskID: string;
  onClose: () => void;
  /** Called after a successful delete, in addition to onClose. */
  onDeleted?: () => void;
}

const DeleteTaskModal: React.FC<DeleteTaskModalProps> = ({
  projectID,
  taskID,
  onClose,
  onDeleted,
}) => {
  const { byID, getTaskTitle } = useProjectTasks(projectID);
  const { deleteTask } = useProjectTaskMutations(projectID);

  const task = byID.get(taskID);
  const title = task?.title ?? "Loading...";
  const isSubtask = !!task?.parent;
  const hasSubtasks = (task?.subtasks?.length ?? 0) > 0;

  const handleDelete = () => {
    deleteTask.mutate(taskID, {
      onSuccess: () => {
        onClose();
        onDeleted?.();
      },
    });
  };

  return (
    <Modal open onClose={() => onClose()} size="lg">
      <TaskModalTitle
        parentTitle={isSubtask ? getTaskTitle(task?.parent) : undefined}
        taskTitle={title}
        action="Delete"
      />
      <Modal.Body>
        <p className="text-lg">
          Are you sure you want to delete the <strong>{title}</strong>{" "}
          <span className="muted-text">(ID: {taskID})</span> task?
        </p>
        {hasSubtasks && (
          <p className="mt-4 text-center">
            <strong>All subtasks will also be deleted!</strong>
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={deleteTask.isLoading}
            onClick={handleDelete}
            icon={<IconTrash size={18} />}
          >
            Delete{isSubtask ? " Subtask" : " Task"}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default DeleteTaskModal;
