import React from "react";
import { Button, Modal } from "@libretexts/davis-react";
import { IconChevronRight, IconTrash } from "@tabler/icons-react";

interface DeleteTaskModalProps {
  show: boolean;
  delTaskSubtask: boolean;
  delTaskParent: string;
  delTaskData: any;
  delTaskHasSubtasks: boolean;
  delTaskLoading: boolean;
  getParentTaskName: (id: string) => string;
  onRequestDelete: () => void;
  onClose: () => void;
}

const DeleteTaskModal: React.FC<DeleteTaskModalProps> = ({
  show,
  delTaskSubtask,
  delTaskParent,
  delTaskData,
  delTaskHasSubtasks,
  delTaskLoading,
  getParentTaskName,
  onRequestDelete,
  onClose,
}) => {
  const title = delTaskData.title || "Loading...";

  return (
    <Modal open={show} onClose={() => onClose()} size="lg">
      <Modal.Header>
        <Modal.Title>
          <span className="flex min-w-0 items-center gap-3">
            {delTaskSubtask && delTaskParent !== "" && (
              <>
                <em className="truncate">{getParentTaskName(delTaskParent)}</em>
                <IconChevronRight className="shrink-0 text-gray-400" size={30} />
              </>
            )}
            <span className="truncate">
              Delete <em>{title}</em>
            </span>
          </span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-lg">
          Are you sure you want to delete the <strong>{delTaskData.title}</strong>{" "}
          <span className="muted-text">(ID: {delTaskData.taskID})</span> task?
        </p>
        {delTaskHasSubtasks && (
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
            loading={delTaskLoading}
            onClick={onRequestDelete}
            icon={<IconTrash size={18} />}
          >
            Delete{delTaskSubtask ? " Subtask" : " Task"}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default DeleteTaskModal;
