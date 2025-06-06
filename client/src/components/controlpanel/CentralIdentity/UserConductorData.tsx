import { Header } from "semantic-ui-react";
import SupportCenterTable from "../../support/SupportCenterTable";
import { PaginationWithItemsSelect } from "../../util/PaginationWithItemsSelect";
import useGlobalError from "../../error/ErrorHooks";
import { useState } from "react";
import { ConductorBaseResponse, Project } from "../../../types";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface UserConductorDataProps {
  uuid: string;
}

const UserConductorData: React.FC<UserConductorDataProps> = ({ uuid }) => {
  const { handleGlobalError } = useGlobalError();
  const [activePage, setActivePage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [activeSort, setActiveSort] = useState<string>("opened");
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);

  const { data, isFetching } = useQuery<Project[]>({
    queryKey: ["user-projects", uuid, activePage, itemsPerPage, activeSort],
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
      setTotalPages(Math.ceil(res.data.total_items / itemsPerPage));

      return res.data.projects;
    } catch (err) {
      handleGlobalError(err);
      return [];
    }
  }

  const openProject = (projectID: string) => {
    window.open(`/projects/${projectID}`, "_blank");
  };

  return (
    <div className="flex flex-col rounded-md p-4 shadow-md bg-white h-fit space-y-1.5 mb-8">
      <div className="flex justify-between items-center mb-4 border-b border-slate-300 py-1.5">
        <Header as="h3" className="!m-0">
          Conductor Projects
        </Header>
      </div>
      <SupportCenterTable<Project & { actions?: string }>
        tableProps={{
          className: "!mb-2",
        }}
        loading={isFetching}
        data={data || []}
        onRowClick={(record) => {
          openProject(record.projectID);
        }}
        columns={[
          {
            accessor: "projectID",
            title: "Project ID",
            render(record) {
              return record.projectID;
            },
          },
          {
            accessor: "title",
            title: "Title",
            className: "!w-full !max-w-[40rem] break-words truncate",
            render(record) {
              return record.title;
            },
          },
        ]}
      />
      <PaginationWithItemsSelect
        activePage={activePage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        setActivePageFn={setActivePage}
        setItemsPerPageFn={setItemsPerPage}
        totalLength={totalItems}
      />
    </div>
  );
};

export default UserConductorData;
