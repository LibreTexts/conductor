import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../api";
import useGlobalError from "../components/error/ErrorHooks";
import { ConductorBaseResponse } from "../types";
import { projectTasksQueryKey } from "./useProjectTasks";

type Args<K extends keyof typeof api> = (typeof api)[K] extends (arg: infer A) => any ? A : never;

async function ensureOK(request: Promise<AxiosResponse<ConductorBaseResponse>>) {
  const res = await request;
  if (res.data.err) {
    throw new Error(res.data.errMsg);
  }
  return res.data;
}

/**
 * Every task write for a project. Each mutation surfaces failures through the
 * global error handler and refreshes the project's task list on success.
 */
const useProjectTaskMutations = (projectID: string) => {
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();

  const options = {
    onError: (err: unknown) => handleGlobalError(err),
    onSuccess: () => queryClient.invalidateQueries(projectTasksQueryKey(projectID)),
  };

  const createTask = useMutation({
    mutationFn: (data: Omit<Args<"createTask">, "projectID">) =>
      ensureOK(api.createTask({ ...data, projectID })),
    ...options,
  });

  const updateTask = useMutation({
    mutationFn: (data: Args<"updateTask">) => ensureOK(api.updateTask(data)),
    ...options,
  });

  const deleteTask = useMutation({
    mutationFn: (taskID: string) => ensureOK(api.deleteTask(taskID)),
    ...options,
  });

  const batchAddTasks = useMutation({
    mutationFn: (data: Omit<Args<"batchAddTasks">, "projectID">) =>
      ensureOK(api.batchAddTasks({ ...data, projectID })),
    ...options,
  });

  const addAssignee = useMutation({
    mutationFn: (data: Omit<Args<"addTaskAssignee">, "projectID">) =>
      ensureOK(api.addTaskAssignee({ ...data, projectID })),
    ...options,
  });

  const addAllAssignees = useMutation({
    mutationFn: (data: Omit<Args<"addAllTaskAssignees">, "projectID">) =>
      ensureOK(api.addAllTaskAssignees({ ...data, projectID })),
    ...options,
  });

  const removeAssignee = useMutation({
    mutationFn: (data: Omit<Args<"removeTaskAssignee">, "projectID">) =>
      ensureOK(api.removeTaskAssignee({ ...data, projectID })),
    ...options,
  });

  return {
    createTask,
    updateTask,
    deleteTask,
    batchAddTasks,
    addAssignee,
    addAllAssignees,
    removeAssignee,
  };
};

export default useProjectTaskMutations;
