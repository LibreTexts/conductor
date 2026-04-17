import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import useGlobalError from "../../../components/error/ErrorHooks";
import DefaultLayout from "../../../components/navigation/AlternateLayout";
import { SupportTicket } from "../../../types";
import axios from "axios";
import TicketMessaging from "../../../components/support/TicketMessaging";
import { useTypedSelector } from "../../../state/hooks";
import { Dropdown, Icon, SemanticICONS } from "semantic-ui-react";
import TicketDetails from "../../../components/support/TicketDetails";
import TicketFeed from "../../../components/support/TicketFeed";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import TicketInternalMessaging from "../../../components/support/TicketInternalMessaging";
import TicketAttachments from "../../../components/support/TicketAttachments";
import ConfirmDeleteTicketModal from "../../../components/support/ConfirmDeleteTicketModal";
import api from "../../../api";
import { capitalizeFirstLetter } from "../../../components/util/HelperFunctions";
import TicketAutoCloseWarning from "../../../components/support/TicketAutoCloseWarning";
import { SupportTicketPriority } from "../../../types/support";
import { useMediaQuery } from "react-responsive";
import TicketUserOtherTickets from "../../../components/support/TicketUserOtherTickets";
import TicketMetadata from "../../../components/support/TicketMetadata";
import { TicketStatusPill } from "../../../components/support/TicketInfoPill";
import { useDocumentTitle } from "usehooks-ts";
import { useModals } from "../../../context/ModalContext";
import AssignTicketModal from "../../../components/support/AssignTicketModal";
import AuthHelper from "../../../components/util/AuthHelper";
import { Button, Heading, Menu, Stack } from "@libretexts/davis-react";
import { IconCheck, IconExclamationCircle, IconRefresh, IconShield, IconUsersPlus } from "@tabler/icons-react";

const getIdFromURL = (url: string) => {
  if (!url) return "";
  if (url.includes("?")) url = url.split("?")[0];
  const id = url.split("/").pop();
  return id ? id : "";
};

const SupportTicketView = () => {
  useDocumentTitle("LibreTexts | Support Ticket");
  const queryClient = useQueryClient();
  const location = useLocation();
  const { handleGlobalError } = useGlobalError();
  const { openModal, closeAllModals } = useModals();
  const user = useTypedSelector((state) => state.user);
  const isTailwindLg = useMediaQuery({ minWidth: "1024px" });

  const [id, setId] = useState<string>("");
  const [accessKey, setAccessKey] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = getIdFromURL(location.pathname);
    setId(id);
    const searchParams = new URLSearchParams(location.search);
    const accessKey = searchParams.get("accessKey");
    if (accessKey) {
      setAccessKey(accessKey);
    }
  }, [location.search, location.pathname]);

  const { data: ticket, isFetching } = useQuery<SupportTicket>({
    queryKey: ["ticket", id],
    queryFn: () => loadTicket(),
    keepPreviousData: true,
    refetchOnWindowFocus: true,
    enabled: !!id,
  });

  const updateTicketStatusMutation = useMutation({
    mutationFn: (status: "open" | "in_progress" | "closed") =>
      updateTicket({ status }),
    onSuccess: () => {
      queryClient.invalidateQueries(["ticket", id]);
      queryClient.invalidateQueries(["supportMetrics"]);
    },
  });

  const updateTicketPriorityMutation = useMutation({
    mutationFn: (priority: SupportTicketPriority) => updateTicket({ priority }),
    onSuccess: () => {
      queryClient.invalidateQueries(["ticket", id]);
    },
  });

  const toggleAutoCloseMutation = useMutation({
    mutationFn: (newStatus: boolean) =>
      updateTicket({ autoCloseSilenced: newStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries(["ticket", id]);
    },
  });

  const deleteTicketMutation = useMutation({
    mutationFn: () => deleteTicket(),
    onSuccess: () => {
      window.location.href = "/support/dashboard";
      queryClient.invalidateQueries(["ticket"]);
      queryClient.invalidateQueries(["supportMetrics"]);
    },
  });

  async function loadTicket() {
    try {
      if (typeof id !== "string" || !id) {
        throw new Error("Invalid ticket ID");
      }
      const res = await axios.get(`/support/ticket/${id}`, {
        params: {
          ...(accessKey && { accessKey }),
        },
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.ticket) {
        throw new Error("Invalid response from server");
      }
      return res.data.ticket;
    } catch (err: any) {
      // Redirect to login if not authenticated or guest access key is invalid
      if (err.response?.status === 401) {
        const redirectURI = encodeURIComponent(
          window.location.pathname + window.location.search
        );

        const loginURL = AuthHelper.generateLoginURL(redirectURI);

        window.location.assign(loginURL);
        return;
      }
      handleGlobalError(err);
    }
  }

  async function updateTicket({
    status,
    priority,
    autoCloseSilenced,
  }: {
    status?: "open" | "in_progress" | "closed";
    priority?: SupportTicketPriority;
    autoCloseSilenced?: boolean;
  }) {
    try {
      if (typeof id !== "string" || !id) {
        throw new Error("Invalid ticket ID");
      }

      setLoading(true);
      const res = await axios.patch(`/support/ticket/${id}`, {
        ...ticket,
        autoCloseSilenced: autoCloseSilenced ?? false,
        ...(status && { status }),
        ...(priority && { priority: priority.toLowerCase() }),
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function deleteTicket() {
    try {
      setLoading(true);
      if (!id) return;

      const res = await api.deleteTicket(id);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenAssignModal() {
    openModal(
      <AssignTicketModal
        ticketId={id}
        open={true}
        onCancel={() => closeAllModals()}
        onSave={() => closeAllModals()}
      />
    );
  }

  function handleOnDeleteTicket() {
    setShowDeleteModal(false);
    deleteTicketMutation.mutateAsync();
  }

  const changePriorityOptions = useMemo(() => {
    const allOpts = ["high", "medium", "low", "severe"];
    const currentPriority = ticket?.priority ?? "medium";
    const allowed = allOpts.filter((opt) => opt !== currentPriority);

    const higherOrLower = (priority: SupportTicketPriority) => {
      const priorityMap: Record<SupportTicketPriority, number> = {
        severe: 4,
        high: 3,
        medium: 2,
        low: 1,
      };
      return priorityMap[priority] > priorityMap[currentPriority]
        ? "higher"
        : "lower";
    };

    return allowed.map((opt) => ({
      value: capitalizeFirstLetter(opt),
      icon:
        higherOrLower(opt as SupportTicketPriority) === "higher"
          ? "arrow up"
          : "arrow down",
    }));
  }, [ticket]);

  const AdminOptions = () => (
    <Stack direction="horizontal" gap="md">
      {ticket?.status === "open" && user.isSupport && (
        <Button
          onClick={() => setShowDeleteModal(true)}
          loading={loading || isFetching}
          variant="destructive"
        >
          <Icon name="trash" />
          Delete Ticket
        </Button>
      )}
      {["open", "assigned", "in_progress", "awaiting_requester"].includes(
        ticket?.status ?? ""
      ) && (
          <Stack direction={isTailwindLg ? "horizontal" : "vertical"} gap="md" align="start">
            <Button
              variant="outline"
              onClick={() =>
                toggleAutoCloseMutation.mutateAsync(!ticket?.autoCloseSilenced)
              }
              loading={loading || isFetching}
              icon={<IconShield size={16} />}
            >
              {ticket?.autoCloseSilenced ? "Enable" : "Disable"} Auto-Close
            </Button>
            <Menu
            >
              <Menu.Button disabled={loading || isFetching}>
                <IconExclamationCircle size={16} className="mr-1" />
                {`Priority: ${capitalizeFirstLetter(
                  ticket?.priority ?? "medium"
                )}`}
              </Menu.Button>
              <Menu.Items>
                {changePriorityOptions.map((opt) => (
                  <Menu.Item
                    key={opt.value}
                    onClick={() =>
                      updateTicketPriorityMutation.mutateAsync(
                        opt.value as "high" | "medium" | "low"
                      )
                    }
                  >
                    <Icon name={opt.icon as SemanticICONS} />
                    {opt.value}
                  </Menu.Item>
                ))}
              </Menu.Items>
            </Menu>
            <Button
              variant="tertiary"
              onClick={() => handleOpenAssignModal()}
              loading={loading || isFetching}
              icon={<IconUsersPlus size={16} />}
            >
              {ticket?.assignedUUIDs && ticket?.assignedUUIDs?.length > 0
                ? "Re-Assign"
                : "Assign"}{" "}
              Ticket
            </Button>
            <Button
              variant="primary"
              onClick={() => updateTicketStatusMutation.mutateAsync("closed")}
              loading={loading || isFetching}
              icon={<IconCheck size={16} />}
            >
              Mark as Resolved
            </Button>
          </Stack>
        )}
      {ticket?.status === "closed" && (
        <Button
          variant="destructive"
          onClick={() => updateTicketStatusMutation.mutateAsync("in_progress")}
          loading={loading || isFetching}
          icon={<IconRefresh size={16} />}
        >
          Re-Open Ticket
        </Button>
      )}
    </Stack>
  );

  return (
    <DefaultLayout altBackground noPadding>
      <div aria-busy={isFetching} className="px-8 pt-8">
        {ticket && (
          <>
            <div className="flex flex-col lg:flex-row w-full justify-between">
              <Stack direction="horizontal" gap="md" align="center">
                <Heading level={1} className="!text-3xl !m-0">
                  {ticket.queue?.ticket_descriptor || "Support Ticket"}: #
                  {ticket?.uuid.slice(-7)}
                </Heading>
                <TicketStatusPill
                  status={ticket.status}
                />
              </Stack>
              {(user.isSupport || user.isHarvester) && <AdminOptions />}
            </div>
            <div className="flex flex-col xl:flex-row-reverse w-full mt-4">
              <div className="flex flex-col xl:basis-2/5 xl:pl-4">
                {ticket?.autoCloseTriggered && (
                  <TicketAutoCloseWarning
                    ticket={ticket}
                    onDisableAutoClose={() =>
                      toggleAutoCloseMutation.mutateAsync(false)
                    }
                  />
                )}
                <TicketDetails ticket={ticket} />
                <div className="mt-4">
                  <TicketMetadata ticket={ticket} />
                </div>
                <div className="mt-4">
                  <TicketFeed ticket={ticket} />
                </div>
                {(user.isSupport || user.isHarvester) && (
                  <div className="my-4">
                    <TicketInternalMessaging id={id} />
                  </div>
                )}
              </div>
              <div className="flex flex-col xl:basis-3/5 mt-4 xl:mt-0">
                <TicketMessaging
                  id={id}
                  guestAccessKey={accessKey}
                  ticket={ticket}
                />
                <div className="mt-4">
                  <TicketAttachments
                    ticket={ticket}
                    guestAccessKey={accessKey}
                  />
                </div>
                {(user.isSupport || user.isHarvester) && (
                  <div className="mt-4">
                    <TicketUserOtherTickets ticket={ticket} />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      {user && user.uuid && user.isSupport && (
        <>
          <ConfirmDeleteTicketModal
            open={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            uuid={id}
            onConfirmDelete={handleOnDeleteTicket}
          />
        </>
      )}
    </DefaultLayout>
  );
};

export default SupportTicketView;
