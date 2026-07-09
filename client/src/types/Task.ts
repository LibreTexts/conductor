export type TaskStatus = "available" | "inprogress" | "completed";

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
