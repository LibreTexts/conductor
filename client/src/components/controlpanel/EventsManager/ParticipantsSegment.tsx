import {
  Grid,
  Header,
  Segment,
  Table,
  Pagination,
  Button,
  Icon,
} from "semantic-ui-react";
import { useEffect, useState, useCallback } from "react";
import {
  OrgEvent,
  OrgEventParticipant,
  OrgEventParticipantFormResponse,
} from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import { isEmptyString } from "../../util/HelperFunctions";
import axios from "axios";
import { getLikertResponseText } from "../../util/LikertHelpers";

type ParticipantsSegmentProps = {
  orgEvent: OrgEvent;
  loading: boolean;
  canEdit: boolean;
};

const ParticipantsSegment: React.FC<ParticipantsSegmentProps> = ({
  orgEvent,
  loading,
  canEdit,
  ...rest
}) => {
  // Global State and Error Handling
  const { handleGlobalError } = useGlobalError();

  // UI
  const [activePage, setActivePage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  const [participants, setParticipants] = useState<OrgEventParticipant[]>([]);
  const [loadedData, setLoadedData] = useState<boolean>(true);
  const [tableColumns, setTableColumns] = useState<
    { key: string; text: string }[]
  >([]);

  useEffect(() => {
    getOrgParticipants();
  }, []);

  const getOrgParticipants = useCallback(async () => {
    try {
      setLoadedData(false);
      const res = await axios.get(
        `/orgevents/${orgEvent.eventID}/participants?page=${activePage}`
      );
      if (res.data.err || !res.data.participants || !res.data.totalCount) {
        handleGlobalError(res.data.errMsg);
        return;
      }

      console.log(res);

      setParticipants(res.data.participants);
      setTotalItems(res.data.totalCount);
      setTotalPages(Math.ceil(res.data.totalCount / itemsPerPage));
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoadedData(true);
    }
  }, [
    orgEvent,
    activePage,
    itemsPerPage,
    setLoadedData,
    setParticipants,
    setTotalItems,
    setTotalPages,
    handleGlobalError,
  ]);

  /**
   * Get registration form prompts and prepare them for table UI
   */
  useEffect(() => {
    if (!orgEvent || !orgEvent.prompts) return;
    setTableColumns([
      ...orgEvent.prompts.map((p) => {
        return {
          key: p.promptText,
          text: p.promptText,
        };
      }),
    ]);
  }, [orgEvent, setTableColumns]);

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
    <Grid.Column {...rest}>
      <Header as="h2" dividing>
        Participants
      </Header>
      <Segment.Group size="large" raised className="mb-4p">
        <Segment loading={!loadedData}>
          <div className="flex-row-div">
            <div className="left-flex">
              <p style={{ fontSize: "0.9em" }}>
                Displaying {participants.length} of {totalItems} participants.
              </p>
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
          <Table striped celled size="small">
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
              {participants &&
                participants.length > 0 &&
                participants.map((item) => (
                  <TableRow participant={item} key={item.user.uuid} />
                ))}
              {participants && participants.length === 0 && (
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
  );
};

export default ParticipantsSegment;
