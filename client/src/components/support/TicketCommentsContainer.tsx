import { forwardRef, useImperativeHandle, useRef } from "react";
import { SupportTicket, SupportTicketMessage } from "../../types";
import TicketComment from "./TicketComment";
import { Text } from "@libretexts/davis-react";

interface _GeneralMessagingProps {
  scope: "general";
  ticket?: SupportTicket;
  messages?: SupportTicketMessage[];
}

interface _InternaMessagingProps {
  scope: "internal";
  messages?: SupportTicketMessage[];
}

type TicketCommentsContainerProps =
  | _GeneralMessagingProps
  | _InternaMessagingProps;

type TicketCommentsContainerRef = {
  scrollBottom: () => void;
};

const TicketCommentsContainer = forwardRef(
  (
    props: TicketCommentsContainerProps,
    ref: React.ForwardedRef<TicketCommentsContainerRef>
  ) => {
    const { messages, scope } = props;
    const commentsContainer = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => {
      return {
        scrollBottom: () => {
          if (commentsContainer.current) {
            commentsContainer.current.scrollTop =
              commentsContainer.current.scrollHeight;
          }
        },
      };
    });

    return (
      <div
        className="flex flex-col divide-y divide-gray-200 min-h-44 max-h-screen xl:max-h-96 2xl:max-h-[42rem] overflow-y-auto"
        ref={commentsContainer}
        {...props}
      >
        {scope === "general" && (
          <TicketComment
            msg={{
              uuid: "system-message",
              type: "general",
              message: props.ticket?.description || "No description provided.",
              timeSent: props.ticket?.timeOpened ?? new Date().toISOString(),
              isSystemMessage: true,
              senderIsStaff: true
            }}
          />
        )}
        {(!messages || messages?.length === 0) && (
          <Text align="center" className="mt-2">
            No {scope === "general" ? "user" : "staff"} comments yet...
          </Text>
        )}
        {messages?.map((msg) => (
          <TicketComment key={msg.uuid} msg={msg} />
        ))}
      </div>
    );
  }
);

export default TicketCommentsContainer;
