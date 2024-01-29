import { useState, useEffect, useRef } from "react";
import {
  Button,
  Comment,
  CommentAuthor,
  CommentAvatar,
  CommentContent,
  CommentMetadata,
  CommentText,
  Form,
  Header,
  Icon,
  Message,
  TextArea,
} from "semantic-ui-react";
import { SupportTicket, SupportTicketMessage } from "../../types";
import { format, parseISO } from "date-fns";
import useGlobalError from "../error/ErrorHooks";
import axios from "axios";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { useTypedSelector } from "../../state/hooks";
import { isSupportStaff } from "../../utils/supportHelpers";

interface TicketMessagingProps {
  id: string;
}

const TicketMessaging: React.FC<TicketMessagingProps> = ({ id }) => {
  const user = useTypedSelector((state) => state.user);
  const commentsContainer = useRef<HTMLDivElement>(null);
  const { handleGlobalError } = useGlobalError();
  const queryClient = useQueryClient();
  const { control, getValues, setValue, watch, trigger, reset } =
    useForm<SupportTicketMessage>({
      defaultValues: {
        message: "",
      },
    });

  const { data: messages, isFetching } = useQuery<SupportTicketMessage[]>({
    queryKey: ["ticketMessages", id],
    queryFn: () => getMessages(),
    keepPreviousData: true,
    staleTime: 1000 * 60, // 1 minutes
    refetchInterval: 1000 * 60, // 1 minutes
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (commentsContainer.current) {
      commentsContainer.current.scrollTop =
        commentsContainer.current.scrollHeight;
    }
  }, [commentsContainer, messages]);

  async function getMessages(): Promise<SupportTicketMessage[]> {
    try {
      if (!id) throw new Error("Invalid ticket ID");
      const res = await axios.get(`/support/ticket/${id}/msg`);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.messages || !Array.isArray(res.data.messages)) {
        throw new Error("Invalid response from server");
      }

      const msgs = res.data.messages as SupportTicketMessage[];
      msgs.sort((a, b) => {
        return new Date(a.timeSent).getTime() - new Date(b.timeSent).getTime();
      });

      return (msgs as SupportTicketMessage[]) ?? [];
    } catch (err) {
      handleGlobalError(err);
      return [];
    }
  }

  async function sendMessage() {
    try {
      if (!id) throw new Error("Invalid ticket ID");
      if (!getValues("message")) return;

      const res = await axios.post(`/support/ticket/${id}/msg`, {
        ...getValues(),
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.message) {
        throw new Error("Invalid response from server");
      }

      reset(); // clear form
    } catch (err) {
      handleGlobalError(err);
    }
  }

  const sendMessageMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: () => {
      queryClient.invalidateQueries(["ticketMessages", id]);
    },
  });

  const TicketComment = (msg: SupportTicketMessage) => {
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
          <CommentText>{msg.message}</CommentText>
        </CommentContent>
      </Comment>
    );
  };

  return (
    <div>
      <div className="flex flex-col w-full bg-white">
        <div className="flex flex-col border shadow-md rounded-md p-4">
          <p className="text-xl font-semibold text-center">Ticket Comments</p>
          {!isSupportStaff(user) && (
            <div className="px-4 mt-2 mb-4">
              <p className="text-center italic">
              Feel free to leave this page at any time. We'll send you an email
              when new comments are added.
              </p>
            </div>
          )}
          <div
            className="flex flex-col mt-1 border rounded-md p-2 min-h-44 max-h-screen xl:max-h-96 2xl:max-h-[42rem] overflow-y-auto"
            ref={commentsContainer}
          >
            {messages?.length === 0 && (
              <p className="text-lg text-center text-gray-500 italic">
                No messages yet...
              </p>
            )}
            {messages?.map((msg) => (
              <TicketComment key={msg.uuid} {...msg} />
            ))}
          </div>
          <div className="mt-2">
            <p className="font-semibold mb-1 ml-1">Send Message:</p>
            <Form>
              <Controller
                control={control}
                name="message"
                render={() => (
                  <TextArea
                    value={watch("message")}
                    onChange={(e) => setValue("message", e.target.value)}
                    placeholder="Enter your message here..."
                    maxLength={1000}
                    onKeyDown={(e: any) => {
                      if (e.key === "Enter" && e.ctrlKey) {
                        if (!getValues("message")) return;
                        sendMessageMutation.mutateAsync();
                      }
                    }}
                  />
                )}
              />
              <div className="flex flex-row w-full justify-between mt-2">
                <div>
                  <p className="text-xs text-gray-500 ml-1">
                    {watch("message")?.length ?? 0}/1000. Enter for new line.
                    Ctrl + Enter to send.
                  </p>
                </div>
                <div className="flex flex-row">
                  <Button onClick={() => setValue("message", "")}>
                    <Icon name="trash" />
                    Clear
                  </Button>
                  <Button
                    color="blue"
                    onClick={() => {
                      if (!getValues("message")) return;
                      sendMessageMutation.mutateAsync();
                    }}
                  >
                    <Icon name="send" />
                    Send
                  </Button>
                </div>
              </div>
            </Form>
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-500 text-center italic mt-1">
        Your ticket comments may be used to improve our support services. Any
        sensitive information will always remain confidential.
      </p>
    </div>
  );
};
export default TicketMessaging;
