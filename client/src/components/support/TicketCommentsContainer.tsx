import { forwardRef, useImperativeHandle, useRef } from "react";
import { SupportTicket, SupportTicketMessage } from "../../types";
import TicketComment from "./TicketComment";

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
        className="flex flex-col mt-1 border border-gray-300 divide-y divide-gray-300 rounded-md min-h-44 max-h-screen xl:max-h-96 2xl:max-h-[42rem] overflow-y-auto"
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
          <p className="text-lg text-center text-gray-500 italic mt-1">
            No {scope === "general" ? "user" : ""} comments yet...
          </p>
        )}
        {messages?.map((msg) => (
          <TicketComment key={msg.uuid} msg={msg} />
        ))}
      </div>
    );
  }
);

export default TicketCommentsContainer;
