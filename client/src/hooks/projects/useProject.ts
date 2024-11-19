import { useQuery } from "@tanstack/react-query";
import { Project } from "../../types";
import api from "../../api";

type UseProjectProps = {
  id?: string;
};

const useProject = ({ id }: UseProjectProps) => {
  const { data, isFetching } = useQuery<Project>({
    queryKey: ["project", id],
    queryFn: async () => {
      console.log("fetching project");
      if (!id) return;
      console.log("fetching project2");
      const res = await api.getProject(id);
      return res.data.project;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return { project: data, loading: isFetching };
};

export default useProject;
