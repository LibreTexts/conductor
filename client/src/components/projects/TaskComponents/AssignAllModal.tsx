import { Button, Checkbox, Modal } from "@libretexts/davis-react";
import { IconChevronRight, IconPlus } from "@tabler/icons-react";

interface AssignAllModalProps {
  show: boolean;
  viewTaskData: any;
  assignAllError: boolean;
  assignAllLoading: boolean;
  assignAllSubtasks: boolean;
  setAssignAllSubtasks: (newVal: boolean) => void;
  openViewTaskModal: (id: string) => void;
  getParentTaskName: (id: string) => string;
  onRequestAssignAll: () => void;
  onClose: () => void;
}

const AssignAllModal: React.FC<AssignAllModalProps> = ({
  show,
  viewTaskData,
  assignAllLoading,
  assignAllSubtasks,
  setAssignAllSubtasks,
  openViewTaskModal,
  getParentTaskName,
  onRequestAssignAll,
  onClose,
}) => {
  const title = viewTaskData.hasOwnProperty("title")
    ? viewTaskData.title
    : "Loading...";
  const parentTitle =
    viewTaskData.parent && viewTaskData.parent !== ""
      ? getParentTaskName(viewTaskData.parent)
      : "";

  return (
    <Modal open={show} onClose={() => onClose()} size="lg">
      <Modal.Header>
        <Modal.Title>
          <span className="flex min-w-0 items-center gap-3">
            {parentTitle && (
              <>
                <button
                  type="button"
                  className="truncate text-left text-blue-700 hover:underline"
                  onClick={() => openViewTaskModal(viewTaskData.parent)}
                >
                  {parentTitle}
                </button>
                <IconChevronRight className="shrink-0 text-gray-400" size={30} />
              </>
            )}
            <span className="truncate">
              <em>{title}</em>: Assign All Members to Task
            </span>
          </span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-lg">
          Are you sure you want to assign all members of this project to{" "}
          <em>{title}</em>?
        </p>
        {(!viewTaskData.parent || viewTaskData.parent === "") && (
          <Checkbox
            name="assign-all-subtasks"
            checked={assignAllSubtasks}
            onChange={setAssignAllSubtasks}
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
            loading={assignAllLoading}
            onClick={onRequestAssignAll}
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
