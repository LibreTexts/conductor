import { Link } from "react-router-dom";
import { Badge, Text } from "@libretexts/davis-react";
import { IconExternalLink } from "@tabler/icons-react";
import { UserTask } from "../../../types";
import { getTaskStatusText } from "../../../components/util/ProjectHelpers";
import { formatDueDate, getTaskUrgency } from "../../../utils/taskHelpers";
import { GroupByOption } from "./index";
import { truncateString } from "../../../components/util/HelperFunctions";

const STATUS_BADGE_VARIANT: Record<UserTask["status"], "default" | "primary" | "success"> = {
  available: "default",
  inprogress: "primary",
  completed: "success",
};

interface TaskRowProps {
  task: UserTask;
  groupedBy: GroupByOption;
}

const TaskRow: React.FC<TaskRowProps> = ({ task, groupedBy }) => {
  // Deep-links into the project's own task modal (ProjectView.jsx reads this
  // query param and calls its existing openViewTaskModal) instead of
  // reimplementing the modal wiring here.
  const taskLink = `/projects/${task.project.projectID}?openTask=${task.taskID}`;
  const urgency = getTaskUrgency(task);
  const isCompleted = task.status === "completed";

  const dueDateColor =
    urgency === "overdue"
      ? "danger"
      : urgency === "dueSoon"
        ? "warning"
        : urgency === "none"
          ? "muted"
          : "default";

  return (
    <tr className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
      <td className="min-w-0 py-3 pl-4 pr-4 align-top">
        <Link
          to={taskLink}
          className={`text-base font-medium text-gray-900 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isCompleted ? "line-through text-gray-400" : ""
            }`}
        >
          {truncateString(task.title, 100)}
        </Link>
      </td>
      {
        groupedBy !== "project" && (
          <td className="py-3 pr-4 align-top whitespace-nowrap">
            <Link
              to={`/projects/${task.project.projectID}`}
              className="text-gray-500 hover:text-primary hover:underline"
            >
              {truncateString(task.project.title, 40)}
            </Link>
          </td>
        )
      }
      <td className="py-3 pr-4 align-top whitespace-nowrap">
        <Badge
          label={getTaskStatusText(task.status)}
          variant={STATUS_BADGE_VARIANT[task.status]}
        />
      </td>
      <td className="py-3 pr-4 align-top whitespace-nowrap">
        <Text size="sm" color={dueDateColor} weight={urgency === "overdue" || urgency === "dueSoon" ? "semibold" : "normal"}>
          {formatDueDate(task.endDate)}
        </Text>
      </td>
      <td className="py-3 pl-2 pr-4 align-top text-right">
        <Link
          to={taskLink}
          aria-label={`Open task: ${task.title}`}
          className="inline-flex size-8 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <IconExternalLink size={16} />
        </Link>
      </td>
    </tr>
  );
};

export default TaskRow;
