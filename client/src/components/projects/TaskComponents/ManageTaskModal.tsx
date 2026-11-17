import { useState } from "react";
import { Button, Input, Modal, Textarea } from "@libretexts/davis-react";
import { IconChevronRight } from "@tabler/icons-react";
import useProjectTasks from "../../../hooks/useProjectTasks";
import useProjectTaskMutations from "../../../hooks/useProjectTaskMutations";

type ManageTaskModalProps = {
  projectID: string;
  onClose: () => void;
} & (
  | { mode: "add"; parentID?: string; taskID?: never }
  | { mode: "edit"; taskID: string; parentID?: never }
);

const ManageTaskModal: React.FC<ManageTaskModalProps> = (props) => {
  const { projectID, mode, onClose } = props;
  const { byID, getTaskTitle } = useProjectTasks(projectID);
  const { createTask, updateTask } = useProjectTaskMutations(projectID);

  const existing = mode === "edit" ? byID.get(props.taskID) : undefined;
  const parentID = mode === "edit" ? existing?.parent : props.parentID;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showTitleError, setShowTitleError] = useState(false);

  const isLoading = createTask.isLoading || updateTask.isLoading;

  const handleSubmit = () => {
    if (title.trim() === "") {
      setShowTitleError(true);
      return;
    }

    if (mode === "edit") {
      // Send only the fields that changed (or were never set), as the endpoint expects.
      updateTask.mutate(
        {
          projectID,
          taskID: props.taskID,
          ...(!existing?.title || existing.title !== title ? { title } : {}),
          ...(!existing?.description || existing.description !== description
            ? { description }
            : {}),
        },
        { onSuccess: onClose }
      );
      return;
    }

    createTask.mutate(
      {
        title,
        status: "available",
        ...(description.trim() !== "" ? { description } : {}),
        ...(parentID ? { parent: parentID } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      },
      { onSuccess: onClose }
    );
  };

  const taskLabel =
    mode === "add" ? (
      parentID ? "New Subtask" : "New Task"
    ) : (
      <>
        {!parentID && "Edit "}
        <em>{existing?.title ?? "Loading..."}</em>
      </>
    );

  return (
    <Modal open onClose={() => onClose()} size="md">
      <Modal.Header>
        <Modal.Title>
          <span className="flex min-w-0 items-center gap-3">
            {parentID && (
              <>
                <em className="truncate">{getTaskTitle(parentID)}</em>
                <IconChevronRight aria-hidden="true" className="shrink-0 text-gray-400" size={24} />
              </>
            )}
            <span className="truncate">{taskLabel}</span>
          </span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {mode === "add" && !parentID && (
          <p className="text-sm text-gray-600 mb-3 italic">
            To add a subtask, use the add button on a task listing.
          </p>
        )}
        <div className="flex flex-col gap-4">
          <Input
            name="task-title"
            label="Title"
            placeholder="Title..."
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setShowTitleError(false);
            }}
            error={showTitleError}
            errorMessage={showTitleError ? "Enter a task title." : undefined}
          />
          <Textarea
            name="task-description"
            label="Description"
            placeholder="Description..."
            helperText="Markdown formatting is supported."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
          />
          {mode === "add" && (
            <>
              <Input
                name="task-start-date"
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input
                name="task-end-date"
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" loading={isLoading} onClick={handleSubmit}>
          {mode === "add" ? (parentID ? "Add Subtask" : "Add Task") : "Save Changes"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ManageTaskModal;
