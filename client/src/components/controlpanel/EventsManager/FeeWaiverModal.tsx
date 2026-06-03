import { Modal, Button, Checkbox } from "@libretexts/davis-react";
import { IconDeviceFloppy, IconPlus } from "@tabler/icons-react";
import CtlTextInput from "../../ControlledInputs/CtlTextInput";
import useGlobalError from "../../error/ErrorHooks";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { OrgEvent, OrgEventFeeWaiver } from "../../../types/OrgEvent";
import { required } from "../../../utils/formRules";
import CtlDateInput from "../../ControlledInputs/CtlDateInput";
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
    <Modal open={show} onClose={onClose} size="lg">
      <Modal.Header>
        <Modal.Title>{mode === "create" ? "Create" : "Edit"} Fee Waiver</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body className="overflow-y-auto max-h-[70vh]">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Create a fee waiver to share a discount code with participants.
            Discounts can be partial or full (100%). Fee waivers can be
            inactivated at any time, if necessary. Fee waiver names must be unique within an event.{" "}
            <strong>Discount percentages cannot be changed after creation.</strong>
          </p>

          <CtlTextInput
            name="name"
            control={control}
            rules={required}
            label="Fee Waiver Name"
            placeholder="Enter Fee Waiver Name..."
          />

          <Checkbox
            name="feewaiver-active"
            label="Active"
            checked={watchValue("active") ?? false}
            onChange={(checked) => setValue("active", checked)}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CtlDateInput
              type="datetime-local"
              name="expirationDate"
              control={control}
              rules={required}
              label="Expiration Date"
              value={getValues("expirationDate")}
              error={false}
            />
            <CtlTimeZoneInput
              name="timeZone"
              control={control}
              label="Time Zone (applies to all dates/times)"
              value={getValues("timeZone")}
            />
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon={mode === "create" ? <IconPlus size={16} /> : <IconDeviceFloppy size={16} />}
            loading={loading}
            onClick={handleSave}
          >
            {mode === "create" ? "Create" : "Save"}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default FeeWaiverModal;
