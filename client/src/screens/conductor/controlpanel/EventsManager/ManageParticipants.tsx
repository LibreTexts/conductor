import {
  Grid,
  Header,
  Segment,
  Breadcrumb,
  Button,
  Label,
  Icon,
  Divider,
  Table,
  Pagination,
} from "semantic-ui-react";
import { Link, useHistory, useParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { OrgEvent, OrgEventParticipant } from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { isEmptyString } from "../../../../components/util/HelperFunctions";
import axios from "axios";
const COLUMNS = [
  { key: "title", text: "Title" },
  { key: "regOpen", text: "Reg Open Date" },
  { key: "regClose", text: "Reg Close Date" },
  { key: "startDate", text: "Event Start Date" },
  { key: "endDate", text: "Event End Date" },
];

const ManageParticipants = () => {
  // Global State and Error Handling
  const { handleGlobalError } = useGlobalError();
  const history = useHistory();
  const routeParams = useParams<{ eventID?: string }>();

  // Data
  const [orgEvent, setOrgEvent] = useState<OrgEvent>();

  // UI
  const [activePage, setActivePage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [loadedData, setLoadedData] = useState<boolean>(true);

  /**
   * Set page title on initial load.
   */
  useEffect(() => {
    document.title =
      "LibreTexts Conductor | Events Manager | Manage Participants";
    getOrgEvent();
  }, []);

  /**
   * Retrieves the current Org Event configuration from the server.
   */
  const getOrgEvent = useCallback(async () => {
    try {
      let orgEventID = routeParams.eventID;
      if (!orgEventID || isEmptyString(orgEventID)) {
        handleGlobalError("No Event ID provided");
      }

      let res = await axios.get(`/orgevents/${orgEventID}`);
      setLoadedData(true);
      if (res.data.err) {
        handleGlobalError(res.data.errMsg);
      }

      //resetForm(res.data.orgEvent);
    } catch (err) {
      setLoadedData(true);
      handleGlobalError(err);
    }
  }, [document.location.search, routeParams, setLoadedData, handleGlobalError]);

  function TableRow({
    participant,
    ...props
  }: {
    participant: OrgEventParticipant;
  }) {
    return (
      <Table.Row {...props}>
        <Table.Cell>
          <span>
            <strong>{participant.user.firstName}</strong>
          </span>
        </Table.Cell>
        <Table.Cell>
          <span>RegDate</span>
        </Table.Cell>
        <Table.Cell>
          <span>CloseDate</span>
        </Table.Cell>
        <Table.Cell>
          <span>Start</span>
        </Table.Cell>
        <Table.Cell>
          <span>EndDate</span>
        </Table.Cell>
        <Table.Cell textAlign="center">actions</Table.Cell>
      </Table.Row>
    );
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header">
            Manage Participants: {orgEvent?.title}
          </Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment className="flex-row-div">
              <div className="left-flex">
                <Breadcrumb>
                  <Breadcrumb.Section as={Link} to="/controlpanel">
                    Control Panel
                  </Breadcrumb.Section>
                  <Breadcrumb.Divider icon="right chevron" />
                  <Breadcrumb.Section as={Link} to='/controlpanel/eventsmanager'>
                    Events Manager
                  </Breadcrumb.Section>
                  <Breadcrumb.Divider icon="right chevron" />
                  <Breadcrumb.Section active>
                    Manage Participants
                  </Breadcrumb.Section>
                </Breadcrumb>
              </div>
            </Segment>
            <Segment loading={!loadedData}>
              <div className="flex-row-div">
                <div className="right-flex">
                  <Pagination
                    activePage={activePage}
                    totalPages={totalPages}
                    firstItem={null}
                    lastItem={null}
                    onPageChange={(e, data) =>
                      setActivePage(
                        parseInt(data.activePage?.toString() ?? "1") ?? 1
                      )
                    }
                  />
                </div>
              </div>
              <Table striped celled fixed>
                <Table.Header>
                  <Table.Row>
                    {COLUMNS.map((item) => (
                      <Table.HeaderCell key={item.key}>
                        <span>{item.text}</span>
                      </Table.HeaderCell>
                    ))}
                    <Table.HeaderCell>
                      <span>Actions</span>
                    </Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {orgEvent?.participants &&
                    orgEvent.participants.length > 0 &&
                    orgEvent.participants.map((item) => (
                      <TableRow participant={item} key={item.user.uuid} />
                    ))}
                  {orgEvent?.participants &&
                    orgEvent.participants.length === 0 && (
                      <Table.Row>
                        <Table.Cell colSpan={6}>
                          <p className="text-center">
                            <em>No participants found.</em>
                          </p>
                        </Table.Cell>
                      </Table.Row>
                    )}
                </Table.Body>
              </Table>
              <div className="flex-row-div">
                <div className="right-flex">
                  <Pagination
                    activePage={activePage}
                    totalPages={totalPages}
                    firstItem={null}
                    lastItem={null}
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
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default ManageParticipants;
