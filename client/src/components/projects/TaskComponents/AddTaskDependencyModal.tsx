import { Button, Modal, Select } from "@libretexts/davis-react";
import { IconChevronRight, IconPlus } from "@tabler/icons-react";

interface AddTaskDependencyModalProps {
  show: boolean;
  viewTaskData: any;
  atdTasks: any[];
  atdLoading: boolean;
  atdError: boolean;
  atdTaskID: string;
  setATDTaskID: (id: string) => void;
  openViewTaskModal: (id: string) => void;
  getParentTaskName: (id: string) => string;
  onRequestAdd: () => void;
  onClose: () => void;
}

const AddTaskDependencyModal: React.FC<AddTaskDependencyModalProps> = ({
  show,
  viewTaskData,
  atdTasks,
  atdLoading,
  atdError,
  atdTaskID,
  setATDTaskID,
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
  const taskOptions = atdTasks.map((task) => ({
    value: String(task.value),
    label: String(task.text || task.label || task.value),
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
              <em>{title}</em>: Add Dependency
            </span>
          </span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="min-h-[18rem]">
        <p className="mb-6 text-lg">
          Select a task to add as a dependency for <em>{title}</em>.
        </p>
        <Select
          name="task-dependency"
          label="Task dependency"
          labelClassName="sr-only"
          placeholder="Select task..."
          options={taskOptions}
          value={atdTaskID}
          onChange={(e) => setATDTaskID(e.target.value)}
          disabled={atdLoading}
          error={atdError}
        />
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={atdLoading}
            onClick={onRequestAdd}
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
