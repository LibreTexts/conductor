import { useState, FC } from "react";
import {
  Accordion,
  Button,
  Form,
  Grid,
  Header,
  Icon,
  Modal,
  Popup,
} from "semantic-ui-react";
import { OrgEvent } from "../../../types";
import {
  Control,
  UseFormGetValues,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";
import CtlTextInput from "../../ControlledInputs/CtlTextInput";
import CtlDateInput from "../../ControlledInputs/CtlDateInput";
import CtlTimeInput from "../../ControlledInputs/CtlTimeInput";
import CtlTimeZoneInput from "../../ControlledInputs/CtlTimeZoneInput";
import { useTypedSelector } from "../../../state/hooks";
import { required } from "../../../utils/formRules";
import CancelEventModal from "./CancelEventModal";

interface EventSettingsModalParams {
  show: boolean;
  canEdit: boolean;
  control: Control<OrgEvent>;
  getValuesFn: UseFormGetValues<OrgEvent>;
  setValueFn: UseFormSetValue<OrgEvent>;
  watchValuesFn: UseFormWatch<OrgEvent>;
  onClose: () => void;
  onRequestSave: () => void;
  onRequestCancelEvent: () => void;
}

/**
 * Modal tool to view and approve or deny an Instructor Account Request.
 */
const EventSettingsModal: FC<EventSettingsModalParams> = ({
  show,
  canEdit,
  control,
  getValuesFn,
  setValueFn,
  watchValuesFn,
  onClose,
  onRequestSave,
  onRequestCancelEvent,
}) => {
  // Global state & error handling
  const org = useTypedSelector((state) => state.org);

  // UI
  const [loading, setLoading] = useState<boolean>(false);
  const [showCancelEventModal, setShowCancelEventModal] =
    useState<boolean>(false);

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
              name="regOpenDate"
              control={control}
              rules={required}
              label="Registration Open Date"
              value={getValuesFn("regOpenDate")}
              error={false}
              className="my-2p"
            />
            <CtlTimeInput
              label="Registration Open Time"
              value={getValuesFn("regOpenDate")}
              name="regOpenDate"
              control={control}
              className="my-2p ml-2p"
            />
            <CtlTimeZoneInput
              name="timeZone"
              control={control}
              label="Time Zone (applies to all dates/times)"
              value={getValuesFn("timeZone")}
              className="my-2p ml-2p"
            />
          </div>
          <div className="flex-row-div left-flex">
            <CtlDateInput
              name="regCloseDate"
              control={control}
              rules={required}
              label="Registration Close Date"
              value={getValuesFn("regCloseDate")}
              error={false}
              className="my-2p"
            />
            <CtlTimeInput
              label="Registration Close Time"
              value={getValuesFn("regCloseDate")}
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
              value={getValuesFn("startDate")}
              error={false}
              className="my-2p"
            />
            <CtlTimeInput
              label="Event Start Time"
              value={getValuesFn("startDate")}
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
              value={getValuesFn("endDate")}
              error={false}
              className="my-2p"
            />
            <CtlTimeInput
              label="Event End Time"
              value={getValuesFn("endDate")}
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
            checked={watchValuesFn("collectShipping") ?? false}
            onChange={(_e, { checked }) => {
              setValueFn("collectShipping", checked ?? false);
            }}
            disabled={!canEdit}
          />
          {/*Danger zone options only applicable when editing */}
          {getValuesFn("eventID") && (
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
            <Button color="green" loading={loading} onClick={onRequestSave}>
              <Icon name="save" />
              Save
            </Button>
          </div>
        </div>
      </Modal.Actions>
      <CancelEventModal
        show={showCancelEventModal}
        eventID={watchValuesFn("eventID")}
        onClose={() => setShowCancelEventModal(false)}
        onConfirm={onRequestCancelEvent}
      />
    </Modal>
  );
};

export default EventSettingsModal;
