import { Button, Icon, Modal, Form, Accordion } from "semantic-ui-react";
import CtlTextInput from "../../ControlledInputs/CtlTextInput";
import useGlobalError from "../../error/ErrorHooks";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { OrgEvent, OrgEventFeeWaiver } from "../../../types/OrgEvent";
import { required } from "../../../utils/formRules";
import CtlDateInput from "../../ControlledInputs/CtlDateInput";
import CtlTimeInput from "../../ControlledInputs/CtlTimeInput";
import CtlTimeZoneInput from "../../ControlledInputs/CtlTimeZoneInput";
import { PTDefaultTimeZone } from "../../TimeZoneInput";
import axios from "axios";

type FeeWaiverModalProps = {
  orgEvent: OrgEvent;
  show: boolean;
  feeWaiverToEdit?: OrgEventFeeWaiver;
  onClose: () => void;
};

const FeeWaiverModal: React.FC<FeeWaiverModalProps> = ({
  orgEvent,
  show,
  feeWaiverToEdit,
  onClose,
  ...props
}) => {
  const { handleGlobalError } = useGlobalError();
  const {
    control,
    getValues,
    setValue,
    watch: watchValue,
    reset,
  } = useForm<OrgEventFeeWaiver>({
    defaultValues: {
      name: "",
      active: true,
      percentage: 1,
      timeZone: PTDefaultTimeZone,
    },
  });
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!orgEvent) {
      handleGlobalError("Event not found");
      return;
    }

    if (feeWaiverToEdit) {
      setMode("edit");
      reset(feeWaiverToEdit);
    } else {
      setMode("create");
      reset();
    }
  }, [show, feeWaiverToEdit]);

  async function handleSave() {
    try {
      setLoading(true);
      if (mode === "create") {
        await createFeeWaiver();
      } else {
        await updateFeeWaiver();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function createFeeWaiver() {
    try {
      const feeWaiver = getValues();
      const res = await axios.post(
        `/orgevents/${orgEvent.eventID}/feewaivers`,
        feeWaiver
      );
      if (res.data.err) {
        throw new Error(res.data.err);
      }
      onClose();
    } catch (err) {
      handleGlobalError(err);
    }
  }

  async function updateFeeWaiver() {
    try {
      const feeWaiver = getValues();
      const res = await axios.patch(
        `/orgevents/${orgEvent.eventID}/feewaivers/${feeWaiver.code}`,
        feeWaiver
      );
      if (res.data.err) {
        throw new Error(res.data.err);
      }
      onClose();
    } catch (err) {
      handleGlobalError(err);
    }
  }

  return (
    <Modal size="large" open={show} onClose={onClose} {...props}>
      <Modal.Header>
        {mode === "create" ? "Create" : "Edit"} Fee Waiver
      </Modal.Header>
      <Modal.Content scrolling className="mb-4p">
        <p className="mb-4p">
          Create a fee waiver to share a discount code with participants.
          Discounts can be partial or full (100%). Fee waivers can be
          inactivated at any time, if necessary. Fee waiver names must be unique within an event.{" "}
          <strong>
            Discount percentages cannot be changed after creation.
          </strong>
        </p>

        <Form noValidate loading={loading}>
          <CtlTextInput
            name="name"
            control={control}
            rules={required}
            label="Fee Waiver Name"
            placeholder="Enter Fee Waiver Name..."
          />
          <Form.Checkbox
            id="feewaiver-active"
            label={
              <label className="form-field-label" htmlFor="feewaiver-active">
                Active
              </label>
            }
            checked={watchValue("active") ?? false}
            onChange={(_e, { checked }) => {
              setValue("active", checked ?? false);
            }}
          />
          <CtlTextInput
            name="percentage"
            control={control}
            rules={required}
            label="Discount Percentage (1-100%)"
            placeholder="Enter Discount Percentage..."
            type="number"
            min={1}
            max={100}
            disabled={mode === "edit"}
          />
          <div className="flex-row-div left-flex">
            <CtlDateInput
              name="expirationDate"
              control={control}
              rules={required}
              label="Expiration Date"
              value={getValues("expirationDate")}
              error={false}
              className="my-2p"
            />
            <CtlTimeInput
              label="Expiration Time"
              value={getValues("expirationDate")}
              name="expirationDate"
              control={control}
              className="my-2p ml-2p"
            />
            <CtlTimeZoneInput
              name="timeZone"
              control={control}
              label="Time Zone (applies to all dates/times)"
              value={getValues("timeZone")}
              className="my-2p ml-2p"
            />
          </div>
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose} color="grey">
          Cancel
        </Button>
        <Button onClick={handleSave} color="green">
          <Icon name="save" />
          {mode === "create" ? "Create" : "Save"}
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default FeeWaiverModal;
