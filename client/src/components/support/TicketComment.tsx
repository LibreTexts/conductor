import React from "react";
import { SupportTicketMessage } from "../../types";
import {
  Comment,
  CommentAuthor,
  CommentAvatar,
  CommentContent,
  CommentMetadata,
  CommentText,
} from "semantic-ui-react";
import { format, parseISO } from "date-fns";

interface TicketCommentProps {
  msg: SupportTicketMessage;
}

const TicketComment: React.FC<TicketCommentProps> = ({ msg }) => {
  const formatMessage = (message: string) => {
    return message.split("\n").map((line, index) => {
      // ignore trailing empty line
      if (index === message.split("\n").length - 1 && line === "") {
        return null;
      }
      return (
        <span key={index}>
          {line}
          <br />
        </span>
      );
    });
  };

  return (
    <Comment className="flex flex-row w-full border-b items-center py-4 px-2">
      <CommentAvatar
        src={
          msg.sender && msg.sender.avatar
            ? msg.sender.avatar
            : "https://cdn.libretexts.net/DefaultImages/avatar.png"
        }
        className="w-8 min-w-8"
      />
      <CommentContent className="ml-4">
        <div className="flex flex-row items-center">
          <CommentAuthor className="font-bold">
            {msg.sender
              ? `${msg.sender.firstName} ${msg.sender.lastName}`
              : msg.senderEmail}
          </CommentAuthor>
          <CommentMetadata className="text-sm text-gray-500">
            <p className="ml-2">
              {"- "}
              {format(parseISO(msg.timeSent), "MM/dd/yy hh:mm aa")}
            </p>
          </CommentMetadata>
        </div>
        <CommentText className="!break-all">
          {formatMessage(msg.message)}
        </CommentText>
      </CommentContent>
    </Comment>
  );
};

export default TicketComment;
