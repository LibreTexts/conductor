import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Breadcrumb,
  Grid,
  Header,
  Icon,
  Loader,
  Segment,
  Table,
} from "semantic-ui-react";
import ViewAccountRequest from "../../../../components/InstructorVerificationRequest/ViewAccountRequest";
import { getPurposeText } from "../../../../utils/instructorVerificationRequestHelpers";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { AccountRequest } from "../../../../types";
import { format, parseISO } from "date-fns";
import ConductorPagination from "../../../../components/util/ConductorPagination";

/**
 * The Account Requests interface allows administrators to view Instructor Account Requests
 * for LibreTexts services, submitted via Conductor.
 */
const AccountRequests = () => {
  const TABLE_COLS = [
    { key: "completed", text: "Status" },
    { key: "date", text: "Date" },
    { key: "purpose", text: "Purpose" },
    { key: "email", text: "Email" },
    { key: "name", text: "Name" },
    { key: "institution", text: "Institution" },
    { key: "librenet", text: "Requests LibreNet Info" },
  ];

  // Global error handling
  const { handleGlobalError } = useGlobalError();

  // UI
  const [loading, setLoading] = useState<boolean>(false);
  const [showViewModal, setShowViewModal] = useState<boolean>(false);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [activePage, setActivePage] = useState<number>(1);

  // Data
  const [accountRequests, setAccountRequests] = useState<AccountRequest[]>([]);
  const [currentRequest, setCurrentRequest] = useState<AccountRequest>();

  /**
   * Loads Account Requests from the server and saves them to state.
   */
  const getAccountRequests = useCallback(async () => {
    try {
      setLoading(true);
      const arRes = await axios.get(`/accountrequests?page=${activePage}`);
      if (arRes.data.err || !arRes.data.requests || !arRes.data.totalCount) {
        throw new Error(arRes.data.errMsg);
      }
      
      setAccountRequests(arRes.data.requests);
      setTotalPages(Math.ceil(arRes.data.totalCount / 25));
      setLoading(false);
    } catch (e) {
      setLoading(false);
      handleGlobalError(e);
    }
  }, [setAccountRequests, setLoading, handleGlobalError, activePage]);

  /**
   * Set the page title and gather data from server on first load.
   */
  useEffect(() => {
    document.title = "LibreText Conductor | Account Requests";
    getAccountRequests();
  }, [getAccountRequests]);

  /**
   * Saves the selected Account Request to state and opens the View Account Request tool.
   *
   * @param {object} request - Account Request data.
   */
  function handleOpenRequestView(request: AccountRequest) {
    setCurrentRequest(request);
    setShowViewModal(true);
  }

  /**
   * Closes the View Account Request tool.
   */
  function handleViewModalClose() {
    setShowViewModal(false);
    setCurrentRequest(undefined);
  }

  /**
   * Refreshes the list of Account Requests when a child component indicates
   * the server's data may have changed.
   */
  function handleDataChangeNotification() {
    getAccountRequests();
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header" as="h2">
            Account Requests
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
                <Breadcrumb.Section active>Account Requests</Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            {loading && (
              <Segment>
                <Loader active inline="centered" />
              </Segment>
            )}
            <Segment>
              <div className="flex-row-div">
                <div className="right-flex">
                  <ConductorPagination
                    activePage={activePage}
                    totalPages={totalPages}
                    onPageChange={(e, data) =>
                      setActivePage(
                        parseInt(data.activePage?.toString() ?? "1") ?? 1
                      )
                    }
                  />
                </div>
              </div>
              <Table striped celled>
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
                  {accountRequests.length > 0 &&
                    accountRequests.map((item) => {
                      let completedRow = false;
                      if (item.status === "completed") {
                        completedRow = true;
                      }
                      return (
                        <Table.Row key={item._id} className="word-break-all">
                          <Table.Cell textAlign="center">
                            {completedRow && (
                              <Icon
                                name="checkmark"
                                color="green"
                                size="large"
                                className="float-left"
                              />
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            <span
                              className="text-link"
                              onClick={() => handleOpenRequestView(item)}
                            >
                              {item.createdAt ? (
                                format(
                                  parseISO(item.createdAt.toString()),
                                  "MM/dd/yyyy h:mm aa"
                                )
                              ) : (
                                <em>Unknown</em>
                              )}
                            </span>
                          </Table.Cell>
                          <Table.Cell disabled={completedRow}>
                            <span>{getPurposeText(item.purpose, true)}</span>
                          </Table.Cell>
                          <Table.Cell disabled={completedRow}>
                            <span>{item.requester?.email}</span>
                          </Table.Cell>
                          <Table.Cell disabled={completedRow}>
                            <span>
                              {item.requester?.firstName}{" "}
                              {item.requester?.lastName}
                            </span>
                          </Table.Cell>
                          <Table.Cell disabled={completedRow}>
                            <span>
                              {item.requester?.instructorProfile?.institution}
                            </span>
                          </Table.Cell>
                          <Table.Cell disabled={completedRow}>
                            {item.moreInfo ? (
                              <span>
                                <strong>Yes</strong>
                              </span>
                            ) : (
                              <span>No/Unspecified</span>
                            )}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  {accountRequests.length === 0 && (
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
              <div className="flex-row-div">
                <div className="right-flex">
                  <ConductorPagination
                    activePage={activePage}
                    totalPages={totalPages}
                    onPageChange={(e, data) =>
                      setActivePage(
                        parseInt(data.activePage?.toString() ?? "1") ?? 1
                      )
                    }
                  />
                </div>
              </div>
            </Segment>
          </Segment.Group>

          {currentRequest && (
            <ViewAccountRequest
              show={showViewModal}
              onClose={handleViewModalClose}
              request={currentRequest}
              onDataChange={handleDataChangeNotification}
            />
          )}
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default AccountRequests;
