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
import { func } from "prop-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import TicketInternalMessaging from "../../../components/support/TicketInternalMessaging";
import TicketAttachments from "../../../components/support/TicketAttachments";
const AssignTicketModal = lazy(
  () => import("../../../components/support/AssignTicketModal")
);

const SupportTicketView = () => {
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();
  const { id } = useParams<{ id: any }>();
  const searchParams = new URLSearchParams(window.location.search);
  console.log(searchParams.get('accessKey'));
  const user = useTypedSelector((state) => state.user);

  const [showAssignModal, setShowAssignModal] = useState(false);

  const { data: ticket, isFetching } = useQuery<SupportTicket>({
    queryKey: ["ticket", id],
    queryFn: () => loadTicket(),
    keepPreviousData: true,
    refetchOnWindowFocus: true,
  });

  const updateTicketMutation = useMutation({
    mutationFn: (status: "open" | "in_progress" | "closed") =>
      updateTicket(status),
    onSuccess: () => {
      queryClient.invalidateQueries(["ticket", id]);
    },
  });

  useEffect(() => {
    document.title = "LibreTexts | Support Ticket";
  }, []);

  async function loadTicket() {
    try {
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
      return res.data.ticket;
    } catch (err) {
      handleGlobalError(err);
    }
  }

  async function updateTicket(status: "open" | "in_progress" | "closed") {
    try {
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
    } catch (err) {
      handleGlobalError(err);
    }
  }

  function handleCloseAssignModal() {
    setShowAssignModal(false);
    queryClient.invalidateQueries(["ticket", id]);
  }

  const AdminOptions = () => (
    <div className="flex flex-row">
      <Button color="blue" onClick={() => setShowAssignModal(true)}>
        <Icon name="user plus" />
        {ticket?.assignedUUIDs && ticket?.assignedUUIDs?.length > 0
          ? "Re-Assign"
          : "Assign"}{" "}
        Ticket
      </Button>
      <Button
        color="green"
        onClick={() => updateTicketMutation.mutateAsync("closed")}
      >
        <Icon name="check" />
        Mark as Resolved
      </Button>
    </div>
  );

  return (
    <DefaultLayout altBackground>
      <div aria-busy={isFetching} className="px-8 pt-8">
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
                  <>
                    <div className="mt-4">
                      <TicketFeed ticket={ticket} />
                    </div>
                    <div className="my-4">
                      <TicketInternalMessaging id={id} />
                    </div>
                  </>
                )}
              </div>
              <div className="flex flex-col xl:basis-3/5 mt-4 xl:mt-0">
                <TicketMessaging id={id} />
                {ticket.attachments && ticket.attachments.length > 0 && (
                  <div className="mt-4">
                    <TicketAttachments ticket={ticket} />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      {user && user.isSuperAdmin && (
        <AssignTicketModal
          open={showAssignModal}
          onClose={handleCloseAssignModal}
          ticketId={id}
        />
      )}
    </DefaultLayout>
  );
};

export default SupportTicketView;
