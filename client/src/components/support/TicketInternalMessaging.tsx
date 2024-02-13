import { useEffect, useRef } from "react";
import { Button, Form, Icon, TextArea } from "semantic-ui-react";
import { SupportTicketMessage } from "../../types";
import useGlobalError from "../error/ErrorHooks";
import axios from "axios";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import TicketCommentsContainer from "./TicketCommentsContainer";

interface TicketInternalMessagingProps {
  id: string;
}

const TicketInternalMessaging: React.FC<TicketInternalMessagingProps> = ({
  id,
}) => {
  const containerRef =
    useRef<React.ElementRef<typeof TicketCommentsContainer>>(null);
  const { handleGlobalError } = useGlobalError();
  const queryClient = useQueryClient();
  const { control, getValues, setValue, watch, trigger, reset } =
    useForm<SupportTicketMessage>({
      defaultValues: {
        message: "",
      },
    });

  const { data: messages, isFetching } = useQuery<SupportTicketMessage[]>({
    queryKey: ["ticketInternalMessages", id],
    queryFn: () => getMessages(),
    keepPreviousData: true,
    staleTime: 1000 * 60, // 1 minutes
    refetchInterval: 1000 * 60, // 1 minutes
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollBottom();
    }
  }, [containerRef, messages]);

  async function getMessages(): Promise<SupportTicketMessage[]> {
    try {
      if (!id) throw new Error("Invalid ticket ID");
      const res = await axios.get(`/support/ticket/${id}/internal-msg`);
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

      const res = await axios.post(`/support/ticket/${id}/internal-msg`, {
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
      queryClient.invalidateQueries(["ticketInternalMessages", id]);
    },
  });

  return (
    <div>
      <div className="flex flex-col w-full bg-white rounded-md">
        <div className="flex flex-col border shadow-md rounded-md p-4">
          <p className="text-xl font-semibold text-center">Internal Comments</p>
          <div className="px-4 mt-1 mb-1">
            <p className="text-center italic">
              Leave internal comments for other support staff to see. These
              comments are not visible to the ticket submitter.
            </p>
          </div>
          <TicketCommentsContainer ref={containerRef} messages={messages} scope="internal" />
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
    </div>
  );
};
export default TicketInternalMessaging;
