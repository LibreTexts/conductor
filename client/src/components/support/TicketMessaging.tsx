import { useEffect, useRef } from "react";
import { SupportTicket, SupportTicketMessage } from "../../types";
import useGlobalError from "../error/ErrorHooks";
import axios from "axios";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTypedSelector } from "../../state/hooks";
import TicketCommentsContainer from "./TicketCommentsContainer";
import { Button, Card, Heading, Stack, Text, Textarea } from "@libretexts/davis-react";
import { IconSend, IconTrash } from "@tabler/icons-react";

interface TicketMessagingProps {
  id: string;
  guestAccessKey?: string;
  ticket: SupportTicket;
}

const TicketMessaging: React.FC<TicketMessagingProps> = ({
  id,
  guestAccessKey,
  ticket,
}) => {
  const user = useTypedSelector((state) => state.user);
  const containerRef =
    useRef<React.ElementRef<typeof TicketCommentsContainer>>(null);
  const { handleGlobalError } = useGlobalError();
  const queryClient = useQueryClient();
  const { control, getValues, setValue, watch, trigger, register, reset } =
    useForm<SupportTicketMessage>({
      defaultValues: {
        message: "",
      },
    });

  const {
    data: messages,
    isFetching,
    refetch,
  } = useQuery<SupportTicketMessage[]>({
    queryKey: ["ticketMessages", id],
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
      const res = await axios.get(`/support/ticket/${id}/msg`, {
        params: {
          ...(guestAccessKey ? { accessKey: guestAccessKey } : {}),
        },
      });
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

      const res = await axios.post(
        `/support/ticket/${id}/msg`,
        {
          ...getValues(),
        },
        {
          params: {
            ...(guestAccessKey ? { accessKey: guestAccessKey } : {}),
          },
        }
      );

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
    onSuccess: async () => {
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["ticket", id] });
    },
  });

  return (
    <Card variant="elevated">
      <Card.Header>
        <Heading level={4} align="center">
          Ticket Comments
        </Heading>
      </Card.Header>
      <Card.Body className="py-4">
        {!user.isSupport && !user.isHarvester && (
          <div className="px-4 mt-2 mb-4">
            <p className="text-center italic">
              Feel free to leave this page at any time. We'll send you an
              email when new comments are added.
            </p>
          </div>
        )}
        <TicketCommentsContainer
          ref={containerRef}
          scope="general"
          messages={messages}
          ticket={ticket}
        />
        <div className="mt-4">
          <form onSubmit={(e) => e.preventDefault()}>
            <Textarea
              label="Send Message"
              placeholder="Enter your message here..."
              maxLength={3000}
              onKeyDown={(e: any) => {
                if (e.key === "Enter" && e.ctrlKey) {
                  if (!getValues("message")) return;
                  if (sendMessageMutation.isLoading) return;
                  sendMessageMutation.mutateAsync();
                }
              }}
              {...register("message", { required: "Message cannot be empty" })}
            />
            <Stack direction="horizontal" className="w-full mt-2" justify="between">
              <Stack direction="vertical" gap="xs">
                <Text size="xs" className="text-gray-600 ml-1">
                  {watch("message")?.length ?? 0}/3000. Enter for new line.
                  Ctrl + Enter to send.
                </Text>
                <Text size="sm" className=" text-gray-600 italic mt-1 ml-0.5">
                  Your ticket comments may be used to improve our support
                  services. Any sensitive information will remain
                  confidential.
                </Text>
              </Stack>
              <Stack direction="horizontal" gap="sm" className="mt-2 md:mt-0" justify="end" align="end">
                <Button
                  icon={<IconTrash size={18} />}
                  onClick={() => setValue("message", "")}>
                  Clear
                </Button>
                <Button
                  variant="primary"
                  icon={<IconSend size={18} />}
                  onClick={async () => {
                    if (!getValues("message")) return;
                    if (sendMessageMutation.isLoading) return;
                    await sendMessageMutation.mutateAsync();
                  }}
                  loading={sendMessageMutation.isLoading}
                >
                  Send
                </Button>
              </Stack>
            </Stack>
          </form>
        </div>
      </Card.Body>
    </Card >
  );
};
export default TicketMessaging;
