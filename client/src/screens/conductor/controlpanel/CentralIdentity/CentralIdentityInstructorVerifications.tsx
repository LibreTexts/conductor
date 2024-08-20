import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Header,
  Segment,
  Grid,
  Breadcrumb,
  Table,
  Icon,
  Button,
} from "semantic-ui-react";
import { CentralIdentityVerificationRequest } from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { PaginationWithItemsSelect } from "../../../../components/util/PaginationWithItemsSelect";
import ManageVerificationRequestModal from "../../../../components/controlpanel/CentralIdentity/ManageVerificationRequestModal";
import { format as formatDate, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import api from "../../../../api";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import { useModals } from "../../../../context/ModalContext";

const CentralIdentityInstructorVerifications = () => {
  //Global State & Hooks
  const { handleGlobalError } = useGlobalError();
  const { openModal, closeAllModals } = useModals();

  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const { data, isFetching, refetch } = useQuery<{ requests: CentralIdentityVerificationRequest[], totalCount: number }>({
    queryKey: ['central-identity-verification-requests', page, limit],
    queryFn: () => loadData(),
  })

  const TABLE_COLS = [
    { key: "firstName", text: "First Name" },
    { key: "lastName", text: "Last Name" },
    { key: "email", text: "Email" },
    { key: "requestDate", text: "Request Date" },
    { key: "Actions", text: "Actions" },
  ];

  async function loadData() {
    try {
      const response = await api.getCentralIdentityVerificationRequests({ page, limit });
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
    )
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
            {
              isFetching && <LoadingSpinner />
            }
            <Segment>
              <PaginationWithItemsSelect
                activePage={page}
                totalPages={data?.totalCount ? Math.ceil(data?.totalCount / limit) : 1}
                itemsPerPage={limit}
                setItemsPerPageFn={setLimit}
                setActivePageFn={setPage}
                totalLength={data?.totalCount ?? 0}
              />
            </Segment>
            <Segment>
              <Table striped celled selectable>
                <Table.Header>
                  <Table.Row>
                    {TABLE_COLS.map((item) => (
                      <Table.HeaderCell key={item.key}>
                        <span>{item.text}</span>
                      </Table.HeaderCell>
                    ))}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {data && data.requests.length > 0 &&
                    data.requests.map((req) => {
                      return (
                        <Table.Row key={req.id} className="word-break-all">
                          <Table.Cell>
                            <span>{req.user.first_name}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span>{req.user.last_name}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span>{req.user.email}</span>
                          </Table.Cell>
                          <Table.Cell>
                            <span>
                              {formatDate(
                                parseISO(req.created_at.toString() ?? ""),
                                "MM/dd/yyyy"
                              )}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <Button
                              color="blue"
                              onClick={() => handleSelectRequest(req)}
                            >
                              <Icon name="eye" />
                              View Request
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  {data && data.requests.length === 0 && (
                    <Table.Row>
                      <Table.Cell colSpan={TABLE_COLS.length + 1}>
                        <p className="text-center">
                          <em>No results found.</em>
                        </p>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
            </Segment>
            <Segment>
              <PaginationWithItemsSelect
                activePage={page}
                totalPages={data?.totalCount ? Math.ceil(data?.totalCount / limit) : 1}
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
