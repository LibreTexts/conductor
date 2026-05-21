import { useState, FC, useEffect } from "react";
import { Modal, Button, Checkbox, Divider, Alert } from "@libretexts/davis-react";
import { IconDeviceFloppy, IconTrash, IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { OrgEvent } from "../../../types";
import { useForm } from "react-hook-form";
import CtlTextInput from "../../ControlledInputs/CtlTextInput";
import CtlDateInput from "../../ControlledInputs/CtlDateInput";
import CtlTimeZoneInput from "../../ControlledInputs/CtlTimeZoneInput";
import { useTypedSelector } from "../../../state/hooks";
import { required } from "../../../utils/formRules";
import CancelEventModal from "./CancelEventModal";
import useGlobalError from "../../error/ErrorHooks";
import { initOrgEventDates } from "../../../utils/orgEventsHelpers";
import axios from "axios";
import { useLocation, useParams } from "react-router-dom";

interface EventSettingsModalParams {
  show: boolean;
  canEdit: boolean;
  orgEvent: OrgEvent;
  onClose: () => void;
  onRequestSave: (newData: OrgEvent) => void;
  onRequestCancelEvent: () => void;
}

const EventSettingsModal: FC<EventSettingsModalParams> = ({
  show,
  canEdit,
  orgEvent,
  onClose,
  onRequestSave,
  onRequestCancelEvent,
}) => {
  const org = useTypedSelector((state) => state.org);
  const location = useLocation();
  const routeParams = useParams<{ mode: string }>();
  const { handleGlobalError } = useGlobalError();
  const {
    control,
    getValues,
    setValue,
    watch: watchValues,
    reset: resetForm,
  } = useForm<OrgEvent>({
    values: orgEvent,
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [showDangerZone, setShowDangerZone] = useState<boolean>(false);
  const [showCancelEventModal, setShowCancelEventModal] = useState<boolean>(false);

  useEffect(() => {
    if (show) {
      resetForm(orgEvent);
      setShowDangerZone(false);
    }
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.has("duplicateID")) {
      const _duplicateID = searchParams.get("duplicateID");
      if (!_duplicateID) return;
      loadDuplicateEvent(_duplicateID);
    }
  }, [show, location.search]);

  const loadDuplicateEvent = async (duplicateID: string) => {
    try {
      if (routeParams.mode !== "create" || !duplicateID) return;
      setLoading(true);
      const res = (await axios.get(`/orgevents/${duplicateID}`)).data;
      if (res.err) {
        handleGlobalError(res.errMsg);
      }
      const currEvent = res.orgEvent;
      currEvent.title = "Copy of " + currEvent.title;
      const { projectSyncID, ...withoutProjectSyncID } = currEvent;
      resetForm(initOrgEventDates(withoutProjectSyncID));
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  };

  function handleClose() {
    setLoading(false);
    onClose();
  }

  return (
    <Modal open={show} onClose={handleClose} size="lg">
      <Modal.Header>
        <Modal.Title>Event Settings</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body className="overflow-y-auto max-h-[70vh]">
        <div className="flex flex-col gap-4">
          <CtlTextInput
            name="title"
            control={control}
            rules={required}
            label="Event Title"
            placeholder="Enter Event Title..."
            disabled={!canEdit}
          />
          <div className="grid grid-cols-2 gap-4">
            <CtlDateInput
              type="datetime-local"
              name="regOpenDate"
              control={control}
              rules={required}
              label="Registration Open Date"
              value={getValues("regOpenDate")}
              error={false}
            />
            <CtlTimeZoneInput
              name="timeZone"
              control={control}
              label="Time Zone (applies to all dates/times)"
              value={getValues("timeZone")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <CtlDateInput
              type="datetime-local"
              name="regCloseDate"
              control={control}
              rules={required}
              label="Registration Close Date"
              value={getValues("regCloseDate")}
              error={false}
            />
            <CtlDateInput
              type="datetime-local"
              name="startDate"
              control={control}
              rules={required}
              label="Event Start Date"
              value={getValues("startDate")}
              error={false}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <CtlDateInput
              type="datetime-local"
              name="endDate"
              control={control}
              rules={required}
              label="Event End Date"
              value={getValues("endDate")}
              error={false}
            />
            {org.orgID === "libretexts" && (
              <CtlTextInput
                name="regFee"
                control={control}
                rules={required}
                label="Registration Fee ($)"
                placeholder="Enter Fee..."
                type="number"
                min="0"
                disabled={!canEdit}
              />
            )}
          </div>
          <Checkbox
            name="collect-shipping"
            label="Collect Participant Shipping Address"
            checked={watchValues("collectShipping") ?? false}
            onChange={(checked) => setValue("collectShipping", checked)}
            disabled={!canEdit}
          />
          {getValues("eventID") && routeParams.mode !== "create" && (
            <div className="mt-4">
              <Divider />
              <div className="pt-4">
              <button
                type="button"
                className="flex items-center gap-2 text-red-600 font-semibold cursor-pointer"
                onClick={() => setShowDangerZone((v) => !v)}
              >
                {showDangerZone ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                Danger Zone
              </button>
              {showDangerZone && (
                <div className="mt-3 flex flex-col gap-3">
                  <Alert
                    variant="error"
                    message="Use caution with the options in this area!"
                    showIcon
                  />
                  <Button
                    variant="destructive"
                    icon={<IconTrash size={16} />}
                    fullWidth
                    onClick={() => setShowCancelEventModal(true)}
                  >
                    Cancel Event
                  </Button>
                </div>
              )}
              </div>
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button variant="outline" loading={loading} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={<IconDeviceFloppy size={16} />}
            loading={loading}
            onClick={() => onRequestSave(getValues())}
          >
            Save
          </Button>
        </div>
      </Modal.Footer>
      <CancelEventModal
        show={showCancelEventModal}
        eventID={watchValues("eventID")}
        onClose={() => setShowCancelEventModal(false)}
        onConfirm={onRequestCancelEvent}
      />
    </Modal>
  );
};

export default EventSettingsModal;
