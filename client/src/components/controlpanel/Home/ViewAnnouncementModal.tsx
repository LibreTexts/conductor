import {
  Button,
  Header,
  Icon,
  Modal,
  ModalProps,
  Image,
} from "semantic-ui-react";
import axios from "axios";
import { useState } from "react";
import { Announcement } from "../../../types";
import { format, parseISO } from "date-fns";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { capitalizeFirstLetter } from "../../util/HelperFunctions";
import { useTypedSelector } from "../../../state/hooks";
import { fi } from "date-fns/locale";
import useGlobalError from "../../error/ErrorHooks";
import { isOrganization } from "../../../utils/typeHelpers";

interface ViewAnnouncementModalProps extends ModalProps {
  show: boolean;
  announcement?: Announcement;
  onClose: () => void;
}

const ViewAnnouncementModal: React.FC<ViewAnnouncementModalProps> = ({
  show,
  announcement,
  onClose,
  ...rest
}) => {
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);
  const [loading, setLoading] = useState<boolean>(false);

  /**
   * Submit a DELETE request to the server to delete the announcement
   * currently open in the View Announcement Modal, then close
   * the modal
   */
  async function deleteAnnouncement() {
    try {
      if (!announcement || !announcement._id) return;
      setLoading(true);
      const res = await axios.delete("/announcement", {
        data: {
          announcementID: announcement._id,
        },
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      onClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal onClose={() => onClose()} open={show} {...rest}>
      <Modal.Header>{announcement?.title ?? ""}</Modal.Header>
      {announcement && (
        <>
          <Modal.Content>
            <Header as="h4">
              <Image
                avatar
                src={`${announcement.author?.avatar || "/mini_logo.png"}`}
              />
              <Header.Content>
                {announcement?.author?.firstName ?? ""}{" "}
                {announcement.author?.lastName}
                <Header.Subheader>
                  {format(parseISO(announcement.createdAt), "MM/dd/yy")} at{" "}
                  {format(parseISO(announcement.createdAt), "h:mm aa")}
                </Header.Subheader>
              </Header.Content>
            </Header>
            <Modal.Description className="announcement-view-text">
              {announcement.message && (
                <p
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(
                      marked(announcement.message, { breaks: true })
                    ),
                  }}
                ></p>
              )}
            </Modal.Description>
            <span className="gray-span">
              Sent to:{" "}
              {isOrganization(announcement.org)
                ? capitalizeFirstLetter(
                    announcement.org?.shortName || "Unknown"
                  )
                : "Global"}
            </span>
          </Modal.Content>
          <Modal.Actions className="flex flex-row justify-between">
            {(announcement.author?.uuid === user.uuid || user.isSuperAdmin) && (
              <Button
                color="red"
                loading={loading}
                onClick={deleteAnnouncement}
              >
                <Icon name="trash" />
                Delete
              </Button>
            )}

            <Button color="blue" onClick={() => onClose()}>
              Done
            </Button>
          </Modal.Actions>
        </>
      )}
    </Modal>
  );
};

export default ViewAnnouncementModal;
