import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import api from '../../../api';
import useDocumentTitle from "../../../hooks/useDocumentTitle";
import { useNotifications } from "../../../context/NotificationContext";
import {
  Breadcrumb,
  Heading,
  Stack,
  Divider,
  FormSection,
  Input,
  Button
} from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";
import type { Table, ColumnDef } from "@libretexts/davis-react-table";
import { ShapeshiftJob } from "../../../types";
import { IconSend } from "@tabler/icons-react";
import { useForm } from "react-hook-form";

const columns: ColumnDef<ShapeshiftJob>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ getValue, row }) => (
      <div className="flex items-center">
        <span>{getValue<string>()} </span>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue, row }) => (
      <div className="flex items-center">
        <span>{getValue<string>()} </span>
      </div>
    )
  },
  {
    accessorKey: "url",
    header: "URL",
    cell: ({ getValue, row }) => (
      <div className="flex items-center">
        <span>{getValue<string>()} </span>
      </div>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ getValue, row }) => (
      <div className="flex items-center">
        <span>{getValue<string>()} </span>
      </div>
    ),
  },
];

const ShapeshiftConsole = () => {
  useDocumentTitle("LibreTexts Conductor | Shapeshift Admin Console");
  const { addNotification } = useNotifications();

  // UI
  const [activePage, setActivePage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  const tableRef = useRef<Table<ShapeshiftJob> | null>(null);
  const paginationState = {
    pageIndex: activePage - 1,
    pageSize: itemsPerPage,
  };

  // Data
  const {
    data: openJobsData,
    isLoading: openJobsLoading,
    refetch: refetchOpenJobs,
  } = useQuery<ShapeshiftJob[]>({
    queryKey: ['shapeshiftOpenJobs'],
    queryFn: async () => {
      console.log('fetching');
      const resp = await api.getShapeshiftOpenJobs();
      return resp.jobs;
    },
    refetchInterval: 60 * 1000,
  });

  const { register, handleSubmit, reset } = useForm<{ url: string }>();
  const createJobMutation = useMutation({
    mutationFn: async (data: { url: string }) => {
      return await api.createShapeshiftJob({ url: data.url });
    },
    onSuccess: (data) => {
      addNotification({
        type: "success",
        message: `Successfully queued job ${data.jobId}`,
      });
      reset();
      refetchOpenJobs();
    },
    onError: (error: any) => {
      addNotification({
        type: "error",
        message: 'Failed to create job.',
      });
    },
  });

  return (
    <div className="!pt-32 !bg-white !h-full !px-8">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>Shapeshift Admin Console</Heading>
        <Breadcrumb>
          <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Shapeshift Admin Console</Breadcrumb.Item>
        </Breadcrumb>
        <form onSubmit={handleSubmit((data) => createJobMutation.mutateAsync(data))}>
          <FormSection title="Create Job">
            <Input
              label="Resource URL"
              placeholder="Enter the URL of the resource to convert"
              required
              {...register("url", { required: "Resource URL cannot be empty" })}
            />
            <Button type="submit" variant="primary" loading={createJobMutation.isPending} icon={<IconSend />}>
              Submit
            </Button>
          </FormSection>
        </form>
        <Divider />
        <Heading level={3}>Open Jobs</Heading>
        <DataTable<ShapeshiftJob>
          data={openJobsData || []}
          columns={columns}
          loading={openJobsLoading}
          density="compact"
          enablePagination
          pageSize={itemsPerPage}
          pageSizeOptions={[10, 25, 50, 100]}
          onTableReady={(table) => (tableRef.current = table)}
          tableOptions={{
            manualPagination: true,
            manualFiltering: true,
            manualSorting: true,
            rowCount: totalItems,
            state: {
              pagination: paginationState,
            },
            onPaginationChange: (updater) => {
              const nextPagination =
                typeof updater === "function"
                  ? updater(paginationState)
                  : updater;

              setActivePage(nextPagination.pageIndex + 1);
              setItemsPerPage(nextPagination.pageSize);
            },
          }}
          toolbar={{
            globalSearch: false
          }}
        />
      </Stack>
    </div>
  );
};

export default ShapeshiftConsole;
