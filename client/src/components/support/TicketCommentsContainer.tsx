import { forwardRef, useImperativeHandle, useRef } from "react";
import { SupportTicket, SupportTicketMessage } from "../../types";
import TicketComment from "./TicketComment";
import {
  Comment,
  CommentAuthor,
  CommentAvatar,
  CommentContent,
  CommentMetadata,
  CommentText,
} from "semantic-ui-react";
import { format, parseISO } from "date-fns";

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
        className="flex flex-col mt-1 border rounded-md min-h-44 max-h-screen xl:max-h-96 2xl:max-h-[42rem] overflow-y-auto"
        ref={commentsContainer}
        {...props}
      >
        {scope === "general" && (
          <Comment className="flex flex-row w-full border-b items-center py-4 px-2">
            <CommentContent className="ml-4">
              <div className="flex flex-row items-center">
                <CommentAuthor className="font-bold">
                  System Message
                </CommentAuthor>
                <CommentMetadata className="text-sm text-gray-500">
                  <p className="ml-2">
                    {"- "}
                    {format(
                      parseISO(
                        props.ticket?.timeOpened ?? new Date().toISOString()
                      ),
                      "MM/dd/yy hh:mm aa"
                    )}
                  </p>
                </CommentMetadata>
              </div>
              <CommentText>
                <span className="font-semibold">Ticket Description: </span>
                {props.ticket?.description}
              </CommentText>
            </CommentContent>
          </Comment>
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
