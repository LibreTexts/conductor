import {
  Grid,
  Header,
  Segment,
  Breadcrumb,
  Table,
  Pagination,
  Button,
  Icon,
} from "semantic-ui-react";
import { Link, useHistory, useParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import {
  OrgEvent,
  OrgEventParticipant,
  OrgEventParticipantFormResponse,
} from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { isEmptyString } from "../../../../components/util/HelperFunctions";
import axios from "axios";
import { getLikertResponseText } from "../../../../components/util/LikertHelpers";

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
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  const [pageParticipants, setPageParticipants] = useState<
    OrgEventParticipant[]
  >([]);
  const [loadedData, setLoadedData] = useState<boolean>(true);
  const [tableColumns, setTableColumns] = useState<
    { key: string; text: string }[]
  >([]);

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

      const res = await axios.get(`/orgevents/${orgEventID}`);
      setLoadedData(true);
      if (res.data.err) {
        handleGlobalError(res.data.errMsg);
      }

      setOrgEvent(res.data.orgEvent);
      if (Array.isArray(res.data.orgEvent.participants)) {
        setTotalItems(res.data.orgEvent.participants.length);
      }
    } catch (err) {
      setLoadedData(true);
      handleGlobalError(err);
    }
  }, [document.location.search, routeParams, setLoadedData, handleGlobalError]);

  useEffect(() => {
    if (!orgEvent?.participants) return;
    setTotalPages(Math.ceil(orgEvent.participants.length / itemsPerPage));
    setPageParticipants(
      orgEvent.participants.slice(
        (activePage - 1) * itemsPerPage,
        activePage * itemsPerPage
      )
    );
  }, [orgEvent, itemsPerPage, activePage, setTotalPages, setPageParticipants]);
  /**
   * Get registration form prompts and prepare them for table UI
   */
  useEffect(() => {
    if (!orgEvent || !orgEvent.prompts) return;
    setTableColumns([
      ...tableColumns,
      ...orgEvent.prompts.map((p) => {
        return {
          key: p.promptText,
          text: p.promptText,
        };
      }),
    ]);
  }, [orgEvent]);

  function getResponseValText(prompt: OrgEventParticipantFormResponse): string {
    const foundPrompt = orgEvent?.prompts.find(
      (p) => p.order === prompt.promptNum
    );
    if (!foundPrompt) return "";

    if (["3-likert", "5-likert", "7-likert"].includes(foundPrompt.promptType)) {
      return getLikertResponseText(
        foundPrompt.promptType,
        parseInt(prompt.responseVal ?? "")
      );
    }

    return prompt.responseVal ?? "";
  }

  function TableRow({
    participant,
    ...props
  }: {
    participant: OrgEventParticipant;
  }) {
    return (
      <Table.Row {...props}>
        <Table.Cell>
          <span>{participant.user.firstName}</span>
        </Table.Cell>
        <Table.Cell>
          <span>{participant.user.lastName}</span>
        </Table.Cell>
        {participant.formResponses.map((r) => {
          return (
            <Table.Cell key={r.promptNum}>{getResponseValText(r)}</Table.Cell>
          );
        })}
        <Table.Cell textAlign="center">
          <Button.Group vertical fluid>
            <Button color="red">
              <Icon name="cancel" />
              Drop
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
                  <Breadcrumb.Section
                    as={Link}
                    to="/controlpanel/eventsmanager"
                  >
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
                <div className="left-flex">
                  <span>
                    Displaying {pageParticipants.length} of {totalItems}{" "}
                    participants.
                  </span>
                </div>
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
                    <Table.HeaderCell key="firstName">
                      <span>First Name</span>
                    </Table.HeaderCell>
                    <Table.HeaderCell key="lastName">
                      <span>Last Name</span>
                    </Table.HeaderCell>
                    {tableColumns.map((item) => (
                      <Table.HeaderCell key={item.key}>
                        <span>{item.text}</span>
                      </Table.HeaderCell>
                    ))}
                    <Table.HeaderCell key="actions">
                      <span>Actions</span>
                    </Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {pageParticipants &&
                    pageParticipants.length > 0 &&
                    pageParticipants.map((item) => (
                      <TableRow participant={item} key={item.user.uuid} />
                    ))}
                  {pageParticipants && pageParticipants.length === 0 && (
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
