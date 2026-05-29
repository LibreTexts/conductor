import { Button, Checkbox, Modal, Select } from "@libretexts/davis-react";
import { IconChevronRight, IconPlus } from "@tabler/icons-react";

interface AddTaskAssigneeModalProps {
  show: boolean;
  viewTaskData: any;
  ataUsers: any[];
  ataLoading: boolean;
  ataError: boolean;
  ataUUID: string;
  ataSubtasks: boolean;
  setATASubtasks: (newVal: boolean) => void;
  setATAUUID: (id: string) => void;
  openViewTaskModal: (id: string) => void;
  getParentTaskName: (id: string) => string;
  onRequestAdd: () => void;
  onClose: () => void;
}

const AddTaskAssigneeModal: React.FC<AddTaskAssigneeModalProps> = ({
  show,
  viewTaskData,
  ataUsers,
  ataLoading,
  ataError,
  ataUUID,
  ataSubtasks,
  setATASubtasks,
  setATAUUID,
  openViewTaskModal,
  getParentTaskName,
  onRequestAdd,
  onClose,
}) => {
  const title = viewTaskData.hasOwnProperty("title")
    ? viewTaskData.title
    : "Loading...";
  const parentTitle =
    viewTaskData.parent && viewTaskData.parent !== ""
      ? getParentTaskName(viewTaskData.parent)
      : "";
  const assigneeOptions = ataUsers.map((user) => ({
    value: String(user.value),
    label: String(user.text || user.label || user.value),
  }));

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
              <em>{title}</em>: Add Assignee
            </span>
          </span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="min-h-[18rem]">
        <p className="mb-6 text-lg">
          Select a user to assign to <em>{title}</em>.
        </p>
        <Select
          name="task-assignee"
          label="Task assignee"
          labelClassName="sr-only"
          placeholder="Select assignee..."
          options={assigneeOptions}
          value={ataUUID}
          onChange={(e) => setATAUUID(e.target.value)}
          disabled={ataLoading}
          error={ataError}
          className={!viewTaskData.parent || viewTaskData.parent === "" ? "mb-6" : "mb-4"}
        />
        {(!viewTaskData.parent || viewTaskData.parent === "") && (
          <Checkbox
            name="assign-assignee-to-subtasks"
            checked={ataSubtasks}
            onChange={setATASubtasks}
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
            loading={ataLoading}
            onClick={onRequestAdd}
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
