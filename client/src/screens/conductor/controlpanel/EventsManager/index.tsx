import { useState, useEffect, useCallback } from "react";
import { Link, useHistory } from "react-router-dom";
import axios from "axios";
import {
  Breadcrumb,
  Button,
  Dropdown,
  Grid,
  Header,
  Icon,
  Input,
  Pagination,
  Segment,
  Table,
} from "semantic-ui-react";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { itemsPerPageOptions } from "../../../../components/util/PaginationOptions";
import "../../../../components/controlpanel/ControlPanel.css";
import { GenericKeyTextValueObj, OrgEvent } from "../../../../types";
import { parseSortOption } from "../../../../utils/misc";
import { format as formatDate, parseISO } from "date-fns";
const COLUMNS = [
  { key: "title", text: "Title" },
  { key: "regOpen", text: "Reg Open Date" },
  { key: "regClose", text: "Reg Close Date" },
  { key: "startDate", text: "Event Start Date" },
  { key: "endDate", text: "Event End Date" },
];

/**
 * The Books Manager interface allows administrators to manage the Books
 * displayed in their Campus Commons and add them to Collections.
 */
const EventsManager = () => {
  // Global State and Error Handling
  const { handleGlobalError } = useGlobalError();
  const history = useHistory();

  // Data
  const [orgEvents, setOrgEvents] = useState<OrgEvent[]>([]);

  // UI
  const [activePage, setActivePage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [loadedData, setLoadedData] = useState<boolean>(true);

  /**
   * Retrieve the master catalog from the server and save it into state.
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

      setOrgEvents(orgEventRes.data.orgEvents);
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
            <strong>{orgEvent.title}</strong>
          </span>
        </Table.Cell>
        <Table.Cell>
          <span>
            {formatDate(
              parseISO(orgEvent.regOpenDate.toString()),
              "MM/dd/yyyy hh:mm aa"
            )}
          </span>
        </Table.Cell>
        <Table.Cell>
          <span>
            {formatDate(
              parseISO(orgEvent.regCloseDate.toString()),
              "MM/dd/yyyy hh:mm aa"
            )}
          </span>
        </Table.Cell>
        <Table.Cell>
          <span>
            {formatDate(
              parseISO(orgEvent.startDate.toString()),
              "MM/dd/yyyy hh:mm aa"
            )}
          </span>
        </Table.Cell>
        <Table.Cell>
          <span>
            {formatDate(
              parseISO(orgEvent.endDate.toString()),
              "MM/dd/yyyy hh:mm aa"
            )}
          </span>
        </Table.Cell>
        <Table.Cell textAlign="center">
          <Button.Group vertical fluid>
            <Button
              color="green"
              as="a"
              href={`/controlpanel/eventsmanager/edit/${orgEvent.eventID}/participants`}
              target="_blank"
            >
              <Icon name="eye" />
              View Attendees
            </Button>
            <Button
              color="blue"
              as="a"
              href={`/controlpanel/eventsmanager/edit/${orgEvent.eventID}`}
              target="_blank"
            >
              <Icon name="edit" />
              Edit
            </Button>
          </Button.Group>
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
