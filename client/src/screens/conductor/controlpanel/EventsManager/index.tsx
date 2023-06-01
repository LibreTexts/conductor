import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Breadcrumb,
  Button,
  Grid,
  Header,
  Icon,
  Pagination,
  Segment,
  Table,
} from "semantic-ui-react";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { parseAndFormatDate } from "../../../../utils/misc";
import "../../../../components/controlpanel/ControlPanel.css";
import { OrgEvent } from "../../../../types";
import { initOrgEventDates } from "../../../../utils/orgEventsHelpers";
const COLUMNS = [
  { key: "title", text: "Title" },
  { key: "regOpen", text: "Registration Open Date" },
  { key: "regClose", text: "Registration Close Date" },
  { key: "startDate", text: "Event Start Date" },
  { key: "endDate", text: "Event End Date" },
];

/**
 * The Events Manager interface allows Campus Administrators to create events
 * with custom registration forms for participants
 */
const EventsManager = () => {
  const DATE_FORMAT_STRING = "MM/dd/yyyy hh:mm aa";

  // Global State and Error Handling
  const { handleGlobalError } = useGlobalError();

  // Data
  const [orgEvents, setOrgEvents] = useState<OrgEvent[]>([]);

  // UI
  const [activePage, setActivePage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [loadedData, setLoadedData] = useState<boolean>(true);

  /**
   * Retrieve events from the server and save it into state.
   */
  const getOrgEvents = useCallback(async () => {
    setLoadedData(false);
    try {
      const orgEventRes = await axios.get(`/orgevents?page=${activePage}`);
      if (orgEventRes.data.err) {
        throw new Error(orgEventRes.data.errMsg);
      }

      if (!Array.isArray(orgEventRes.data.orgEvents)) {
        throw new Error("Error parsing server data.");
      }

      setOrgEvents(
        orgEventRes.data.orgEvents.map((item: OrgEvent) =>
          initOrgEventDates(item)
        )
      );
      setTotalPages(Math.ceil(orgEventRes.data.totalCount / 25));
      setTotalItems(orgEventRes.data.totalCount);
    } catch (e) {
      handleGlobalError(e);
    }
    setLoadedData(true);
  }, [setOrgEvents, setTotalItems, setLoadedData, handleGlobalError]);

  /**
   * Set page title on initial load.
   */
  useEffect(() => {
    document.title = "LibreTexts Conductor | Events Manager";
    getOrgEvents();
  }, []);

  function TableRow({ orgEvent, ...props }: { orgEvent: OrgEvent }) {
    return (
      <Table.Row {...props}>
        <Table.Cell>
          <span>
            <Link to={`/controlpanel/eventsmanager/edit/${orgEvent.eventID}`}>
              {orgEvent.title}
            </Link>
          </span>
        </Table.Cell>
        <Table.Cell>
          <span>
            {parseAndFormatDate(orgEvent.regOpenDate, DATE_FORMAT_STRING)} (
            {orgEvent.timeZone.abbrev})
          </span>
        </Table.Cell>
        <Table.Cell>
          <span>
            {parseAndFormatDate(orgEvent.regCloseDate, DATE_FORMAT_STRING)} (
            {orgEvent.timeZone.abbrev})
          </span>
        </Table.Cell>
        <Table.Cell>
          <span>
            {parseAndFormatDate(orgEvent.startDate, DATE_FORMAT_STRING)} (
            {orgEvent.timeZone.abbrev})
          </span>
        </Table.Cell>
        <Table.Cell>
          <span>
            {parseAndFormatDate(orgEvent.endDate, DATE_FORMAT_STRING)} (
            {orgEvent.timeZone.abbrev})
          </span>
        </Table.Cell>
      </Table.Row>
    );
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header">Events Manager</Header>
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
                  <Breadcrumb.Section active>Events Manager</Breadcrumb.Section>
                </Breadcrumb>
              </div>
              <div className="right-flex">
                <Button
                  as={Link}
                  to="/controlpanel/eventsmanager/create"
                  color="green"
                >
                  <Icon name="add" />
                  New Event
                </Button>
              </div>
            </Segment>
            <Segment loading={!loadedData}>
              <Table striped celled fixed>
                <Table.Header>
                  <Table.Row>
                    {COLUMNS.map((item) => (
                      <Table.HeaderCell key={item.key}>
                        <span>{item.text}</span>
                      </Table.HeaderCell>
                    ))}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {orgEvents.length > 0 &&
                    orgEvents.map((item) => (
                      <TableRow orgEvent={item} key={item.eventID} />
                    ))}
                  {orgEvents.length === 0 && (
                    <Table.Row>
                      <Table.Cell colSpan={6}>
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

export default EventsManager;
