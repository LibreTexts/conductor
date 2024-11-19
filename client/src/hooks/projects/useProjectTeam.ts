import { useQuery } from "@tanstack/react-query";
import { ProjectTeamMember, User } from "../../types";
import api from "../../api";
import { useMemo } from "react";

type UseProjectTeamProps = {
  id: string; // Project ID
  user?: User;
};

const useProjectTeam = ({ id, user }: UseProjectTeamProps) => {
  const { data, isFetching, refetch } = useQuery<{
    members: ProjectTeamMember[];
    leads: ProjectTeamMember[];
    liasons: ProjectTeamMember[];
    auditors: ProjectTeamMember[];
  }>({
    queryKey: ["project-team", id],
    queryFn: async () => {
      if (!id)
        return {
          members: [],
          leads: [],
          liasons: [],
          auditors: [],
        };

      const res = await api.getTeamMembers(id);
      return {
        members: res.data.members || [],
        leads: res.data.leads || [],
        liasons: res.data.liasons || [],
        auditors: res.data.auditors || [],
      };
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });

  const isProjectMemberOrGreater = useMemo(() => {
    if (user?.isSuperAdmin) return true;
    if (!data || !user || !user.uuid) return false;

    const allTeam = [
      ...data.members,
      ...data.leads,
      ...data.liasons,
      ...data.auditors,
    ];

    return allTeam.some((member) => member.uuid === user.uuid);
  }, [user, data]);

  const isProjectAdmin = useMemo(() => {
    if (user?.isSuperAdmin) return true;
    if (!data || !user || !user.uuid) return false;
    if (!data.leads || data.leads.length === 0) return false;

    const projectMember = data?.leads.find(
      (member) => member.uuid === user.uuid
    );
    return projectMember?.role?.toLowerCase() === "lead";
  }, [user, data]);

  return {
    team: data,
    loading: isFetching,
    isProjectMemberOrGreater,
    isProjectAdmin,
    refetch,
  };
};

export default useProjectTeam;
