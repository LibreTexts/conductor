import { Avatar, Timeline } from "@libretexts/davis-react";
import { Announcement } from "../../types";
import { format, parseISO } from "date-fns";
import { truncateString } from "../util/HelperFunctions";
import { marked } from "marked";
import DOMPurify from "dompurify";

interface AnnouncementProps {
  announcement: Announcement;
  index: number;
  onClick: (index: number) => void;
}

const AnnouncementItem: React.FC<AnnouncementProps> = ({
  announcement,
  index,
  onClick,
}) => {
  const authorName = `${announcement.author.firstName} ${announcement.author.lastName}`;
  const dateStr = `${format(parseISO(announcement.createdAt), "MM/dd/yy")} at ${format(parseISO(announcement.createdAt), "h:mm aa")}`;
  const bodyHtml = DOMPurify.sanitize(
    marked(truncateString(announcement.message, 200)) as string
  );

  return (
    <Timeline.Item
      status="pending"
      icon={
        <Avatar
          src={announcement.author.avatar || "/mini_logo.png"}
          alt={authorName}
          size="sm"
        />
      }
      title={
        <span
          className="cursor-pointer hover:text-blue-700"
          onClick={() => onClick(index)}
        >
          {announcement.title}
        </span>
      }
      description={
        <span
          className="cursor-pointer block"
          onClick={() => onClick(index)}
        >
          <em>{authorName}</em>
          {" • "}
          {dateStr}
          <span
            className="block mt-1 text-gray-700 prose prose-code:before:hidden prose-code:after:hidden max-w-full"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </span>
      }
    />
  );
};

export default AnnouncementItem;
