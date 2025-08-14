import { useState } from "react";
import { Link } from "react-router-dom";
import { Header, Segment, Grid, Breadcrumb } from "semantic-ui-react";
import { CentralIdentityVerificationRequest } from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { PaginationWithItemsSelect } from "../../../../components/util/PaginationWithItemsSelect";
import ManageVerificationRequestModal from "../../../../components/controlpanel/CentralIdentity/ManageVerificationRequestModal";
import { format as formatDate, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import api from "../../../../api";
import { useModals } from "../../../../context/ModalContext";
import SupportCenterTable from "../../../../components/support/SupportCenterTable";

const CentralIdentityInstructorVerifications = () => {
  //Global State & Hooks
  const { handleGlobalError } = useGlobalError();
  const { openModal, closeAllModals } = useModals();

  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);
  const { data, isLoading, refetch } = useQuery<{
    requests: CentralIdentityVerificationRequest[];
    totalCount: number;
  }>({
    queryKey: ["central-identity-verification-requests", page, limit],
    queryFn: () => loadData(),
  });

  async function loadData() {
    try {
      const response = await api.getCentralIdentityVerificationRequests({
        page,
        limit,
        status: "open",
      });
      if (response.data.err) {
        console.error(response.data.errMsg);
        throw new Error(response.data.errMsg);
      }
      return response.data;
    } catch (err) {
      handleGlobalError(err);
      return { requests: [], totalCount: 0 };
    }
  }

  // Handlers & Methods
  function handleSelectRequest(request: CentralIdentityVerificationRequest) {
    openModal(
      <ManageVerificationRequestModal
        show={true}
        requestId={request.id.toString()}
        userId={request.user_id.toString()}
        onClose={handleCloseManageModal}
        onSave={handleCloseManageModal}
      />
    );
  }

  function handleCloseManageModal() {
    closeAllModals();
    refetch();
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header" as="h2">
            LibreOne Admin Console: Instructor Verfication Requests
          </Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment>
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to="/controlpanel">
                  Control Panel
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section as={Link} to="/controlpanel/libreone">
                  LibreOne Admin Consoles
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>
                  Instructor Verification Requests
                </Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            <Segment>
              <PaginationWithItemsSelect
                activePage={page}
                totalPages={
                  data?.totalCount ? Math.ceil(data?.totalCount / limit) : 1
                }
                itemsPerPage={limit}
                setItemsPerPageFn={setLimit}
                setActivePageFn={setPage}
                totalLength={data?.totalCount ?? 0}
              />
            </Segment>
            <Segment>
              <SupportCenterTable<CentralIdentityVerificationRequest>
                data={data?.requests ?? []}
                loading={isLoading}
                onRowClick={(record) => handleSelectRequest(record)}
                columns={[
                  {
                    accessor: "user.first_name",
                    title: "First Name",
                  },
                  {
                    accessor: "user.last_name",
                    title: "Last Name",
                  },
                  {
                    accessor: "user.email",
                    title: "Email",
                  },
                  {
                    accessor: "created_at",
                    title: "Request Date",
                    render: (record) =>
                      formatDate(
                        parseISO(record.created_at.toString() ?? ""),
                        "MM/dd/yyyy"
                      ),
                  },
                ]}
              />
            </Segment>
            <Segment>
              <PaginationWithItemsSelect
                activePage={page}
                totalPages={
                  data?.totalCount ? Math.ceil(data?.totalCount / limit) : 1
                }
                itemsPerPage={limit}
                setItemsPerPageFn={setLimit}
                setActivePageFn={setPage}
                totalLength={data?.totalCount ?? 0}
              />
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CentralIdentityInstructorVerifications;
