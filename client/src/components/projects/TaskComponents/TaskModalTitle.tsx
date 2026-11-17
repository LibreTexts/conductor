import { Modal } from "@libretexts/davis-react";
import { IconChevronRight } from "@tabler/icons-react";

interface TaskModalTitleProps {
  parentTitle?: string;
  taskTitle: string;
  action?: string;
}

/**
 * "Parent › Task: Action" title shared by the task action modals.
 */
const TaskModalTitle: React.FC<TaskModalTitleProps> = ({ parentTitle, taskTitle, action }) => (
  <Modal.Header>
    <Modal.Title>
      <span className="flex min-w-0 items-center gap-3">
        {parentTitle && (
          <>
            <em className="truncate">{parentTitle}</em>
            <IconChevronRight aria-hidden="true" className="shrink-0 text-gray-400" size={24} />
          </>
        )}
        <span className="truncate">
          <em>{taskTitle}</em>
          {action && `: ${action}`}
        </span>
      </span>
    </Modal.Title>
  </Modal.Header>
);

export default TaskModalTitle;
