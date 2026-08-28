import { Card, Heading } from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef } from "@libretexts/davis-react-table";
import useGlobalError from "../../error/ErrorHooks";
import { useState } from "react";
import { ConductorBaseResponse, Project } from "../../../types";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface UserConductorDataProps {
  uuid: string;
}

const columns: ColumnDef<Project>[] = [
  {
    accessorKey: "projectID",
    header: "Project ID",
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ getValue }) => (
      <span className="line-clamp-1 break-words">{getValue<string>()}</span>
    ),
  },
];

const UserConductorData: React.FC<UserConductorDataProps> = ({ uuid }) => {
  const { handleGlobalError } = useGlobalError();
  const [activePage, setActivePage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);

  const { data, isFetching } = useQuery<Project[]>({
    queryKey: ["user-projects", uuid, activePage, itemsPerPage],
    queryFn: () => getUserProjects(),
    keepPreviousData: true,
    staleTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
    enabled: !!uuid,
  });

  async function getUserProjects() {
    try {
      if (!uuid) return [];

      const res = await axios.get<
        {
          projects: Project[];
          total_items: number;
          has_more: boolean;
        } & ConductorBaseResponse
      >("/user/projects", {
        params: {
          uuid,
          centralID: false,
          page: activePage,
          limit: itemsPerPage,
        },
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg || "Failed to fetch user projects.");
      }

      if (!res.data.projects || !Array.isArray(res.data.projects)) {
        throw new Error("Failed to fetch user projects.");
      }

      setTotalItems(res.data.total_items || 0);

      return res.data.projects;
    } catch (err) {
      handleGlobalError(err);
      return [];
    }
  }

  const openProject = (projectID: string) => {
    window.open(`/projects/${projectID}`, "_blank");
  };

  const paginationState = {
    pageIndex: activePage - 1,
    pageSize: itemsPerPage,
  };

  return (
    <Card>
      <Card.Header>
        <Heading level={3}>Conductor Projects</Heading>
      </Card.Header>
      <Card.Body>
        <DataTable<Project>
          data={data || []}
          columns={columns}
          loading={isFetching}
          density="compact"
          caption="Conductor projects this user is a member of"
          onRowClick={(record) => openProject(record.projectID)}
          enablePagination
          pageSize={itemsPerPage}
          pageSizeOptions={[10, 25, 50]}
          tableOptions={{
            manualPagination: true,
            rowCount: totalItems,
            state: { pagination: paginationState },
            onPaginationChange: (updater) => {
              const next =
                typeof updater === "function"
                  ? updater(paginationState)
                  : updater;
              setActivePage(next.pageIndex + 1);
              setItemsPerPage(next.pageSize);
            },
          }}
        />
      </Card.Body>
    </Card>
  );
};

export default UserConductorData;
