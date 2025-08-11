import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import api from "../../../api";
import { User } from "../../../types";
import { useMemo } from "react";
import useGlobalError from "../../error/ErrorHooks";
import { useNotifications } from "../../../context/NotificationContext";

type FolderAndProject = {
  folderName: string;
  projectID: string;
};

export const alphabetize = (items: User["pinnedProjects"]) => {
  // alphabetize the folders based on the folder name with localeCompare
  if (!items) return [];
  items?.sort((a, b) => {
    if (typeof a.folder === "string" && typeof b.folder === "string") {
      return a.folder.localeCompare(b.folder);
    }
    return 0;
  });
  // alphabetize the projects inside each folder based on the project title with localeCompare
  items?.forEach((item) => {
    item.projects?.sort((a, b) => {
      if (typeof a === "string" && typeof b === "string") {
        return a.localeCompare(b);
      }
      if (typeof a === "object" && typeof b === "object") {
        if ("title" in a && "title" in b) {
          return a.title.localeCompare(b.title);
        }
      }
      return 0;
    });
  });
  return items;
};

export function usePinnedProjects() {
  return useQuery<User["pinnedProjects"]>({
    queryFn: async () => {
      const res = await api.getPinnedProjects();
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      const alphabetized = alphabetize(res.data.pinned);
      return alphabetized;
    },
    queryKey: ["pinnedProjects"],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useIsProjectPinned(projectID: any, deps: any[] = []) {
  if (typeof projectID !== "string") return false;
  const { data: pinnedProjects } = usePinnedProjects();
  return useMemo(() => {
    return pinnedProjects?.some((folder) =>
      folder.projects?.some((project) => {
        if (typeof project === "string") return project === projectID;
        return project.projectID === projectID;
      })
    );
  }, [pinnedProjects, projectID, ...deps]);
}

export function useAddFolderMutation() {
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();

  return useMutation({
    mutationFn: async (folderName: string) => {
      const res = await api.updateUserPinnedProjects({
        action: "add-folder",
        folder: folderName.trim(),
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      // Optimistically update the local state
      const previousData = queryClient.getQueryData(["pinnedProjects"]);
      if (previousData) {
        queryClient.setQueryData(["pinnedProjects"], (oldData: any) =>
          alphabetize([
            ...oldData,
            {
              folder: folderName,
              projects: [],
            },
          ])
        );
      }
    },
    onSuccess: () => {
      addNotification({
        message: "Folder created.",
        type: "success",
      });
    },
    onSettled: () => queryClient.invalidateQueries(["pinnedProjects"]),
    onError(error, variables, context) {
      handleGlobalError(error);
    },
  });
}

export function useRemoveFolderMutation() {
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();

  return useMutation({
    mutationFn: async (folderName: string) => {
      const res = await api.updateUserPinnedProjects({
        action: "remove-folder",
        folder: folderName.trim(),
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      // Optimistically update the local state
      const previousData = queryClient.getQueryData(["pinnedProjects"]);
      if (previousData) {
        queryClient.setQueryData(["pinnedProjects"], (oldData: any) =>
          alphabetize(oldData.filter((item: any) => item.folder !== folderName))
        );
      }
    },
    onSuccess: () => {
      addNotification({
        message: "Folder removed.",
        type: "success",
      });
    },
    onSettled: () => queryClient.invalidateQueries(["pinnedProjects"]),
    onError(error, variables, context) {
      handleGlobalError(error);
    },
  });
}

export function usePinProjectMutation() {
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();

  return useMutation({
    mutationFn: async ({ folderName, projectID }: FolderAndProject) => {
      if (!folderName || !projectID) {
        throw new Error("Folder name and project ID are required");
      }

      const res = await api.updateUserPinnedProjects({
        action: "add-project",
        folder: folderName,
        projectID,
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      // Optimistically update the local state
      const previousData = queryClient.getQueryData(["pinnedProjects"]);
      if (previousData) {
        queryClient.setQueryData(["pinnedProjects"], (oldData: any) =>
          alphabetize(
            oldData.map((item: any) => {
              if (item.folder === folderName) {
                return {
                  ...item,
                  projects: [...(item.projects || []), projectID],
                };
              }
              return item;
            })
          )
        );
      }
    },
    onSuccess: () => {
      addNotification({
        message: "Project pinned successfully.",
        type: "success",
      });
    },
    onSettled: () => queryClient.invalidateQueries(["pinnedProjects"]),
    onError(error, variables, context) {
      handleGlobalError(error);
    },
  });
}

export function useUnpinProjectMutation() {
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();

  return useMutation({
    mutationFn: async (projectID: string) => {
      const res = await api.updateUserPinnedProjects({
        action: "remove-project",
        projectID,
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      // Optimistically update the local state
      const previousData = queryClient.getQueryData(["pinnedProjects"]);
      if (previousData) {
        queryClient.setQueryData(["pinnedProjects"], (oldData: any) =>
          alphabetize(
            // go through each folder and remove any occurrences of the projectID
            oldData.map((item: any) => {
              return {
                ...item,
                projects: item.projects.filter(
                  (
                    project: NonNullable<
                      User["pinnedProjects"]
                    >[number]["projects"][number]
                  ) => {
                    if (typeof project === "string")
                      return project !== projectID;
                    return project.projectID !== projectID;
                  }
                ),
              };
            })
          )
        );
      }
    },
    onSuccess: () => {
      addNotification({
        message: "Project unpinned successfully.",
        type: "success",
      });
    },
    onSettled: () => queryClient.invalidateQueries(["pinnedProjects"]),
    onError(error, variables, context) {
      handleGlobalError(error);
    },
  });
}

export function useMoveProjectMutation() {
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();

  return useMutation({
    mutationFn: async ({
      folderName,
      projectID,
    }: {
      folderName: string;
      projectID: string;
    }) => {
      const res = await api.updateUserPinnedProjects({
        action: "move-project",
        folder: folderName.trim(),
        projectID,
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      // Optimistically update the local state
      const previousData = queryClient.getQueryData(["pinnedProjects"]);
      if (previousData) {
        queryClient.setQueryData(["pinnedProjects"], (oldData: any) =>
          alphabetize(
            // go through each folder and remove any occurrences of the projectID. Then, add it to the new folder
            oldData.map((item: any) => {
              if (item.folder === folderName) {
                return {
                  ...item,
                  projects: [...(item.projects || []), projectID],
                };
              }
              return {
                ...item,
                projects: item.projects.filter(
                  (
                    project: NonNullable<
                      User["pinnedProjects"]
                    >[number]["projects"][number]
                  ) => {
                    if (typeof project === "string")
                      return project !== projectID;
                    return project.projectID !== projectID;
                  }
                ),
              };
            })
          )
        );
      }
    },
    onSuccess: () => {
      addNotification({
        message: "Project moved successfully.",
        type: "success",
      });
    },
    onSettled: () => queryClient.invalidateQueries(["pinnedProjects"]),
    onError(error, variables, context) {
      handleGlobalError(error);
    },
  });
}
