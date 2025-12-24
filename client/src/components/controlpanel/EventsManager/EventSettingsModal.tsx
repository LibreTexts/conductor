import { useState, FC, useEffect } from "react";
import { Accordion, Button, Form, Icon, Modal, Popup } from "semantic-ui-react";
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

/**
 * Modal tool to view and approve or deny an Instructor Account Request.
 */

const EventSettingsModal: FC<EventSettingsModalParams> = ({
  show,
  canEdit,
  orgEvent,
  onClose,
  onRequestSave,
  onRequestCancelEvent,
}) => {
  // Global state & error handling
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

  // UI
  const [loading, setLoading] = useState<boolean>(false);
  const [showCancelEventModal, setShowCancelEventModal] =
    useState<boolean>(false);

  // Reset form with incoming data when modal is opened
  useEffect(() => {
    if (show) {
      resetForm(orgEvent);
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

      // Remove projectSyncID from the object (we don't want to copy this over)
      const { projectSyncID, ...withoutProjectSyncID } = currEvent;

      resetForm(initOrgEventDates(withoutProjectSyncID));
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resets the tool to its initial state, then activates the provided `onClose` handler.
   */
  function handleClose() {
    setLoading(false);
    onClose();
  }

  return (
    <Modal open={show} onClose={handleClose}>
      <Modal.Header>
        <div className="flex-row-div">
          <div className="left-flex">
            <span>Event Settings</span>
          </div>
        </div>
      </Modal.Header>
      <Modal.Content scrolling>
        <Form noValidate>
          <CtlTextInput
            name="title"
            control={control}
            rules={required}
            label="Event Title"
            placeholder="Enter Event Title..."
            disabled={!canEdit}
          />
          <div className="flex-row-div left-flex">
            <CtlDateInput
              type="datetime-local"
              name="regOpenDate"
              control={control}
              rules={required}
              label="Registration Open Date"
              value={getValues("regOpenDate")}
              error={false}
              className="my-2p"
            />
            <CtlTimeZoneInput
              name="timeZone"
              control={control}
              label="Time Zone (applies to all dates/times)"
              value={getValues("timeZone")}
              className="my-2p ml-2p"
            />
          </div>
          <div className="flex-row-div left-flex">
            <CtlDateInput
              type="datetime-local"
              name="regCloseDate"
              control={control}
              rules={required}
              label="Registration Close Date"
              value={getValues("regCloseDate")}
              error={false}
              className="my-2p"
            />
          </div>
          <div className="flex-row-div left-flex">
            <CtlDateInput
              type="datetime-local"
              name="startDate"
              control={control}
              rules={required}
              label="Event Start Date"
              value={getValues("startDate")}
              error={false}
              className="my-2p"
            />
          </div>

          <div className="flex-row-div left-flex">
            <CtlDateInput
              type="datetime-local"
              name="endDate"
              control={control}
              rules={required}
              label="Event End Date"
              value={getValues("endDate")}
              error={false}
              className="my-2p"
            />
          </div>
          {org.orgID === "libretexts" && (
            <CtlTextInput
              name="regFee"
              control={control}
              rules={required}
              label="Registration Fee"
              icon="dollar sign"
              iconPosition="left"
              placeholder="Enter Fee.."
              type="number"
              min="0"
              disabled={!canEdit}
            />
          )}
          <Form.Checkbox
            id="collect-shipping"
            className="mt-2p"
            label={
              <>
                <label className="form-field-label" htmlFor="collect-shipping">
                  Collect Participant Shipping Address{"  "}
                  <Popup
                    position="top center"
                    trigger={<Icon name="info circle" />}
                    content="If checked, participants will be prompted to provide a shipping address during registration."
                  />
                </label>
              </>
            }
            checked={watchValues("collectShipping") ?? false}
            onChange={(_e, { checked }) => {
              setValue("collectShipping", checked ?? false);
            }}
            disabled={!canEdit}
          />
          {/*Danger zone options only applicable when editing */}
          {getValues("eventID") && routeParams.mode !== "create" && (
            <Accordion
              className="mt-2p"
              panels={[
                {
                  key: "danger",
                  title: {
                    content: (
                      <span className="color-semanticred">
                        <strong>Danger Zone</strong>
                      </span>
                    ),
                  },
                  content: {
                    content: (
                      <div>
                        <p className="color-semanticred">
                          Use caution with the options in this area!
                        </p>
                        <Button
                          color="red"
                          fluid
                          onClick={() => setShowCancelEventModal(true)}
                        >
                          <Icon name="trash alternate" />
                          Cancel Event
                        </Button>
                      </div>
                    ),
                  },
                },
              ]}
            />
          )}
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <div className="flex-row-div">
          <div className="ui right-flex">
            <Button color="grey" loading={loading} onClick={handleClose}>
              Cancel
            </Button>
            <Button
              color="green"
              loading={loading}
              onClick={() => onRequestSave(getValues())}
            >
              <Icon name="save" />
              Save
            </Button>
          </div>
        </div>
      </Modal.Actions>
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
