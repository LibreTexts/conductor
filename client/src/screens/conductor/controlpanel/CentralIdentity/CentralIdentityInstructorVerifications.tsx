import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Header,
  Segment,
  Grid,
  Breadcrumb,
  Table,
  Icon,
  Button,
  Dropdown,
} from "semantic-ui-react";
import { CentralIdentityVerificationRequest } from "../../../../types";
import axios from "axios";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { PaginationWithItemsSelect } from "../../../../components/util/PaginationWithItemsSelect";
import {
  getPrettyVerficationStatus,
  verificationRequestStatusOptions,
} from "../../../../utils/centralIdentityHelpers";
import ManageVerificationRequestModal from "../../../../components/controlpanel/CentralIdentity/ManageVerificationRequestModal";
import { format as formatDate, parseISO } from "date-fns";

const CentralIdentityInstructorVerifications = () => {
  //Global State & Hooks
  const { handleGlobalError } = useGlobalError();

  //Data & UI
  const [requests, setRequests] = useState<
    CentralIdentityVerificationRequest[]
  >([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activePage, setActivePage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [statusChoice, setStatusChoice] = useState<string | undefined>(
    undefined
  );
  const [showManageModal, setShowManageModal] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] =
    useState<CentralIdentityVerificationRequest | null>(null);
  const TABLE_COLS = [
    { key: "firstName", text: "First Name" },
    { key: "lastName", text: "Last Name" },
    { key: "email", text: "Email" },
    { key: "requestDate", text: "Request Date" },
    { key: "Actions", text: "Actions" },
  ];

  //Effects
  useEffect(() => {
    getRequests();
  }, [activePage, itemsPerPage]);

  // Handlers & Methods
  async function getRequests(searchString?: string) {
    try {
      setLoading(true);

      const res = await axios.get("/central-identity/verification-requests", {
        params: {
          activePage,
          query: searchString,
          status: 'open',
        },
      });

      if (
        res.data.err ||
        !res.data.requests ||
        !Array.isArray(res.data.requests) ||
        res.data.totalCount === undefined
      ) {
        throw new Error("Error retrieving users");
      }

      setRequests(res.data.requests);
      setTotalItems(res.data.totalCount);
      setTotalPages(Math.ceil(res.data.totalCount / itemsPerPage));
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectRequest(request: CentralIdentityVerificationRequest) {
    setSelectedRequest(request);
    setShowManageModal(true);
  }

  function handleCloseManageModal() {
    setShowManageModal(false);
    setSelectedRequest(null);
    getRequests();
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
            {/*
            <Segment>
              <Grid>
                <Grid.Row>
                  <Grid.Column width="16">
                    <Dropdown
                      placeholder="Status..."
                      floating
                      selection
                      button
                      options={verificationRequestStatusOptions}
                      onChange={(_e, { value }) => {
                        setStatusChoice(value as string);
                      }}
                      value={statusChoice}
                    />
                    
                  </Grid.Column>
                </Grid.Row>
              </Grid>
            </Segment>
            */}
            <Segment loading={loading}>
              <PaginationWithItemsSelect
                activePage={activePage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                setItemsPerPageFn={setItemsPerPage}
                setActivePageFn={setActivePage}
                totalLength={totalItems}
              />
            </Segment>
            <Segment loading={loading}>
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
                  {requests.length > 0 &&
                    requests.map((req) => {
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
                  {requests.length === 0 && (
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
            <Segment loading={loading}>
              <PaginationWithItemsSelect
                activePage={activePage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                setItemsPerPageFn={setItemsPerPage}
                setActivePageFn={setActivePage}
                totalLength={totalItems}
              />
            </Segment>
          </Segment.Group>
          {selectedRequest && (
            <ManageVerificationRequestModal
              show={showManageModal}
              requestId={selectedRequest.id.toString()}
              userId={selectedRequest.user_id.toString()}
              onClose={handleCloseManageModal}
              onSave={handleCloseManageModal}
            />
          )}
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CentralIdentityInstructorVerifications;
