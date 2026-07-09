import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IconAlertTriangle, IconLock, IconX } from "@tabler/icons-react";
import { UserTask } from "../../../types";
import { formatDueDate, getTaskUrgency } from "../../../utils/taskHelpers";

type AttentionReason = "overdue" | "dueSoon" | "blocked";

type AttentionTask = {
  task: UserTask;
  reasons: AttentionReason[];
};

const MAX_VISIBLE_CHIPS = 4;

function joinWithAnd(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

interface AttentionBannerProps {
  tasks: UserTask[];
}

/**
 * Dismissible "needs your attention" banner surfacing overdue, due-soon, and
 * blocked (has an incomplete dependency) tasks — always reflects the full
 * task set, independent of the summary-card quick filter below it.
 */
const AttentionBanner: React.FC<AttentionBannerProps> = ({ tasks }) => {
  const [dismissed, setDismissed] = useState(false);

  const attentionTasks = useMemo((): AttentionTask[] => {
    return tasks.reduce<AttentionTask[]>((acc, task) => {
      if (task.status === "completed") return acc;

      const urgency = getTaskUrgency(task);
      const reasons: AttentionReason[] = [];
      if (urgency === "overdue") reasons.push("overdue");
      if (urgency === "dueSoon") reasons.push("dueSoon");
      if (task.blocked) reasons.push("blocked");

      if (reasons.length > 0) acc.push({ task, reasons });
      return acc;
    }, []);
  }, [tasks]);

  const overdueCount = attentionTasks.filter((t) => t.reasons.includes("overdue")).length;
  const dueSoonCount = attentionTasks.filter((t) => t.reasons.includes("dueSoon")).length;
  const blockedCount = attentionTasks.filter((t) => t.reasons.includes("blocked")).length;

  if (dismissed || attentionTasks.length === 0) return null;

  const countParts: string[] = [];
  if (overdueCount > 0) countParts.push(`${overdueCount} overdue`);
  if (dueSoonCount > 0) countParts.push(`${dueSoonCount} due soon`);
  if (blockedCount > 0) countParts.push(`${blockedCount} blocked`);

  const visibleTasks = attentionTasks.slice(0, MAX_VISIBLE_CHIPS);
  const hiddenCount = attentionTasks.length - visibleTasks.length;

  return (
    <div
      role="alert"
      className="mb-6 rounded-lg border border-warning-200 bg-warning-50 p-4"
    >
      <div className="flex items-start gap-3">
        <IconAlertTriangle
          size={20}
          className="mt-0.5 flex-shrink-0 text-warning-600"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-warning-800">
            {joinWithAnd(countParts)} task{attentionTasks.length === 1 ? "" : "s"} need
            {attentionTasks.length === 1 ? "s" : ""} your attention.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {visibleTasks.map(({ task, reasons }) => {
              const primaryReason: AttentionReason = reasons.includes("overdue")
                ? "overdue"
                : reasons.includes("dueSoon")
                ? "dueSoon"
                : "blocked";

              return (
                <Link
                  key={task.taskID}
                  to={`/projects/${task.project.projectID}?openTask=${task.taskID}`}
                  className="inline-flex max-w-xs items-center gap-2 rounded-md border border-warning-200 bg-white px-2.5 py-1.5 text-sm text-gray-900 hover:border-warning-300 hover:bg-warning-50"
                >
                  {primaryReason === "blocked" ? (
                    <IconLock size={13} className="flex-shrink-0 text-gray-500" aria-hidden="true" />
                  ) : (
                    <span
                      className={`h-2 w-2 flex-shrink-0 rounded-sm ${
                        primaryReason === "overdue" ? "bg-danger-500" : "bg-warning-500"
                      }`}
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate">{task.title}</span>
                  <span
                    className={`flex-shrink-0 text-xs font-semibold ${
                      primaryReason === "overdue"
                        ? "text-danger-600"
                        : primaryReason === "dueSoon"
                        ? "text-warning-700"
                        : "text-gray-500"
                    }`}
                  >
                    {primaryReason === "blocked" ? "Blocked" : formatDueDate(task.endDate)}
                  </span>
                </Link>
              );
            })}
            {hiddenCount > 0 && (
              <span className="inline-flex items-center rounded-md border border-warning-200 bg-white px-2.5 py-1.5 text-sm text-gray-600">
                +{hiddenCount} more
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss attention banner"
          className="flex-shrink-0 rounded p-1 text-warning-700 hover:bg-warning-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <IconX size={16} />
        </button>
      </div>
    </div>
  );
};

export default AttentionBanner;
