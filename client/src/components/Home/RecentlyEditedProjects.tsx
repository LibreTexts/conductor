import { Card, Stack, Heading, Spinner, IconButton } from "@libretexts/davis-react";
import { DataTable, type ColumnDef } from "@libretexts/davis-react-table";
import { IconClock, IconPin } from "@tabler/icons-react";
import { useTypedSelector } from "../../state/hooks";
import { useQuery } from "@tanstack/react-query";
import api from "../../api";
import { useModals } from "../../context/ModalContext";
import AddPinnedProjectModal from "./PinnedProjects/AddPinnedProjectModal";
import { Project } from "../../types";
import { truncateString } from "../util/HelperFunctions";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { useMemo } from "react";

const RecentlyEditedProjects = () => {
    const user = useTypedSelector((state) => state.user);
    const { openModal, closeAllModals } = useModals();

    const { data, isLoading, refetch } = useQuery({
        queryKey: ["recentProjects", user?.uuid],
        queryFn: async () => {
            const res = await api.getRecentProjects();
            return res.data.projects || [];
        },
        enabled: !!user,
    })

    async function handlePinProject(projectID: string) {
        openModal(
            <AddPinnedProjectModal
                projectID={projectID}
                show={true}
                onClose={() => {
                    closeAllModals();
                    refetch();
                }}
            />
        );
    }


    const columns = useMemo<ColumnDef<Project>[]>(() => [
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
        {
            header: "Actions",
            cell: ({ row }) => {
                const projectID = row.original.projectID;
                return (
                    <IconButton
                        name="Pin Project"
                        title="Pin this project for easy access later"
                        aria-label="Pin this project for easy access later"
                        variant="primary"
                        icon={<IconPin size={20} />}
                        onClick={() => handlePinProject(projectID)}
                    />
                );
            },
        },
    ], [handlePinProject]);

    return (
        <Card className="mt-6">
            <Card.Header>
                <Stack direction="horizontal" align="center" justify="between">
                    <Stack direction="horizontal" align="center" gap="sm">
                        <IconClock size={24} />
                        <Heading level={3} className="!my-0">
                            Recently Edited Projects
                        </Heading>
                    </Stack>
                    {/* TODO: Add tooltip back in once z-index issues are resolved via Davis package */}
                    {/* <Tooltip
                  content={
                    <span>
                      To see all of your projects, visit{" "}
                      <strong>Projects</strong> in the Navbar.
                    </span>
                  }
                  placement="top"
                  className="z-[9999]!"
                >
                  <IconInfoCircle size={20} />
                </Tooltip> */}
                </Stack>
            </Card.Header>
            <Card.Body>
                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Spinner />
                    </div>
                ) : data?.length === 0 ? (
                    <p className="text-gray-500 text-sm">You don't have any projects right now.</p>
                ) : (
                    <DataTable<Project> data={data || []} columns={columns} density="compact" />
                )}
            </Card.Body>
        </Card>
    )

}

export default RecentlyEditedProjects;