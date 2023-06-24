//import "../../../styles/global.css";
import {
  Grid,
  Header,
  Segment,
  Table,
  Pagination,
  Button,
  Icon,
  Checkbox,
  Message,
} from "semantic-ui-react";
import React, { useEffect, useMemo, useState } from "react";
import {
  OrgEvent,
  OrgEventParticipant,
  OrgEventParticipantFormResponse,
} from "../../../types";
import { isEmptyString } from "../../util/HelperFunctions";
import { getLikertResponseText } from "../../util/LikertHelpers";
import PaymentStatusLabel from "./PaymentStatusLabel";
import UnregisterParticipantsModal from "./UnregisterParticipantsModal";
import AddParticipantsToProjectModal from "./AddParticipantsToProjectModal";

type SelectableParticipant = OrgEventParticipant & {
  selected: boolean;
};

type ParticipantsSegmentProps = {
  show: boolean;
  toggleVisibility: () => void;
  orgEvent: OrgEvent;
  participants: OrgEventParticipant[];
  loading: boolean;
  canEdit: boolean;
  addToProjResMsg: string;
  activePage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onDownloadParticipants: () => void;
  onChangeActivePage: (page: number) => void;
  onUnregisterParticipants: (ids: string[]) => void;
  onAddParticipantsToProject: (
    participants: string[],
    projectID: string
  ) => void;
};

const ParticipantsSegment: React.FC<ParticipantsSegmentProps> = ({
  show,
  toggleVisibility,
  orgEvent,
  participants,
  loading,
  canEdit,
  addToProjResMsg,
  activePage,
  totalPages,
  totalItems,
  itemsPerPage,
  onDownloadParticipants,
  onChangeActivePage,
  onUnregisterParticipants,
  onAddParticipantsToProject,
  ...rest
}) => {
  // UI
  const [tableColumns, setTableColumns] = useState<
    { key: string; text: string }[]
  >([]);
  const [showUnregisterModal, setShowUnregisterModal] = useState(false);
  const [showAddToProjectModal, setShowAddToProjectModal] = useState(false);
  const [selectableParticipants, setSelectableParticipants] = useState<
    SelectableParticipant[]
  >([]);
  const [allSelected, setAllSelected] = useState<boolean>(false);

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

  // Reset selected participants when participants change
  useEffect(() => {
    if (!participants) return;
    setSelectableParticipants(
      participants.map((p) => {
        return {
          ...p,
          selected: false,
        };
      })
    );
  }, [participants, setSelectableParticipants]);

  const selectedParticipantsCount: number = useMemo(
    () =>
      selectableParticipants.filter((p) => {
        return p.selected;
      }).length,
    [selectableParticipants]
  );

  const selectedParticipants: OrgEventParticipant[] = useMemo(
    () =>
      selectableParticipants.filter((p) => {
        return p.selected;
      }),
    [selectableParticipants]
  );

  function resetSelectedParticipants() {
    setAllSelected(false);
    setSelectableParticipants(
      [...selectableParticipants].map((p) => {
        return {
          ...p,
          selected: false,
        };
      })
    );
  }

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

  function handleOpenUnregisterModal() {
    if (selectedParticipantsCount === 0) return;
    setShowUnregisterModal(true);
  }

  function handleUnregisterParticipant() {
    if (selectedParticipantsCount === 0) {
      setShowUnregisterModal(false);
      return;
    }

    onUnregisterParticipants(selectedParticipants.map((p) => p.user.uuid));
    resetSelectedParticipants();
    setShowUnregisterModal(false);
  }

  function handleCheckbox(participant: SelectableParticipant, checked = false) {
    if (!participant) return;

    const foundParticipant = selectableParticipants.find((p) => {
      return p.user.uuid === participant.user.uuid;
    });

    const foundIndex = selectableParticipants.findIndex((p) => {
      return p.user.uuid === participant.user.uuid;
    });

    if (!foundParticipant || foundIndex === -1) return;
    const arr = [...selectableParticipants];
    arr.splice(foundIndex, 1, { ...foundParticipant, selected: checked });
    setSelectableParticipants(arr);
    if (!checked) setAllSelected(false);
  }

  function handleSelectAllCheckbox(checked = false) {
    setAllSelected(checked);
    const arr = [...selectableParticipants].map((p) => {
      return { ...p, selected: checked };
    });
    setSelectableParticipants(arr);
  }

  function handleAddParticipantsToProject(
    participantIds: string[],
    projectID: string
  ) {
    if (selectedParticipantsCount === 0) {
      setShowAddToProjectModal(false);
      return;
    }

    onAddParticipantsToProject(participantIds, projectID);
    resetSelectedParticipants();
    setShowAddToProjectModal(false);
  }

  function TableRow({
    participant,
    selected,
    ...props
  }: {
    participant: SelectableParticipant;
    selected: boolean;
  }) {
    return (
      <Table.Row {...props}>
        <Table.Cell>
          <Checkbox
            id={`participant-${participant.user.uuid}-checkbox`}
            checked={selected}
            onClick={(e, data) => handleCheckbox(participant, data.checked)}
          />
        </Table.Cell>
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
          <div className="flex-row-div flex-row-verticalcenter mb-1p">
            <div className="left-flex">
              {addToProjResMsg && (
                <Message success>
                  <Icon name="check" />
                  {addToProjResMsg}
                </Message>
              )}
            </div>
            <div className="right-flex">
              <Button
                color="blue"
                disabled={selectedParticipantsCount === 0}
                onClick={() => setShowAddToProjectModal(true)}
              >
                <Icon name="user plus" />
                <span>Add to Project</span>
              </Button>
              <Button
                color="red"
                disabled={selectedParticipantsCount === 0}
                onClick={() => handleOpenUnregisterModal()}
              >
                <Icon name="ban" />
                <span>Unregister</span>
              </Button>
            </div>
          </div>
          <div className="x-scroll-table-container">
            <Table striped celled size="small" className="mb-05p">
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell key="actions" collapsing>
                    <Checkbox
                      id="select-all-checkbox"
                      checked={allSelected}
                      onClick={(e, data) =>
                        handleSelectAllCheckbox(data.checked)
                      }
                    />
                  </Table.HeaderCell>
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
                {selectableParticipants &&
                  selectableParticipants.length > 0 &&
                  selectableParticipants.map((item) => (
                    <TableRow
                      participant={item}
                      selected={item.selected}
                      key={item.user.uuid}
                    />
                  ))}
                {(!selectableParticipants ||
                  selectableParticipants.length === 0) && (
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
                Displaying{" "}
                {selectableParticipants ? selectableParticipants.length : 0} of{" "}
                {totalItems} participants.
              </p>
            </div>
            <div className="right-flex flex-row-verticalcenter">
              {selectableParticipants && selectableParticipants.length > 0 && (
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

      <UnregisterParticipantsModal
        show={showUnregisterModal}
        onClose={() => setShowUnregisterModal(false)}
        onConfirm={handleUnregisterParticipant}
      />
      <AddParticipantsToProjectModal
        show={showAddToProjectModal}
        selectedParticipants={selectedParticipants.map((p) => p.user.uuid)}
        onClose={() => setShowAddToProjectModal(false)}
        onConfirm={(participantIds, projectID) =>
          handleAddParticipantsToProject(participantIds, projectID)
        }
      />
    </Grid.Column>
  );
};

export default ParticipantsSegment;
