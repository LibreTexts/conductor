import {
  Grid,
  Header,
  Segment,
  Table,
  Button,
  Icon,
} from "semantic-ui-react";
import { useState } from "react";
import { OrgEvent } from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import { parseAndFormatDate } from "../../../utils/misc";
import { OrgEventFeeWaiver } from "../../../types/OrgEvent";
import FeeWaiverStatusLabel from "./FeeWaiverStatusLabel";
import FeeWaiverModal from "./FeeWaiverModal";

const TABLE_COLUMNS = [
  { key: "name", text: "Name" },
  { key: "status", text: "Status" },
  { key: "code", text: "Code" },
  { key: "percentage", text: "Percent Discount" },
  { key: "expirationDate", text: "Expiration Date" },
  { key: "actions", text: "Actions" },
];

type FeeWaiversSegmentProps = {
  feeWaivers: OrgEventFeeWaiver[];
  orgEvent: OrgEvent;
  loading: boolean;
  canEdit: boolean;
  onUpdate: () => void;
};

const FeeWaiversSegment: React.FC<FeeWaiversSegmentProps> = ({
  feeWaivers,
  orgEvent,
  loading,
  canEdit,
  onUpdate,
  ...rest
}) => {
  const [showFeeWaiverModal, setShowFeeWaiverModal] = useState(false);
  const [feeWaiverToEdit, setFeeWaiverToEdit] = useState<OrgEventFeeWaiver>();

  function handleCloseFeeWaiverModal() {
    setShowFeeWaiverModal(false);
    setFeeWaiverToEdit(undefined);
    onUpdate();
  }

  function handleOpenFeeWaiverModal(feeWaiver?: OrgEventFeeWaiver) {
    setFeeWaiverToEdit(feeWaiver);
    setShowFeeWaiverModal(true);
  }

  function TableRow({ feeWaiver, ...props }: { feeWaiver: OrgEventFeeWaiver }) {
    return (
      <Table.Row {...props}>
        <Table.Cell>
          <span>{feeWaiver.name}</span>
        </Table.Cell>
        <Table.Cell>
          <FeeWaiverStatusLabel active={feeWaiver.active} />
        </Table.Cell>
        <Table.Cell>
          <span>
            {feeWaiver.code}
            <Icon
              name="copy"
              color="blue"
              className="ml-1p"
              style={{ cursor: "pointer" }}
              onClick={() => {
                navigator.clipboard.writeText(feeWaiver.code);
                alert("Copied code to clipboard");
              }}
            />
          </span>
        </Table.Cell>
        <Table.Cell>
          <span>{feeWaiver.percentage}%</span>
        </Table.Cell>
        <Table.Cell>
          <span>
            {parseAndFormatDate(feeWaiver.expirationDate, "MM/dd/yyyy hh:mm aa")}
            {" "}
            ({feeWaiver.timeZone.abbrev})
          </span>
        </Table.Cell>
        <Table.Cell textAlign="center">
          <Button.Group vertical fluid>
            <Button
              color="blue"
              onClick={() => handleOpenFeeWaiverModal(feeWaiver)}
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
    <Grid.Column {...rest}>
      <Header
        as="h2"
        dividing
        className="flex-row-div  flex-row-verticalcenter"
      >
        <span>Fee Waivers</span>
        <div className="right-flex">
          <Button color="green" onClick={() => handleOpenFeeWaiverModal()}>
            <Icon name="plus" />
            Add Fee Waiver
          </Button>
        </div>
      </Header>
      <Segment.Group size="large" raised className="mb-4p">
        <Segment loading={loading}>
          <Table striped celled size="small">
            <Table.Header>
              <Table.Row>
                {TABLE_COLUMNS.map((col) => {
                  return (
                    <Table.HeaderCell key={col.key}>
                      <span>{col.text}</span>
                    </Table.HeaderCell>
                  );
                })}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {(feeWaivers && feeWaivers.length > 0) && (
                feeWaivers.map((item) => <TableRow feeWaiver={item} key={item.code} />)
              )}
              {(!feeWaivers || feeWaivers.length === 0 )&& (
                <Table.Row>
                  <Table.Cell colSpan={TABLE_COLUMNS.length}>
                    <p className="text-center">
                      <em>No fee waivers found.</em>
                    </p>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </Segment>
      </Segment.Group>
      <FeeWaiverModal
        show={showFeeWaiverModal}
        orgEvent={orgEvent}
        feeWaiverToEdit={feeWaiverToEdit}
        onClose={handleCloseFeeWaiverModal}
      />
    </Grid.Column>
  );
};

export default FeeWaiversSegment;
