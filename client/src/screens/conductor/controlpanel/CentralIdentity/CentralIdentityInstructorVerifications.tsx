import { useState } from "react";
import { Breadcrumb, Heading, Stack } from "@libretexts/davis-react";
import { DataTable } from "@libretexts/davis-react-table";
import type { ColumnDef, PaginationState } from "@libretexts/davis-react-table";
import { format as formatDate, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { CentralIdentityVerificationRequest } from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import ManageVerificationRequestModal from "../../../../components/controlpanel/CentralIdentity/ManageVerificationRequestModal";
import api from "../../../../api";
import { useModals } from "../../../../context/ModalContext";

const columns: ColumnDef<CentralIdentityVerificationRequest>[] = [
  {
    id: "first_name",
    accessorFn: (request) => request.user.first_name,
    header: "First Name",
  },
  {
    id: "last_name",
    accessorFn: (request) => request.user.last_name,
    header: "Last Name",
  },
  {
    id: "email",
    accessorFn: (request) => request.user.email,
    header: "Email",
  },
  {
    accessorKey: "created_at",
    header: "Request Date",
    cell: ({ row }) =>
      formatDate(parseISO(row.original.created_at.toString()), "MM/dd/yyyy"),
  },
];

const CentralIdentityInstructorVerifications = () => {
  const { handleGlobalError } = useGlobalError();
  const { openModal, closeAllModals } = useModals();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const { data, isLoading, refetch } = useQuery<{
    requests: CentralIdentityVerificationRequest[];
    totalCount: number;
  }>({
    queryKey: ["central-identity-verification-requests", page, limit],
    queryFn: loadData,
    keepPreviousData: true,
  });

  async function loadData() {
    try {
      const response = await api.getCentralIdentityVerificationRequests({
        page,
        limit,
        status: "open",
      });

      if (response.data.err) {
        throw new Error(response.data.errMsg);
      }

      return response.data;
    } catch (error) {
      handleGlobalError(error);
      return { requests: [], totalCount: 0 };
    }
  }

  function handleCloseManageModal() {
    closeAllModals();
    refetch();
  }

  function handleSelectRequest(request: CentralIdentityVerificationRequest) {
    openModal(
      <ManageVerificationRequestModal
        show
        requestId={request.id.toString()}
        userId={request.user_id.toString()}
        onClose={handleCloseManageModal}
        onSave={handleCloseManageModal}
      />
    );
  }

  const paginationState: PaginationState = {
    pageIndex: page - 1,
    pageSize: limit,
  };

  return (
    <div className="!h-full !p-8">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>
          LibreOne Admin Console: Instructor Verification Requests
        </Heading>
        <Breadcrumb>
          <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
          <Breadcrumb.Item href="/controlpanel/libreone">
            LibreOne Admin Consoles
          </Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>
            Instructor Verification Requests
          </Breadcrumb.Item>
        </Breadcrumb>
        <DataTable<CentralIdentityVerificationRequest>
          data={data?.requests ?? []}
          columns={columns}
          loading={isLoading}
          density="compact"
          onRowClick={handleSelectRequest}
          enablePagination
          pageSize={limit}
          pageSizeOptions={[10, 25, 50, 100]}
          tableOptions={{
            manualPagination: true,
            rowCount: data?.totalCount ?? 0,
            state: {
              pagination: paginationState,
            },
            onPaginationChange: (updater) => {
              const nextPagination =
                typeof updater === "function"
                  ? updater(paginationState)
                  : updater;

              setPage(nextPagination.pageIndex + 1);
              setLimit(nextPagination.pageSize);
            },
          }}
        />
      </Stack>
    </div>
  );
};

export default CentralIdentityInstructorVerifications;
