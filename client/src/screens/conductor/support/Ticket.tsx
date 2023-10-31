import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import useGlobalError from "../../../components/error/ErrorHooks";
import DefaultLayout from "../../../components/kb/DefaultLayout";
import { SupportTicket } from "../../../types";
import axios from "axios";
import { format, parseISO } from "date-fns";
import TicketStatusLabel from "../../../components/support/TicketStatusLabel";
import TicketMessaging from "../../../components/support/TicketMessaging";
import { useTypedSelector } from "../../../state/hooks";
import { Button, Icon } from "semantic-ui-react";

const SupportTicketView = () => {
  const { handleGlobalError } = useGlobalError();
  const { id } = useParams<{ id: any }>();
  const user = useTypedSelector((state) => state.user);

  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);

  useEffect(() => {
    document.title = "LibreTexts | Support Ticket";
    loadTicket();
  }, []);

  async function loadTicket() {
    try {
      setLoading(true);
      if (typeof id !== "string" || !id) {
        throw new Error("Invalid ticket ID");
      }
      const res = await axios.get(`/support/ticket/${id}`);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.ticket) {
        throw new Error("Invalid response from server");
      }
      setTicket(res.data.ticket);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function updateTicket(status: "open" | "in_progress" | "closed") {
    try {
      setLoading(true);
      if (typeof id !== "string" || !id) {
        throw new Error("Invalid ticket ID");
      }

      const res = await axios.patch(`/support/ticket/${id}`, {
        ...ticket,
        status,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      loadTicket();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  const AdminOptions = () => (
    <div className="flex flex-row">
      <Button color="blue">
        <Icon name="user plus" />
        Assign Ticket
      </Button>
      <Button color="green" onClick={() => updateTicket('closed')}>
        <Icon name="check" />
        Mark as Resolved
      </Button>
    </div>
  );

  return (
    <DefaultLayout>
      <div aria-busy={loading} className="p-8">
        {ticket && (
          <>
            <div className="flex flex-row w-full justify-between">
              <div className="flex flex-row items-center">
                <p className="text-3xl font-semibold">
                  Support Ticket: #{ticket?.uuid.slice(-7)}
                </p>
                <TicketStatusLabel status={ticket.status} className="!ml-4" />
              </div>
              {user && user.isSuperAdmin && <AdminOptions />}
            </div>
            <div className="flex flex-col mt-4 border rounded-md p-4 shadow-md">
              <p className="text-xl">
                <span className="font-semibold">Requester:</span>{" "}
                {ticket?.title}
              </p>
              <p className="text-xl">
                <span className="font-semibold">Date Opened:</span>{" "}
                {format(parseISO(ticket.timeOpened), "MM/dd/yyyy hh:mm aa")}
              </p>
              {ticket.status === "closed" && (
                <p className="text-xl">
                  <span className="font-semibold">Date Closed:</span>{" "}
                  {format(
                    parseISO(ticket.timeClosed ?? ""),
                    "MM/dd/yyyy hh:mm aa"
                  )}
                </p>
              )}
            </div>

            <div className="flex flex-col mt-4 border rounded-md p-4 shadow-md">
              <p className="text-xl">
                <span className="font-semibold">Subject:</span> {ticket?.title}
              </p>
              <p className="text-xl">
                <span className="font-semibold">Description:</span>{" "}
                {ticket?.description}
              </p>
            </div>

            <div className="flex flex-col w-full mt-8">
              <TicketMessaging id={id} />
            </div>
          </>
        )}
      </div>
    </DefaultLayout>
  );
};

export default SupportTicketView;
