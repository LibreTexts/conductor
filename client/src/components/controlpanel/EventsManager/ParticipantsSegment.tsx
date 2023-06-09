//import "../../../styles/global.css";
import {
  Grid,
  Header,
  Segment,
  Table,
  Pagination,
  Button,
  Icon,
} from "semantic-ui-react";
import { useEffect, useState } from "react";
import {
  OrgEvent,
  OrgEventParticipant,
  OrgEventParticipantFormResponse,
} from "../../../types";
import { isEmptyString } from "../../util/HelperFunctions";
import { getLikertResponseText } from "../../util/LikertHelpers";
import PaymentStatusLabel from "./PaymentStatusLabel";

type ParticipantsSegmentProps = {
  show: boolean;
  toggleVisibility: () => void;
  orgEvent: OrgEvent;
  participants: OrgEventParticipant[];
  loading: boolean;
  canEdit: boolean;
  activePage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onDownloadParticipants: () => void;
  onChangeActivePage: (page: number) => void;
};

const ParticipantsSegment: React.FC<ParticipantsSegmentProps> = ({
  show,
  toggleVisibility,
  orgEvent,
  participants,
  loading,
  canEdit,
  activePage,
  totalPages,
  totalItems,
  itemsPerPage,
  onDownloadParticipants,
  onChangeActivePage,
  ...rest
}) => {
  // UI
  const [tableColumns, setTableColumns] = useState<
    { key: string; text: string }[]
  >([]);

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

    if (
      foundPrompt.promptType === "text" &&
      prompt.responseVal !== undefined &&
      isEmptyString(prompt.responseVal)
    ) {
      return "(No Response)";
    }

    return prompt.responseVal ?? "UNKNOWN VALUE";
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
        <Table.Cell>
          <span>{participant.user.email}</span>
        </Table.Cell>
        {orgEvent.collectShipping && (
          <Table.Cell>
            <span>
              {participant.shippingAddress?.lineOne}
              {participant.shippingAddress?.lineTwo
                ? `, ${participant.shippingAddress.lineTwo}`
                : ""}
              {", " + participant.shippingAddress?.city}
              {", " + participant.shippingAddress?.state}
              {" " + participant.shippingAddress?.zip}
              {" " + participant.shippingAddress?.country}
            </span>
          </Table.Cell>
        )}
        <Table.Cell>
          <PaymentStatusLabel paymentStatus={participant.paymentStatus} />
        </Table.Cell>
        {participant.formResponses.map((r) => {
          return (
            <Table.Cell key={r.promptNum}>{getResponseValText(r)}</Table.Cell>
          );
        })}
      </Table.Row>
    );
  }

  if (!show) {
    return (
      <Grid.Column {...rest}>
        <Header
          as="h2"
          dividing
          className="flex-row-div  flex-row-verticalcenter"
        >
          <span>Participants</span>
          <div className="right-flex">
            <Button onClick={toggleVisibility}>Show</Button>
          </div>
        </Header>
        <Segment.Group size="large" raised className="mb-4p">
          <Segment loading={loading}>
            <span>Collapsed for brevity... Click "Show" to view</span>
          </Segment>
        </Segment.Group>
      </Grid.Column>
    );
  }

  return (
    <Grid.Column {...rest}>
      <Header
        as="h2"
        dividing
        className="flex-row-div  flex-row-verticalcenter"
      >
        <span>Participants</span>
        <div className="right-flex">
          <Button onClick={toggleVisibility}>Hide</Button>
        </div>
      </Header>
      <Segment.Group size="large" raised className="mb-4p">
        <Segment loading={loading}>
          <div className="x-scroll-table-container">
            <Table striped celled size="small" className="mb-05p">
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell key="firstName" collapsing>
                    <span>First Name</span>
                  </Table.HeaderCell>
                  <Table.HeaderCell key="lastName" collapsing>
                    <span>Last Name</span>
                  </Table.HeaderCell>
                  <Table.HeaderCell key="email" collapsing>
                    <span>Email Address</span>
                  </Table.HeaderCell>
                  {orgEvent.collectShipping && (
                    <Table.HeaderCell key="shippingAddress" collapsing>
                      <span>Shipping Address</span>
                    </Table.HeaderCell>
                  )}
                  <Table.HeaderCell key="paymentStatus" collapsing>
                    <span>Payment Status</span>
                  </Table.HeaderCell>
                  {tableColumns.map((item) => (
                    <Table.HeaderCell key={item.key} collapsing>
                      <span>{item.text}</span>
                    </Table.HeaderCell>
                  ))}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {participants &&
                  participants.length > 0 &&
                  participants.map((item) => (
                    <TableRow participant={item} key={item.user.uuid} />
                  ))}
                {(!participants || participants.length === 0) && (
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
          </div>
          <div className="flex-row-div mt-1p">
            <div className="left-flex">
              <p style={{ fontSize: "0.9em" }}>
                Displaying {participants ? participants.length : 0} of{" "}
                {totalItems} participants.
              </p>
            </div>
            <div className="right-flex flex-row-verticalcenter">
              {participants && participants.length > 0 && (
                <Button className="mr-4p" onClick={onDownloadParticipants}>
                  <Icon name="download" /> Export CSV
                </Button>
              )}
              <Pagination
                activePage={activePage}
                totalPages={totalPages}
                firstItem={null}
                lastItem={null}
                onPageChange={(e, data) =>
                  onChangeActivePage(
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
