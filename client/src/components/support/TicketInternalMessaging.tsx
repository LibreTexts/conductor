import { useEffect, useRef } from "react";
import { SupportTicketMessage } from "../../types";
import useGlobalError from "../error/ErrorHooks";
import axios from "axios";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import TicketCommentsContainer from "./TicketCommentsContainer";
import { Button, Card, Heading, Stack, Text, Textarea } from "@libretexts/davis-react";
import { IconSend, IconTrash } from "@tabler/icons-react";

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
  const { getValues, setValue, watch, trigger, register, reset } =
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
    <Card variant="elevated" className="!border-blue-500">
      <Card.Header>
        <Heading level={4} align="center">
          Internal Comments
        </Heading>
      </Card.Header>
      <Card.Body className="py-4">
        <Stack direction="vertical" gap="sm">
          <Text align="center">
            Leave internal comments for other support staff to see. These
            comments are not visible to the ticket submitter.
          </Text>
          <TicketCommentsContainer
            ref={containerRef}
            messages={messages}
            scope="internal"
          />
          <div className="mt-2">
            <form onSubmit={(e) => e.preventDefault()}>
              <Textarea
                label="Send Message"
                placeholder="Enter your message here..."
                maxLength={3000}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" && e.ctrlKey) {
                    if (!getValues("message")) return;
                    sendMessageMutation.mutateAsync();
                  }
                }}
                {...register("message", { required: "Message cannot be empty" })}
              />
              <Stack direction="horizontal" className="w-full mt-2" justify="between">
                <Text size="xs">
                  {watch("message")?.length ?? 0}/3000. Enter for new line.
                  Ctrl + Enter to send.
                </Text>
                <Stack direction="horizontal" gap="sm" className="mt-2 md:mt-0" justify="end" align="end">
                  <Button
                    variant="outline"
                    onClick={() => setValue("message", "")}
                    icon={<IconTrash size={18} />}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="primary"
                    onClick={async () => {
                      if (!getValues("message")) return;
                      await sendMessageMutation.mutateAsync();
                    }}
                    icon={<IconSend size={18} />}
                  >
                    Send
                  </Button>
                </Stack>
              </Stack>
            </form>
          </div>
        </Stack>
      </Card.Body>
    </Card>
  );
};
export default TicketInternalMessaging;
