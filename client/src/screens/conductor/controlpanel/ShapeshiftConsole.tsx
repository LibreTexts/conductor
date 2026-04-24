import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import api from '../../../api';
import useDocumentTitle from "../../../hooks/useDocumentTitle";
import useClientConfig from "../../../hooks/useClientConfig";
import { useNotifications } from "../../../context/NotificationContext";
import {
  Breadcrumb,
  Heading,
  Stack,
  Divider,
  FormSection,
  Input,
  Button,
} from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";
import type { Table, ColumnDef } from "@libretexts/davis-react-table";
import { ShapeshiftJob, ShapeshiftJobStatus } from "../../../types";
import {IconDownload, IconExternalLink, IconRefresh, IconSend} from "@tabler/icons-react";
import { useForm } from "react-hook-form";
import DOMPurify from "dompurify";
import { format as formatDate, parseISO } from "date-fns";

const getPrettyJobStatus = (statusRaw: ShapeshiftJobStatus) => {
  switch (statusRaw) {
    case "created":
      return 'Created';
    case "failed":
      return 'Failed';
    case "finished":
      return 'Finished';
    case "inprogress":
      return 'In Progress';
    default:
      return 'Unknown';
  }
};

const columns: ColumnDef<ShapeshiftJob>[] = [
  {
    accessorKey: "id",
    header: "ID",
    size: 80,
  },
  {
    accessorKey: "bookID",
    header: "Book ID",
    size: 80,
  },
  {
    accessorKey: "status",
    header: "Status",
    size: 100,
    cell: ({ getValue }) => getPrettyJobStatus(getValue<ShapeshiftJobStatus>()),
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    size: 90,
    cell: ({ getValue }) => formatDate(
      parseISO(getValue<string>() ?? ""),
      "MM/dd/yyyy h:mm aaa"
    ),
  },
];

const ShapeshiftConsole = () => {
  useDocumentTitle("LibreTexts Conductor | Shapeshift Admin Console");
  const { addNotification } = useNotifications();
  const { isProduction } = useClientConfig();

  const allColumns = useMemo<ColumnDef<ShapeshiftJob>[]>(() => {
    const downloadsHost = isProduction
      ? "downloads.libretexts.org"
      : "staging.downloads.libretexts.org";
    return [
      ...columns,
      {
        header: "Actions",
        cell: ({ row }) => {
          const renderPDFButton = row?.getValue('status') === 'finished' && !!row?.getValue('bookID');
          const pdfLink = `https://${downloadsHost}/api/v1/download/${row.getValue('bookID')}/pdf`;
          return (
            <div className="flex items-center">
              <Button
                as="a"
                href={DOMPurify.sanitize(row.getValue('url'))}
                variant="primary"
                icon={<IconExternalLink />}
                target="_blank"
                rel="noopener noreferrer"
              >
                Link
              </Button>
              {renderPDFButton && (
                <Button
                  as="a"
                  href={pdfLink}
                  variant="primary"
                  icon={<IconDownload />}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  PDF
                </Button>
              )}
            </div>
          );
        },
      },
    ];
  }, [isProduction]);

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
    data: jobs,
    isLoading: jobsLoading,
    refetch: refetchJobs,
  } = useQuery<ShapeshiftJob[]>({
    queryKey: ['shapeshiftJobs', activePage, itemsPerPage],
    queryFn: async () => {
      const resp = await api.getShapeshiftJobs({
        limit: itemsPerPage,
        offset: itemsPerPage * (activePage - 1),
      });
      setTotalItems(resp?.meta?.total ?? 0);
      return resp.jobs;
    },
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
      refetchJobs();
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
        <div className="flex items-center justify-between mt-8">
          <Heading level={3} className="mb-0!">Jobs</Heading>
          <Button
            type="button"
            variant="primary"
            icon={<IconRefresh />}
            loading={jobsLoading}
          >
            Refresh
          </Button>
        </div>
        <DataTable<ShapeshiftJob>
          data={jobs || []}
          columns={allColumns}
          loading={jobsLoading}
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
