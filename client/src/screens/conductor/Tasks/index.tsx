import { useMemo, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDocumentTitle } from "usehooks-ts";
import {
  EmptyState,
  Heading,
  Listbox,
  Progress,
  Spinner,
  StatCard,
  Tabs,
  Text,
} from "@libretexts/davis-react";
import {
  IconAlertTriangle,
  IconChecklist,
  IconClock,
  IconLoader2,
} from "@tabler/icons-react";
import api from "../../../api";
import useGlobalError from "../../../components/error/ErrorHooks";
import { TaskStatus, UserTask } from "../../../types";
import {
  TaskGroup,
  getTaskUrgency,
  groupTasksByDueDate,
  groupTasksByProject,
  groupTasksByStatus,
  sortTasksByDueDate,
  sortTasksByTitle,
} from "../../../utils/taskHelpers";
import TaskRow from "./TaskRow";
import AttentionBanner from "./AttentionBanner";

type StatFilter = "overdue" | "dueSoon" | "inprogress" | "completed" | null;
type GroupByOption = "none" | "project" | "status" | "dueDate";
type SortOption = "dueDate" | "title";

const GROUP_BY_TABS: { label: string; value: GroupByOption }[] = [
  { label: "None", value: "none" },
  { label: "Project", value: "project" },
  { label: "Status", value: "status" },
  { label: "Due Date", value: "dueDate" },
];

const SORT_LABELS: Record<SortOption, string> = {
  dueDate: "Due date",
  title: "Title (A–Z)",
};

function getGroupDonePercent(group: TaskGroup): number {
  if (group.tasks.length === 0) return 0;
  const done = group.tasks.filter((t) => t.status === "completed").length;
  return Math.round((done / group.tasks.length) * 100);
}

const MyTasksPage = () => {
  useDocumentTitle("LibreTexts Conductor | My Tasks");
  const { handleGlobalError } = useGlobalError();
  const queryClient = useQueryClient();

  const [activeFilter, setActiveFilter] = useState<StatFilter>(null);
  const [groupBy, setGroupBy] = useState<GroupByOption>("project");
  const [sortBy, setSortBy] = useState<SortOption>("dueDate");

  const { data, isLoading } = useQuery({
    queryKey: ["userTasks"],
    queryFn: async () => {
      const res = await api.getUserTasks();
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      return res.data.tasks;
    },
    meta: {
      errorMessage: "Failed to load your tasks.",
    },
  });

  const tasks = useMemo(() => data || [], [data]);

  const completeMutation = useMutation({
    mutationFn: async ({ taskID, status }: { taskID: string; status: TaskStatus }) => {
      const res = await axios.put("/project/task", { taskID, status });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      return { taskID, status };
    },
    onMutate: async ({ taskID, status }) => {
      await queryClient.cancelQueries({ queryKey: ["userTasks"] });
      const previous = queryClient.getQueryData<UserTask[]>(["userTasks"]);
      queryClient.setQueryData<UserTask[]>(["userTasks"], (old) =>
        (old || []).map((t) => (t.taskID === taskID ? { ...t, status } : t))
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["userTasks"], context.previous);
      }
      handleGlobalError(err);
    },
  });

  const counts = useMemo(() => {
    let overdue = 0;
    let dueSoon = 0;
    let inprogress = 0;
    let completed = 0;
    tasks.forEach((task) => {
      const urgency = getTaskUrgency(task);
      if (urgency === "overdue") overdue++;
      else if (urgency === "dueSoon") dueSoon++;
      if (task.status === "inprogress") inprogress++;
      if (task.status === "completed") completed++;
    });
    return { overdue, dueSoon, inprogress, completed };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (!activeFilter) return tasks;
    return tasks.filter((task) => {
      if (activeFilter === "overdue") return getTaskUrgency(task) === "overdue";
      if (activeFilter === "dueSoon") return getTaskUrgency(task) === "dueSoon";
      if (activeFilter === "inprogress") return task.status === "inprogress";
      if (activeFilter === "completed") return task.status === "completed";
      return true;
    });
  }, [tasks, activeFilter]);

  const sortedTasks = useMemo(() => {
    return sortBy === "title"
      ? sortTasksByTitle(filteredTasks)
      : sortTasksByDueDate(filteredTasks, "asc");
  }, [filteredTasks, sortBy]);

  const groups = useMemo((): TaskGroup[] => {
    if (groupBy === "project") return groupTasksByProject(sortedTasks);
    if (groupBy === "status") return groupTasksByStatus(sortedTasks);
    if (groupBy === "dueDate") return groupTasksByDueDate(sortedTasks);
    return [{ key: "all", label: "All tasks", tasks: sortedTasks }];
  }, [sortedTasks, groupBy]);

  function handleToggleComplete(task: UserTask, completed: boolean) {
    completeMutation.mutate({
      taskID: task.taskID,
      status: completed ? "completed" : "available",
    });
  }

  function handleStatClick(filter: StatFilter) {
    setActiveFilter((prev) => (prev === filter ? null : filter));
  }

  const statCards: {
    key: Exclude<StatFilter, null>;
    label: string;
    value: number;
    variant: "default" | "danger" | "warning" | "success";
    icon: React.ReactNode;
  }[] = [
    {
      key: "overdue",
      label: "Overdue",
      value: counts.overdue,
      variant: "danger",
      icon: <IconAlertTriangle size={18} />,
    },
    {
      key: "dueSoon",
      label: "Due Soon",
      value: counts.dueSoon,
      variant: "warning",
      icon: <IconClock size={18} />,
    },
    {
      key: "inprogress",
      label: "In Progress",
      value: counts.inprogress,
      variant: "default",
      icon: <IconLoader2 size={18} />,
    },
    {
      key: "completed",
      label: "Completed",
      value: counts.completed,
      variant: "success",
      icon: <IconChecklist size={18} />,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Heading level={1}>My Tasks</Heading>
      <Text color="muted" as="p" className="mt-1 mb-6">
        Every task assigned to you across all your projects.
      </Text>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map((stat) => (
          <button
            key={stat.key}
            type="button"
            onClick={() => handleStatClick(stat.key)}
            aria-pressed={activeFilter === stat.key}
            className={`rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              activeFilter === stat.key ? "ring-2 ring-primary rounded-lg" : ""
            }`}
          >
            <StatCard label={stat.label} value={stat.value} variant={stat.variant} icon={stat.icon} />
          </button>
        ))}
      </div>

      {!isLoading && <AttentionBanner tasks={tasks} />}

      {!isLoading && tasks.length > 0 && (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Text as="p" id="group-by-label" size="sm" weight="medium" className="mb-2">
              Group by
            </Text>
            <Tabs
              variant="pills"
              color="primary"
              selectedIndex={GROUP_BY_TABS.findIndex((tab) => tab.value === groupBy)}
              onChange={(index) => setGroupBy(GROUP_BY_TABS[index].value)}
            >
              <Tabs.List>
                {GROUP_BY_TABS.map((tab) => (
                  <Tabs.Tab key={tab.value}>{tab.label}</Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs>
          </div>
          <Listbox value={sortBy} onChange={(value) => setSortBy(value as SortOption)}>
            <Listbox.Label className="text-sm font-medium text-gray-700">
              Sort by
            </Listbox.Label>
            <Listbox.Button
              displayValue={(v) => SORT_LABELS[(v as SortOption) ?? "dueDate"]}
              aria-label="Sort tasks by"
              className="min-w-40"
            />
            <Listbox.Options>
              {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                <Listbox.Option key={option} value={option}>
                  {SORT_LABELS[option]}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Listbox>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" text="Loading your tasks..." />
        </div>
      )}

      {!isLoading && tasks.length === 0 && (
        <EmptyState
          icon={<IconChecklist size={40} />}
          title="No tasks assigned"
          description="You don't have any tasks assigned to you across your projects right now."
        />
      )}

      {!isLoading && tasks.length > 0 && sortedTasks.length === 0 && (
        <EmptyState
          icon={<IconChecklist size={40} />}
          title="No tasks match this filter"
          description="Try selecting a different summary filter above."
        />
      )}

      {!isLoading && sortedTasks.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse">
            <caption className="sr-only">Tasks assigned to you</caption>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th scope="col" className="w-10 py-2 pl-4 pr-2">
                  <span className="sr-only">Complete</span>
                </th>
                <th scope="col" className="py-2 pr-4">
                  Task
                </th>
                <th scope="col" className="py-2 pr-4">
                  Status
                </th>
                <th scope="col" className="py-2 pr-4">
                  Due
                </th>
                <th scope="col" className="py-2 pl-2 pr-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.key}>
                {groupBy !== "none" && (
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td colSpan={5} className="px-4 py-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <Text weight="semibold" size="sm">
                            {group.label}
                          </Text>
                          <Text size="xs" color="muted">
                            {group.tasks.length} task{group.tasks.length === 1 ? "" : "s"}
                          </Text>
                        </div>
                        {groupBy === "project" && (
                          <div className="flex min-w-[140px] items-center gap-2">
                            <Progress
                              value={getGroupDonePercent(group)}
                              size="sm"
                              className="w-24"
                              label={`${group.label} completion`}
                            />
                            <Text size="xs" color="muted">
                              {getGroupDonePercent(group)}%
                            </Text>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                {group.tasks.map((task) => (
                  <TaskRow
                    key={task.taskID}
                    task={task}
                    onToggleComplete={handleToggleComplete}
                    completing={
                      completeMutation.isLoading &&
                      completeMutation.variables?.taskID === task.taskID
                    }
                  />
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  );
};

export default MyTasksPage;
