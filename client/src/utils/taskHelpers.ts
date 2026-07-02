import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { TaskStatus, UserTask } from "../types";

export type TaskUrgency = "overdue" | "dueSoon" | "normal" | "none";

const DUE_SOON_WINDOW_DAYS = 7;

export function parseTaskDueDate(endDate?: string): Date | null {
  if (!endDate) return null;
  const parsed = parseISO(endDate);
  return isValid(parsed) ? parsed : null;
}

/**
 * Classifies a task's urgency relative to today. Completed tasks are never
 * overdue/due-soon since there's nothing left to act on.
 */
export function getTaskUrgency(task: Pick<UserTask, "status" | "endDate">): TaskUrgency {
  if (task.status === "completed") return "normal";

  const due = parseTaskDueDate(task.endDate);
  if (!due) return "none";

  const diff = differenceInCalendarDays(due, new Date());
  if (diff < 0) return "overdue";
  if (diff <= DUE_SOON_WINDOW_DAYS) return "dueSoon";
  return "normal";
}

export function formatDueDate(endDate?: string): string {
  const due = parseTaskDueDate(endDate);
  if (!due) return "No due date";

  const diff = differenceInCalendarDays(due, new Date());
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  if (diff <= DUE_SOON_WINDOW_DAYS) return `In ${diff} days`;
  return format(due, "MMM d, yyyy");
}

export function sortTasksByDueDate(tasks: UserTask[], direction: "asc" | "desc" = "asc"): UserTask[] {
  return [...tasks].sort((a, b) => {
    const aDate = parseTaskDueDate(a.endDate);
    const bDate = parseTaskDueDate(b.endDate);
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1; // tasks without a due date always sort last
    if (!bDate) return -1;
    const diff = aDate.getTime() - bDate.getTime();
    return direction === "asc" ? diff : -diff;
  });
}

export function sortTasksByTitle(tasks: UserTask[]): UserTask[] {
  return [...tasks].sort((a, b) => a.title.localeCompare(b.title));
}

export type TaskGroup = {
  key: string;
  label: string;
  tasks: UserTask[];
};

export function groupTasksByProject(tasks: UserTask[]): TaskGroup[] {
  const map = new Map<string, TaskGroup>();
  tasks.forEach((task) => {
    const key = task.project.projectID;
    if (!map.has(key)) {
      map.set(key, { key, label: task.project.title, tasks: [] });
    }
    map.get(key)?.tasks.push(task);
  });
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  available: "Available",
  inprogress: "In Progress",
  completed: "Completed",
};

const STATUS_GROUP_ORDER: TaskStatus[] = ["inprogress", "available", "completed"];

export function groupTasksByStatus(tasks: UserTask[]): TaskGroup[] {
  const map = new Map<string, TaskGroup>();
  tasks.forEach((task) => {
    const key = task.status;
    if (!map.has(key)) {
      map.set(key, { key, label: STATUS_LABELS[task.status] ?? task.status, tasks: [] });
    }
    map.get(key)?.tasks.push(task);
  });
  return STATUS_GROUP_ORDER.filter((status) => map.has(status)).map(
    (status) => map.get(status) as TaskGroup
  );
}

const DUE_DATE_GROUP_ORDER: TaskGroup[] = [
  { key: "overdue", label: "Overdue", tasks: [] },
  { key: "dueSoon", label: "Due Soon", tasks: [] },
  { key: "upcoming", label: "Upcoming", tasks: [] },
  { key: "noDueDate", label: "No Due Date", tasks: [] },
  { key: "completed", label: "Completed", tasks: [] },
];

/**
 * Groups by due-date urgency rather than the literal date, so tasks cluster
 * into the same buckets the summary stat cards use. Completed tasks always
 * land in their own bucket, regardless of their due date.
 */
export function groupTasksByDueDate(tasks: UserTask[]): TaskGroup[] {
  const buckets = new Map<string, TaskGroup>(
    DUE_DATE_GROUP_ORDER.map((group) => [group.key, { ...group, tasks: [] }])
  );
  tasks.forEach((task) => {
    if (task.status === "completed") {
      buckets.get("completed")?.tasks.push(task);
      return;
    }
    const urgency = getTaskUrgency(task);
    if (urgency === "overdue") buckets.get("overdue")?.tasks.push(task);
    else if (urgency === "dueSoon") buckets.get("dueSoon")?.tasks.push(task);
    else if (urgency === "none") buckets.get("noDueDate")?.tasks.push(task);
    else buckets.get("upcoming")?.tasks.push(task);
  });
  return DUE_DATE_GROUP_ORDER.map((group) => buckets.get(group.key) as TaskGroup).filter(
    (group) => group.tasks.length > 0
  );
}
