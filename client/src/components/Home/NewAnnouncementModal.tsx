import { Button, Checkbox, Input, Modal, Spinner, Textarea } from "@libretexts/davis-react";
import { IconSpeakerphone } from "@tabler/icons-react";
import axios from "axios";
import { useState, useEffect } from "react";
import { Controller } from "react-hook-form";
import useGlobalError from "../error/ErrorHooks";
import { useForm } from "react-hook-form";
import { Announcement } from "../../types";
import { useTypedSelector } from "../../state/hooks";
import { required } from "../../utils/formRules";

interface NewAnnouncementModalProps {
  show: boolean;
  onDataChange: () => void;
  onClose: () => void;
}

const NewAnnouncementModal: React.FC<NewAnnouncementModalProps> = ({
  show,
  onDataChange,
  onClose,
}) => {
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

  const [loading, setLoading] = useState<boolean>(false);
  const [global, setGlobal] = useState<boolean>(false);

  useEffect(() => {
    if (show) {
      reset();
      setGlobal(false);
    }
  }, [show]);

  function handleChangeGlobal(checked: boolean) {
    setGlobal(checked);
    setValue("org", checked ? "global" : org.orgID);
  }

  async function postNewAnnouncement() {
    try {
      setLoading(true);
      const res = await axios.post("/announcement", {
        title: getValues("title"),
        message: getValues("message"),
        global,
      });
      if (res.data.err) throw res.data.errMsg;
      onDataChange();
      onClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={show} onClose={() => onClose()} size="md">
      <Modal.Header>
        <Modal.Title>New Announcement</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-4">
            <Controller
              control={control}
              name="title"
              rules={required}
              render={({ field, fieldState: { error } }) => (
                <Input
                  {...field}
                  name="title"
                  label="Title"
                  placeholder="Enter title..."
                  required
                  error={!!error}
                  errorMessage={error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="message"
              rules={required}
              render={({ field, fieldState: { error } }) => (
                <Textarea
                  {...field}
                  name="message"
                  label="Message"
                  placeholder="Enter announcement text..."
                  rows={4}
                  required
                  error={!!error}
                  errorMessage={error?.message}
                />
              )}
            />
            {user.isSuperAdmin && (
              <div>
                <p className="text-sm font-semibold mb-1">
                  <em>Super Administrator Options</em>{" "}
                  <span className="text-gray-400 font-normal">(use caution)</span>
                </p>
                <Checkbox
                  name="send-globally"
                  label="Send globally"
                  checked={global}
                  onChange={handleChangeGlobal}
                />
              </div>
            )}
            <p className="text-sm text-gray-500 italic">
              This announcement will be available to{" "}
              {global
                ? "all Conductor users (global)."
                : `all members of ${org.shortName}.`}
            </p>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={postNewAnnouncement}
          loading={loading}
          icon={<IconSpeakerphone size={16} />}
          iconPosition="right"
        >
          Post Announcement
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default NewAnnouncementModal;
