import { useState, useEffect } from "react";
import {
  Button,
  Comment,
  Form,
  Header,
  Icon,
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

interface TicketMessagingProps {
  id: string;
}

const TicketMessaging: React.FC<TicketMessagingProps> = ({ id }) => {
  const user = useTypedSelector((state) => state.user);
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
      console.log(getValues("message").length);

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

  const getSenderIsSelf = (msg: SupportTicketMessage): boolean => {
    if (msg.senderIsStaff && user && user.isSuperAdmin) return true;
    return false;
  };

  const TicketComment = (msg: SupportTicketMessage) => {
    const senderIsSelf = getSenderIsSelf(msg);
    return (
      <div
        className={`flex flex-col text-white mb-4 ${
          senderIsSelf ? "self-end" : "self-start"
        }`}
      >
        <div className="bg-primary text-white w-96 h-fit rounded-xl p-4">
          <p>{msg.message}</p>
        </div>
        <p
          className={`text-xs italic mt-1 text-gray-500 ${
            senderIsSelf ? "text-right mr-2" : "text-left ml-2"
          }`}
        >
          {msg.sender
            ? `${msg.sender.firstName} ${msg.sender.lastName}`
            : msg.senderEmail}{" "}
          at {format(parseISO(msg.timeSent), "MM/dd/yyyy hh:mm aa")}
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full bg-white">
      <div className="flex flex-col border shadow-md rounded-md p-4">
        <p className="text-xl font-semibold text-center">Ticket Chat</p>
        <div className="flex flex-col mt-1 bg-slate-100 border rounded-md p-2 min-h-44 max-h-screen xl:max-h-96 2xl:max-h-[42rem] overflow-y-auto">
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
                  {watch("message")?.length ?? 0}/1000. Enter for new line. Ctrl
                  + Enter to send.
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
  );
};
export default TicketMessaging;
