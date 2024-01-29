import { useState, useEffect, lazy } from "react";
import { useParams } from "react-router-dom";
import useGlobalError from "../../../components/error/ErrorHooks";
import DefaultLayout from "../../../components/kb/DefaultLayout";
import { SupportTicket } from "../../../types";
import axios from "axios";
import { format, parseISO } from "date-fns";
import TicketStatusLabel from "../../../components/support/TicketStatusLabel";
import TicketMessaging from "../../../components/support/TicketMessaging";
import { useTypedSelector } from "../../../state/hooks";
import { Button, Icon, Label } from "semantic-ui-react";
import TicketDetails from "../../../components/support/TicketDetails";
import TicketFeed from "../../../components/support/TicketFeed";
import { isSupportStaff } from "../../../utils/supportHelpers";
const AssignTicketModal = lazy(
  () => import("../../../components/support/AssignTicketModal")
);

const SupportTicketView = () => {
  const { handleGlobalError } = useGlobalError();
  const { id } = useParams<{ id: any }>();
  const user = useTypedSelector((state) => state.user);

  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

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
      <Button color="blue" onClick={() => setShowAssignModal(true)}>
        <Icon name="user plus" />
        Assign Ticket
      </Button>
      <Button color="green" onClick={() => updateTicket("closed")}>
        <Icon name="check" />
        Mark as Resolved
      </Button>
    </div>
  );

  return (
    <DefaultLayout altBackground>
      <div aria-busy={loading} className="px-8 pt-8">
        {ticket && (
          <>
            <div className="flex flex-row w-full justify-between">
              <div className="flex flex-row items-center">
                <p className="text-3xl font-semibold">
                  Support Ticket: #{ticket?.uuid.slice(-7)}
                </p>
                <TicketStatusLabel status={ticket.status} className="!ml-4" />
              </div>
              {isSupportStaff(user) && <AdminOptions />}
            </div>
            <div className="flex flex-col xl:flex-row-reverse w-full mt-4">
              <div className="flex flex-col xl:basis-2/5 xl:pl-4">
                <TicketDetails ticket={ticket} />
                {isSupportStaff(user) && (
                  <div className="mt-4">
                    <TicketFeed ticket={ticket} />
                  </div>
                )}
              </div>
              <div className="flex flex-col xl:basis-3/5 mt-4 xl:mt-0">
                <TicketMessaging id={id} />
              </div>
            </div>
          </>
        )}
      </div>
      {isSupportStaff(user) ? (
        <AssignTicketModal
          open={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          ticketId={id}
        />
      ) : (
        <> </>
      )}
    </DefaultLayout>
  );
};

export default SupportTicketView;
