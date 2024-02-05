import { forwardRef, useImperativeHandle, useRef } from "react";
import { SupportTicketMessage } from "../../types";
import TicketComment from "./TicketComment";

interface TicketCommentsContainerProps {
  messages?: SupportTicketMessage[];
}

type TicketCommentsContainerRef = {
  scrollBottom: () => void;
};

const TicketCommentsContainer = forwardRef(
  (
    props: TicketCommentsContainerProps,
    ref: React.ForwardedRef<TicketCommentsContainerRef>
  ) => {

    const { messages } = props;
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
        {(!messages || messages?.length === 0) && (
          <p className="text-lg text-center text-gray-500 italic">
            No comments yet...
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
