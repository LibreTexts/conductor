import { format, isValid, parse, parseISO } from "date-fns";
import {
  Project,
  ProjectTask,
  ProjectTaskView,
  TaskStatus,
} from "../types";
import { constructProjectTeam } from "../components/util/ProjectHelpers";

export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "inprogress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

const DISPLAY_DATE_FORMAT = "MMMM do, yyyy";

/**
 * Parses a task's date-only field ("YYYY-MM-DD", as stored by the server).
 */
export function parseTaskDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return isValid(parsed) ? parsed : undefined;
}

/**
 * Formats a Date into the date-only string the task endpoints expect.
 */
export function formatTaskDate(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

function compareByTitle(a: { title: string }, b: { title: string }) {
  if (a.title < b.title) return -1;
  if (a.title > b.title) return 1;
  return 0;
}

function isPastDue(endDate: Date | undefined, status: TaskStatus, now: Date) {
  return !!endDate && endDate <= now && status !== "completed";
}

function toTaskView(
  { subtasks: _rawSubtasks, ...task }: ProjectTask,
  now: Date,
  subtasks?: ProjectTaskView[]
): ProjectTaskView {
  const createdAtObj = task.createdAt ? parseISO(task.createdAt) : undefined;
  const startDateObj = parseTaskDate(task.startDate);
  const endDateObj = parseTaskDate(task.endDate);
  const validCreatedAt = createdAtObj && isValid(createdAtObj) ? createdAtObj : undefined;

  const selfOverdue = isPastDue(endDateObj, task.status, now);
  const overdue = selfOverdue || !!subtasks?.some((s) => s.overdue);

  return {
    ...task,
    assignees: Array.isArray(task.assignees) ? task.assignees : [],
    dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
    createdAtObj: validCreatedAt,
    createdAtString: validCreatedAt ? format(validCreatedAt, DISPLAY_DATE_FORMAT) : undefined,
    startDateObj,
    startDateString: startDateObj ? format(startDateObj, DISPLAY_DATE_FORMAT) : undefined,
    endDateObj,
    endDateString: endDateObj ? format(endDateObj, DISPLAY_DATE_FORMAT) : undefined,
    overdue,
    ...(subtasks ? { subtasks } : {}),
  };
}

export type NormalizedProjectTasks = {
  /** Top-level tasks sorted by title, each with its sorted subtasks. */
  tasks: ProjectTaskView[];
  /** Every task and subtask, top-level tasks first. */
  allTasks: ProjectTaskView[];
  byID: Map<string, ProjectTaskView>;
};

/**
 * Converts the GET /project/tasks response into UI-ready views. A parent task is
 * overdue if it or any of its subtasks is overdue. Does not mutate the input.
 */
export function normalizeProjectTasks(
  raw: ProjectTask[],
  now: Date = new Date()
): NormalizedProjectTasks {
  const tasks = raw
    .map((task) => {
      const subtasks = (task.subtasks ?? [])
        .filter((s) => !!s?.taskID)
        .map((s) => toTaskView(s, now))
        .sort(compareByTitle);
      return toTaskView(task, now, subtasks);
    })
    .sort(compareByTitle);

  const allTasks = [...tasks, ...tasks.flatMap((t) => t.subtasks ?? [])];
  const byID = new Map(allTasks.map((t) => [t.taskID, t]));

  return { tasks, allTasks, byID };
}

export type TaskSearchResult = {
  id: string;
  title: string;
  description?: string;
};

/**
 * Case-insensitive substring match over task titles and descriptions.
 */
export function searchTasks(
  allTasks: Pick<ProjectTask, "taskID" | "title" | "description">[],
  query: string
): TaskSearchResult[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return allTasks
    .filter((task) =>
      `${task.title ?? ""} ${task.description ?? ""}`
        .toLowerCase()
        .includes(needle)
    )
    .map((task) => ({
      id: task.taskID,
      title: task.title,
      description: task.description,
    }));
}

/**
 * Normalizes a task's dependencies (populated objects or bare IDs) to IDs.
 */
export function getDependencyIDs(task: Pick<ProjectTask, "dependencies">): string[] {
  return (task.dependencies ?? [])
    .map((dep) => (typeof dep === "string" ? dep : dep?.taskID))
    .filter((id): id is string => !!id);
}

/**
 * Tasks eligible to become a dependency of `task`: excludes the task itself,
 * its existing dependencies, and its parent.
 */
export function getDependencyCandidates(
  task: Pick<ProjectTask, "taskID" | "dependencies" | "parent">,
  allTasks: Pick<ProjectTask, "taskID" | "title">[]
): { value: string; label: string }[] {
  const excluded = new Set([task.taskID, ...getDependencyIDs(task)]);
  if (task.parent) excluded.add(task.parent);
  return allTasks
    .filter((t) => !!t.taskID && !excluded.has(t.taskID))
    .map((t) => ({ value: t.taskID, label: t.title }));
}

/**
 * Project team members who are not yet assigned to `task`.
 */
export function buildAssigneeOptions(
  project: Project,
  task: Pick<ProjectTask, "assignees">
): { value: string; label: string; avatar: string }[] {
  const currentAssignees = (task.assignees ?? [])
    .map((a) => (typeof a === "string" ? a : a?.uuid))
    .filter((uuid): uuid is string => !!uuid);

  return constructProjectTeam(project, currentAssignees)
    .filter(
      (member): member is Exclude<typeof member, string> =>
        typeof member === "object" &&
        !!member.uuid &&
        !!member.firstName &&
        !!member.lastName
    )
    .map((member) => ({
      value: member.uuid,
      label: `${member.firstName} ${member.lastName}`,
      avatar: member.avatar || "/mini_logo.png",
    }));
}
