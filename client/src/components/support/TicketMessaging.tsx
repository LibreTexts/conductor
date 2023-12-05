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
import { useForm } from "react-hook-form";

interface TicketMessagingProps {
  id: string;
}

const TicketMessaging: React.FC<TicketMessagingProps> = ({ id }) => {
  const { handleGlobalError } = useGlobalError();
  const { control, getValues, setValue, watch, trigger, reset } =
    useForm<SupportTicketMessage>({
      defaultValues: {
        message: "",
      },
    });

  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);

  useEffect(() => {
    getMessages();
  }, []);

  async function getMessages() {
    try {
      setLoading(true);
      if (!id) throw new Error("Invalid ticket ID");
      const res = await axios.get(`/support/ticket/${id}/msg/staff`);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.messages || !Array.isArray(res.data.messages)) {
        throw new Error("Invalid response from server");
      }
      setMessages(res.data.messages);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    try {
      setLoading(true);
      if (!id) throw new Error("Invalid ticket ID");
      if (!(await trigger())) return;

      const res = await axios.post(`/support/ticket/${id}/msg/staff`, {
        ...getValues(),
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.message) {
        throw new Error("Invalid response from server");
      }

      reset(); // clear form
      getMessages();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  const TicketComment = (msg: SupportTicketMessage) => {
    const senderIsSelf = true;
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
          {msg.sender} at{" "}
          {format(parseISO(msg.timeSent), "MM/dd/yyyy hh:mm aa")}
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col border shadow-md rounded-md p-4">
        <p className="text-2xl font-semibold text-center">Ticket History</p>
        <div className="flex flex-col mt-8">
          {messages.length === 0 && (
            <p className="text-lg text-center text-gray-500 italic">
              No messages yet...
            </p>
          )}
          {messages.map((msg) => (
            <TicketComment key={msg.uuid} {...msg} />
          ))}
          <div className="mt-4">
            <p className="font-semibold mb-1 ml-1 !mt-4">Send Message:</p>
            <Form>
              <TextArea
                value={watch("message")}
                onChange={(e) => setValue("message", e.target.value)}
                placeholder="Enter your message here..."
                maxLength={500}
              />
              <div className="flex flex-row w-full justify-end mt-2">
                <Button onClick={() => setValue("message", "")}>
                  <Icon name="trash" />
                  Clear
                </Button>

                <Button color="blue" onClick={() => sendMessage()}>
                  <Icon name="send" />
                  Send
                </Button>
              </div>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
};
export default TicketMessaging;
