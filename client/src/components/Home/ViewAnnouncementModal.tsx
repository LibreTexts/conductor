import { Modal, Button, Avatar } from "@libretexts/davis-react";
import { IconTrash } from "@tabler/icons-react";
import axios from "axios";
import { useState } from "react";
import { Announcement } from "../../types";
import { format, parseISO } from "date-fns";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { capitalizeFirstLetter } from "../util/HelperFunctions";
import { useTypedSelector } from "../../state/hooks";
import useGlobalError from "../error/ErrorHooks";
import { isOrganization } from "../../utils/typeHelpers";

interface ViewAnnouncementModalProps {
  show: boolean;
  announcement?: Announcement;
  onClose: () => void;
}

const ViewAnnouncementModal: React.FC<ViewAnnouncementModalProps> = ({
  show,
  announcement,
  onClose,
}) => {
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);
  const [loading, setLoading] = useState<boolean>(false);

  async function deleteAnnouncement() {
    try {
      if (!announcement || !announcement._id) return;
      setLoading(true);
      const res = await axios.delete("/announcement", {
        data: { announcementID: announcement._id },
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
    <Modal open={show} onClose={() => onClose()} size="lg">
      <Modal.Header>
        <Modal.Title>{announcement?.title ?? ""}</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      {announcement && (
        <>
          <Modal.Body>
            <div className="flex items-center gap-3 mb-4">
              <Avatar
                src={announcement.author?.avatar || "/mini_logo.png"}
                alt={`${announcement.author?.firstName ?? ""} ${announcement.author?.lastName ?? ""}`}
                size="md"
              />
              <div>
                <p className="font-semibold m-0">
                  {announcement.author?.firstName ?? ""}{" "}
                  {announcement.author?.lastName}
                </p>
                <p className="text-sm text-gray-500 m-0">
                  {format(parseISO(announcement.createdAt), "MM/dd/yy")} at{" "}
                  {format(parseISO(announcement.createdAt), "h:mm aa")}
                </p>
              </div>
            </div>
            {announcement.message && (
              <div
                className="prose prose-code:before:hidden prose-code:after:hidden mb-3"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    marked(announcement.message, { breaks: true }) as string
                  ),
                }}
              />
            )}
            <p className="text-sm text-gray-500 m-0">
              Sent to:{" "}
              {isOrganization(announcement.org)
                ? capitalizeFirstLetter(
                    announcement.org?.shortName || "Unknown"
                  )
                : "Global"}
            </p>
          </Modal.Body>
          <Modal.Footer>
            <div className="flex justify-between w-full">
              <div>
                {(announcement.author?.uuid === user.uuid ||
                  user.isSuperAdmin) && (
                  <Button
                    variant="destructive"
                    loading={loading}
                    onClick={deleteAnnouncement}
                    icon={<IconTrash size={16} />}
                  >
                    Delete
                  </Button>
                )}
              </div>
              <Button variant="primary" onClick={() => onClose()}>
                Done
              </Button>
            </div>
          </Modal.Footer>
        </>
      )}
    </Modal>
  );
};

export default ViewAnnouncementModal;
