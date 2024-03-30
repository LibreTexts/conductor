import { useState, FC, useEffect } from "react";
import { Accordion, Button, Form, Icon, Modal, Popup } from "semantic-ui-react";
import { OrgEvent } from "../../../types";
import { useForm } from "react-hook-form";
import CtlTextInput from "../../ControlledInputs/CtlTextInput";
import CtlDateInput from "../../ControlledInputs/CtlDateInput";
import CtlTimeInput from "../../ControlledInputs/CtlTimeInput";
import CtlTimeZoneInput from "../../ControlledInputs/CtlTimeZoneInput";
import { useTypedSelector } from "../../../state/hooks";
import { required } from "../../../utils/formRules";
import CancelEventModal from "./CancelEventModal";
import { utcToZonedTime } from "date-fns-tz";
import { parseISO } from "date-fns";
import useGlobalError from "../../error/ErrorHooks";
import { initOrgEventDates } from "../../../utils/orgEventsHelpers";
import axios from "axios";
import {  useParams } from "react-router-dom";
 

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
  
  // Reset form with incoming data when modal is opened
  useEffect(() => {
    if (show) {
      resetForm(orgEvent);
    }
  }, [show]);

  // Global state & error handling
  const org = useTypedSelector((state) => state.org);
  const routeParams = useParams<{ mode: string; eventID?: string }>();
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
  const [duplicateID, setDuplicateID] = useState<string|undefined>("");


  /**
   * Resets the tool to its initial state, then activates the provided `onClose` handler.
   */
  function handleClose() {
    setLoading(false);
    onClose();
  }
  useEffect(() => {
    if( routeParams.eventID !== ""){
      setDuplicateID(routeParams.eventID);
    }
  
  }, [routeParams]);
  //another useEffect for duplicateID -> grab the duplicate events and run teh loadDuplicateEvent

  const loadDuplicateEvent= async ()=>{

    try {
      if (routeParams.mode !== "create") return;
      if (!routeParams.eventID ||  routeParams.eventID === '') {
        handleGlobalError("No duplicate ID provided");
      }
      if(!duplicateID) return;
      const res = (await axios.get(`/orgevents/`)).data;
      console.log(res);

      setLoading(true);
      if (res .err) {
        handleGlobalError(res.errMsg);
      }
      let currEvent = res.orgEvents.filter((event:any)=>event._id===duplicateID)[0];
      currEvent.title = "Copy of " + currEvent.title;
      resetForm(initOrgEventDates(currEvent));
      setLoading(false);

      // getOrgParticipants();
      // getOrgEventFeeWaivers();
    } catch (err) {
      setLoading(true);
      handleGlobalError(err);
    }
  }
  useEffect(() => {
    if(duplicateID){
      loadDuplicateEvent();
    }

  }, [duplicateID]);

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
              name="regOpenDate"
              control={control}
              rules={required}
              label="Registration Open Date"
              value={getValues("regOpenDate")}
              error={false}
              className="my-2p"
            />
            <CtlTimeInput
              label="Registration Open Time"
              value={getValues("regOpenDate")}
              name="regOpenDate"
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
          <div className="flex-row-div left-flex">
            <CtlDateInput
              name="regCloseDate"
              control={control}
              rules={required}
              label="Registration Close Date"
              value={getValues("regCloseDate")}
              error={false}
              className="my-2p"
            />
            <CtlTimeInput
              label="Registration Close Time"
              value={getValues("regCloseDate")}
              name="regCloseDate"
              control={control}
              className="my-2p ml-2p"
            />
          </div>
          <div className="flex-row-div left-flex">
            <CtlDateInput
              name="startDate"
              control={control}
              rules={required}
              label="Event Start Date"
              value={getValues("startDate")}
              error={false}
              className="my-2p"
            />
            <CtlTimeInput
              label="Event Start Time"
              value={getValues("startDate")}
              name="startDate"
              control={control}
              className="my-2p ml-2p"
            />
          </div>

          <div className="flex-row-div left-flex">
            <CtlDateInput
              name="endDate"
              control={control}
              rules={required}
              label="Event End Date"
              value={getValues("endDate")}
              error={false}
              className="my-2p"
            />
            <CtlTimeInput
              label="Event End Time"
              value={getValues("endDate")}
              name="endDate"
              control={control}
              className="my-2p ml-2p"
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
          {getValues("eventID") && (
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
