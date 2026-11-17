/**
 * ModalContext ids for the project task modals. Stable ids let nested modals
 * (e.g. Add Assignee over View Task) close independently.
 */
export const TASK_MODAL_IDS = {
  view: "project-task-view",
  manage: "project-task-manage",
  delete: "project-task-delete",
  batchAdd: "project-task-batch-add",
  addAssignee: "project-task-add-assignee",
  removeAssignee: "project-task-remove-assignee",
  assignAll: "project-task-assign-all",
  addDependency: "project-task-add-dependency",
  removeDependency: "project-task-remove-dependency",
} as const;
