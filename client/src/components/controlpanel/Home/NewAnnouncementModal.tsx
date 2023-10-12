import {
  Button,
  Form,
  Icon,
  Modal,
  ModalProps,
  TextArea,
} from "semantic-ui-react";
import axios from "axios";
import { useState, useEffect } from "react";
import useGlobalError from "../../error/ErrorHooks";
import { useForm } from "react-hook-form";
import { Announcement } from "../../../types";
import { useTypedSelector } from "../../../state/hooks";
import CtlTextInput from "../../ControlledInputs/CtlTextInput";
import { required } from "../../../utils/formRules";

interface NewAnnouncementModalProps extends ModalProps {
  show: boolean;
  onDataChange: () => void;
  onClose: () => void;
}

const NewAnnouncementModal: React.FC<NewAnnouncementModalProps> = ({
  show,
  onDataChange,
  onClose,
  ...rest
}) => {
  // Global State & Hooks
  const user = useTypedSelector((state) => state.user);
  const org = useTypedSelector((state) => state.org);
  const { handleGlobalError } = useGlobalError();
  const { control, watch, setValue, getValues, formState, reset } =
    useForm<Announcement>({
      defaultValues: {
        title: "",
        message: "",
        org: org.orgID,
      },
    });

  // Data & UI
  const [loading, setLoading] = useState<boolean>(false);
  const [global, setGlobal] = useState<boolean>(false);

  // Effects
  useEffect(() => {
    if (show) {
      reset();
    }
  }, [show]);

  useEffect(() => {
    if (watch("org") === "global") {
      setGlobal(true);
      return;
    }
    setGlobal(false);
  }, [watch("org")]);

  // Methods & Handlers
  function handleChangeGlobal(checked?: boolean) {
    if (checked === undefined || checked === null) return;
    if (checked) {
      setValue("org", "global");
      return;
    }
    setValue("org", org.orgID);
  }

  /**
   * Submit data via POST to the server, then
   * closes the modal on success.
   */
  async function postNewAnnouncement() {
    try {
      setLoading(true);
      const res = await axios.post("/announcement", {
        title: getValues("title"),
        message: getValues("message"),
        global: global,
      });

      if (res.data.err) {
        throw res.data.errMsg;
      }
      onDataChange();
      onClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      onClose={() => onClose()}
      open={show}
      closeOnDimmerClick={false}
      {...rest}
    >
      <Modal.Header>New Announcement</Modal.Header>
      <Modal.Content scrolling>
        <Form noValidate loading={loading}>
          <CtlTextInput
            control={control}
            name="title"
            label="Title"
            placeholder="Enter title..."
            rules={required}
            required
          />
          {
            // TODO: Conver to CtlTextArea after merged in
          }
          <Form.Field required error={formState.errors.message}>
            <label>Message</label>
            <TextArea
              placeholder="Enter announcement text..."
              value={watch("message")}
              onInput={(e) => setValue("message", e.currentTarget.value)}
            />
          </Form.Field>
          {user.hasOwnProperty("isSuperAdmin") &&
            user.isSuperAdmin === true && (
              <div className="mb-2p">
                <p>
                  <strong>
                    <em>Super Administrator Options</em>
                  </strong>{" "}
                  <span className="muted-text">(use caution)</span>
                </p>
                <Form.Field>
                  <Form.Checkbox
                    onChange={(e, d) => handleChangeGlobal(d.checked)}
                    checked={global}
                    label="Send globally"
                  />
                </Form.Field>
              </div>
            )}
        </Form>
        <span>
          <em>
            This announcement will be available to
            {global
              ? " all Conductor users (global)."
              : ` all members of ${org.shortName}.`}
          </em>
        </span>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button
          color="green"
          onClick={postNewAnnouncement}
          icon
          labelPosition="right"
        >
          Post Announcement
          <Icon name="announcement" />
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default NewAnnouncementModal;
