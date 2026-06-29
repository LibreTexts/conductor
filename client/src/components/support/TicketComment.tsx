import React from "react";
import { SupportTicketMessage } from "../../types";
import { Comment, Link } from "@libretexts/davis-react";
import { format, parseISO } from "date-fns";
import Linkify from "linkify-react";


type TicketCommentBaseMessage = Omit<SupportTicketMessage, "ticket">

interface TicketCommentProps {
  msg: TicketCommentBaseMessage | Omit<TicketCommentBaseMessage, "sender"> & { isSystemMessage: true };
}

const TicketComment: React.FC<TicketCommentProps> = ({ msg }) => {

  const renderLink = ({ attributes, content }: { attributes: any; content: string }) => {
    const { href } = attributes;
    if (!href) {
      return content;
    }
    return <Link className="text-sm" href={href} target="_blank" rel="noopener noreferrer">{content}</Link>;
  }

  const formatMessage = (message: string) => {
    return message.split("\n").map((line, index) => {
      // ignore trailing empty line
      if (index === message.split("\n").length - 1 && line === "") {
        return null;
      }
      return (
        <Linkify key={index} options={{
          render: renderLink,
        }}>
          {line}
          <br />
        </Linkify>
      );
    });
  };

  const senderName = () => {
    if ("isSystemMessage" in msg && msg.isSystemMessage) {
      return "System Message";
    } else if ("sender" in msg && msg.sender) {
      return `${msg.sender.firstName} ${msg.sender.lastName}`;
    } else {
      return msg.senderEmail;
    }
  }

  const senderAvatar = () => {
    if ("isSystemMessage" in msg && msg.isSystemMessage) {
      return undefined;
    }
    else if ("sender" in msg && msg.sender && "avatar" in msg.sender) {
      return msg.sender.avatar;
    } else {
      return "https://cdn.libretexts.net/DefaultImages/avatar.png";
    }
  }

  return (
    <Comment padding="none" className="py-3.5">
      <Comment.Header
        avatar={{
          name: senderName(),
          src: senderAvatar(),
        }}
        name={senderName()}
      >
        <time>{format(parseISO(msg.timeSent), "MM/dd/yy hh:mm aa")}</time>
      </Comment.Header>
      <Comment.Body>
        <p className="![overflow-wrap:anywhere]">
          {formatMessage(msg.message)}
        </p>
      </Comment.Body>
    </Comment>
  );
};

export default TicketComment;
