import { Image } from "semantic-ui-react";
import { Announcement } from "../../../types";
import { format, parseISO } from "date-fns";
import { truncateString } from "../../util/HelperFunctions";
import { marked } from "marked";
import DOMPurify from "dompurify";

interface AnnouncementProps {
  announcement: Announcement;
  index: number;
  onClick: (index: number) => void;
}

const Annnouncement: React.FC<AnnouncementProps> = ({
  announcement,
  index,
  onClick,
}) => {
  return (
    <div
      className="flex flex-col announcement"
      onClick={() => onClick(index)}
    >
      <div className="flex-row-div">
        <div className="announcement-avatar-container">
          <Image src={announcement.author.avatar} size="mini" avatar />
        </div>
        <div className="flex-col-div announcement-meta-container">
          <span className="announcement-meta-title">{announcement.title}</span>
          <span className="muted-text announcement-meta-date">
            <em>
              {announcement.author.firstName} {announcement.author.lastName}
            </em>{" "}
            &bull; {format(parseISO(announcement.createdAt), "MM/dd/yy")} at{" "}
            {format(parseISO(announcement.createdAt), "h:mm aa")}
          </span>
        </div>
      </div>
      <p
        className="announcement-text"
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(
            marked(truncateString(announcement.message, 200))
          ),
        }}
      ></p>
    </div>
  );
};

export default Annnouncement;