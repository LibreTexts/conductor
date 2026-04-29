import { useMemo } from "react";
import { Badge, Button, Card, Heading, Spinner, Stack, Tabs } from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef } from "@libretexts/davis-react-table";
import { Link } from "react-router-dom";
import { IconPencil, IconPin } from "@tabler/icons-react";
import { format, parseISO } from "date-fns";
import { useModals } from "../../../context/ModalContext";
import PinProjectsModal from "./PinProjectsModal";
import { usePinnedProjects } from "./hooks";
import { truncateString } from "../../util/HelperFunctions";
import { Project } from "../../../types";

type PinnedProjectObj = Pick<Project, "orgID" | "projectID" | "title" | "updatedAt">;

const columns: ColumnDef<PinnedProjectObj>[] = [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ getValue, row }) => (
      <Link
        to={`/projects/${row.original.projectID}`}
        className="font-semibold text-blue-700 hover:text-blue-900 hover:underline"
      >
        {truncateString(getValue<string>(), 75)}
      </Link>
    ),
  },
  {
    accessorKey: "updatedAt",
    header: "Last Updated",
    cell: ({ getValue }) => {
      const val = getValue<string>();
      if (!val) return <span className="text-gray-400">—</span>;
      const parsed = parseISO(val);
      return (
        <span className="text-gray-600 text-sm">
          {format(parsed, "MM/dd/yy")} at {format(parsed, "h:mm aa")}
        </span>
      );
    },
  },
];

const PinnedProjects: React.FC = () => {
  const { openModal, closeAllModals } = useModals();
  const { data, isLoading } = usePinnedProjects();

  const onShowPinnedModal = () => {
    if (!data) return;
    openModal(<PinProjectsModal show={true} onClose={() => closeAllModals()} />);
  };

  const allProjects = useMemo<PinnedProjectObj[]>(() => {
    if (!data) return [];
    return data.flatMap((folder) =>
      (folder.projects || []).filter((p): p is PinnedProjectObj => typeof p !== "string")
    );
  }, [data]);

  const tabLabels = useMemo(() => {
    if (!data) return [];
    const labels = data.map((folder) => (
      <Tabs.Tab key={folder.folder}>
        <span className="flex items-center gap-1.5">
          {folder.folder}
          <Badge label={String(folder.projects?.length ?? 0)} size="sm" />
        </span>
      </Tabs.Tab>
    ));
    labels.push(
      <Tabs.Tab key="all">
        <span className="flex items-center gap-1.5">
          All
          <Badge label={String(allProjects.length)} size="sm" />
        </span>
      </Tabs.Tab>
    );
    return labels;
  }, [data, allProjects.length]);

  const tabPanels = useMemo(() => {
    if (!data) return [];
    const panels = data.map((folder) => {
      const projects = (folder.projects || []).filter(
        (p): p is PinnedProjectObj => typeof p !== "string"
      );
      return (
        <Tabs.Panel key={folder.folder}>
          {projects.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">No pinned projects here</p>
          ) : (
            <DataTable<PinnedProjectObj> data={projects} columns={columns} density="compact" />
          )}
        </Tabs.Panel>
      );
    });
    panels.push(
      <Tabs.Panel key="all">
        {allProjects.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">No pinned projects</p>
        ) : (
          <DataTable<PinnedProjectObj> data={allProjects} columns={columns} density="compact" />
        )}
      </Tabs.Panel>
    );
    return panels;
  }, [data, allProjects]);

  return (
    <Card>
      <Card.Header>
        <Stack direction="horizontal" align="center" justify="between">
          <Stack direction="horizontal" align="center" gap="sm">
            <IconPin size={24} />
            <Heading level={3} className="!my-0">
              Pinned Projects
            </Heading>
          </Stack>
          <Button
            variant="secondary"
            size="sm"
            onClick={onShowPinnedModal}
            icon={<IconPencil size={16} />}
            name="Edit Pinned Projects"
            title="Edit Pinned Projects"
          />
        </Stack>
      </Card.Header>
      <Card.Body>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <Tabs variant="pills">
            <div className="lg:flex lg:flex-row lg:items-start lg:gap-4">
              <Tabs.List className="lg:!flex-col lg:!bg-transparent lg:!px-1 lg:!py-1 lg:!rounded-none lg:!gap-1 lg:border-r lg:border-gray-200 lg:pr-3 lg:min-w-[160px] overflow-x-auto">
                {tabLabels}
              </Tabs.List>
              <Tabs.Panels className="flex-1 min-w-0 mt-3 lg:mt-0 max-h-fit overflow-y-auto">
                {tabPanels}
              </Tabs.Panels>
            </div>
          </Tabs>
        )}
      </Card.Body>
    </Card>
  );
};

export default PinnedProjects;
