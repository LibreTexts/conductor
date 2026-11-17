import { User } from "./User";

export type TaskStatus = "available" | "inprogress" | "completed";

export type ProjectTaskAssignee = Pick<User, "uuid" | "firstName" | "lastName" | "avatar">;

/**
 * Minimal task reference as populated in another task's dependencies/blocking lists.
 */
export type ProjectTaskRef = Pick<ProjectTask, "taskID" | "title" | "status">;

/**
 * A task as returned by GET /project/tasks. Top-level tasks carry their subtasks inline.
 */
export type ProjectTask = {
  taskID: string;
  projectID: string;
  title: string;
  description?: string;
  status: TaskStatus;
  parent?: string;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  assignees: ProjectTaskAssignee[];
  dependencies: (string | ProjectTaskRef)[];
  blocking?: ProjectTaskRef[];
  subtasks?: ProjectTask[];
};

/**
 * A ProjectTask with UI-ready dates and computed overdue state. Produced by
 * normalizeProjectTasks without mutating the server response.
 */
export type ProjectTaskView = Omit<ProjectTask, "subtasks"> & {
  createdAtObj?: Date;
  createdAtString?: string;
  startDateObj?: Date;
  startDateString?: string;
  endDateObj?: Date;
  endDateString?: string;
  overdue: boolean;
  subtasks?: ProjectTaskView[];
};

/**
 * A task as returned by GET /user/tasks — includes just enough of the parent
 * project's info to render a row without an additional lookup.
 */
export type UserTask = {
  orgID: string;
  projectID: string;
  taskID: string;
  title: string;
  status: TaskStatus;
  assignees: string[];
  parent?: string;
  dependencies: string[];
  /** True when one or more dependency tasks aren't marked completed yet. */
  blocked: boolean;
  startDate?: string;
  endDate?: string;
  createdBy?: string;
  createdAt?: string;
  project: {
    projectID: string;
    title: string;
  };
};
