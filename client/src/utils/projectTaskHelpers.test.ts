import { describe, it, expect } from "vitest";
import {
  buildAssigneeOptions,
  getDependencyCandidates,
  getDependencyIDs,
  normalizeProjectTasks,
  searchTasks,
} from "./projectTaskHelpers";
import type { Project, ProjectTask } from "../types";

const task = (overrides: Partial<ProjectTask>): ProjectTask => ({
  taskID: "t",
  projectID: "p",
  title: "Task",
  status: "available",
  assignees: [],
  dependencies: [],
  ...overrides,
});

const NOW = new Date(2026, 5, 15);

describe("normalizeProjectTasks", () => {
  it("sorts tasks and subtasks by title and flattens them top-level first", () => {
    const raw = [
      task({
        taskID: "b",
        title: "Bravo",
        subtasks: [
          task({ taskID: "b2", title: "Zulu", parent: "b" }),
          task({ taskID: "b1", title: "Alpha sub", parent: "b" }),
        ],
      }),
      task({ taskID: "a", title: "Alpha" }),
    ];
    const { tasks, allTasks, byID } = normalizeProjectTasks(raw, NOW);
    expect(tasks.map((t) => t.taskID)).toEqual(["a", "b"]);
    expect(tasks[1].subtasks?.map((t) => t.taskID)).toEqual(["b1", "b2"]);
    expect(allTasks.map((t) => t.taskID)).toEqual(["a", "b", "b1", "b2"]);
    expect(byID.get("b1")).toBe(tasks[1].subtasks?.[0]);
  });

  it("marks past-due incomplete tasks overdue and propagates subtask overdue to the parent", () => {
    const raw = [
      task({ taskID: "done", title: "Done", endDate: "2026-01-01", status: "completed" }),
      task({ taskID: "late", title: "Late", endDate: "2026-01-01" }),
      task({ taskID: "future", title: "Future", endDate: "2027-01-01" }),
      task({
        taskID: "parent",
        title: "Parent",
        subtasks: [task({ taskID: "child", title: "Child", parent: "parent", endDate: "2026-01-01" })],
      }),
    ];
    const { byID } = normalizeProjectTasks(raw, NOW);
    expect(byID.get("done")?.overdue).toBe(false);
    expect(byID.get("late")?.overdue).toBe(true);
    expect(byID.get("future")?.overdue).toBe(false);
    expect(byID.get("child")?.overdue).toBe(true);
    expect(byID.get("parent")?.overdue).toBe(true);
  });

  it("formats date-only fields for display", () => {
    const { byID } = normalizeProjectTasks([task({ startDate: "2026-03-01" })], NOW);
    expect(byID.get("t")?.startDateString).toBe("March 1st, 2026");
    expect(byID.get("t")?.startDateObj?.getDate()).toBe(1);
  });

  it("does not mutate the input", () => {
    const raw = [
      task({
        taskID: "b",
        title: "B",
        subtasks: [task({ taskID: "y", title: "Y" }), task({ taskID: "x", title: "X" })],
      }),
      task({ taskID: "a", title: "A" }),
    ];
    const snapshot = JSON.parse(JSON.stringify(raw));
    normalizeProjectTasks(raw, NOW);
    expect(raw).toEqual(snapshot);
  });
});

describe("searchTasks", () => {
  const tasks = [
    task({ taskID: "1", title: "Write Chapter (1)", description: "Draft intro" }),
    task({ taskID: "2", title: "Review [final]" }),
  ];

  it("treats regex metacharacters literally", () => {
    expect(() => searchTasks(tasks, "(")).not.toThrow();
    expect(searchTasks(tasks, "(1)").map((r) => r.id)).toEqual(["1"]);
    expect(searchTasks(tasks, "[").map((r) => r.id)).toEqual(["2"]);
  });

  it("matches case-insensitively across title and description", () => {
    expect(searchTasks(tasks, "WRITE").map((r) => r.id)).toEqual(["1"]);
    expect(searchTasks(tasks, "Intro").map((r) => r.id)).toEqual(["1"]);
  });

  it("returns nothing for a blank query", () => {
    expect(searchTasks(tasks, "   ")).toEqual([]);
  });
});

describe("getDependencyIDs", () => {
  it("normalizes populated and bare dependencies", () => {
    expect(
      getDependencyIDs({
        dependencies: ["a", { taskID: "b", title: "B", status: "available" }],
      })
    ).toEqual(["a", "b"]);
  });
});

describe("getDependencyCandidates", () => {
  it("excludes the task, its dependencies, and its parent", () => {
    const all = ["self", "dep1", "dep2", "parent", "other"].map((id) =>
      task({ taskID: id, title: id })
    );
    const current = task({
      taskID: "self",
      parent: "parent",
      dependencies: ["dep1", { taskID: "dep2", title: "dep2", status: "available" }],
    });
    expect(getDependencyCandidates(current, all)).toEqual([{ value: "other", label: "other" }]);
  });
});

describe("buildAssigneeOptions", () => {
  it("lists team members not already assigned", () => {
    const member = (uuid: string) => ({ uuid, firstName: uuid, lastName: "X", avatar: "" });
    const project = {
      leads: [member("lead")],
      liaisons: [],
      members: [member("m1"), member("m2")],
      auditors: [],
    } as unknown as Project;
    const options = buildAssigneeOptions(project, { assignees: [member("m1")] });
    expect(options.map((o) => o.value)).toEqual(["lead", "m2"]);
    expect(options[0].avatar).toBe("/mini_logo.png");
  });
});
