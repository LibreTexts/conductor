import { SupportTicket } from "../../types";
import { SupportTicketPriority, SupportTicketStatus } from "../../types/support";
import { format, parseISO } from "date-fns";
import {
  SupportTicketCategoryOptions,
  SupportTicketPriorityOptions,
  SupportTicketStatusOptions,
  getPrettySupportTicketCategory,
  getPrettySupportTicketStatus,
} from "../../utils/supportHelpers";
import { capitalizeFirstLetter } from "../util/HelperFunctions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Card,
  Divider,
  Heading,
  Link,
  Listbox,
  Select,
  Stack,
  Switch,
  Text,
} from "@libretexts/davis-react";
import api from "../../api";
import { useNotifications } from "../../context/NotificationContext";
import { useTypedSelector } from "../../state/hooks";
import TicketAssigneePicker from "./TicketAssigneePicker";
import TicketCCEditor from "./TicketCCEditor";

interface TicketDetailsProps {
  ticket: SupportTicket;
}

const priorityDotColor = (p?: string) => {
  switch (p) {
    case "low":
      return "bg-green-500";
    case "medium":
      return "bg-amber-500";
    case "high":
      return "bg-orange-500";
    case "severe":
      return "bg-red-600";
    default:
      return "bg-gray-400";
  }
};

const statusDotColor = (s?: string) => {
  switch (s) {
    case "open":
      return "bg-red-500";
    case "assigned":
    case "in_progress":
      return "bg-blue-500";
    case "awaiting_requester":
      return "bg-amber-500";
    case "closed":
      return "bg-green-500";
    default:
      return "bg-gray-400";
  }
};

const Dot: React.FC<{ className: string }> = ({ className }) => (
  <span
    aria-hidden="true"
    className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`}
  />
);

const FieldLabel: React.FC<{ htmlText: string }> = ({ htmlText }) => (
  <Text size="sm" className="font-semibold">
    {htmlText}
  </Text>
);

// Two-column key/value row for the read-only request info (mirrors the wireframe's .meta-row).
const MetaRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex gap-3 py-1 text-sm">
    <span className="w-24 shrink-0 font-semibold text-gray-500">{label}</span>
    <span className="min-w-0 break-words text-gray-900">{children}</span>
  </div>
);

const TicketDetails: React.FC<TicketDetailsProps> = ({ ticket }) => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const user = useTypedSelector((state) => state.user);

  const isClosed = ticket.status === "closed";
  // Only support staff may edit ticket metadata. Everyone with access can still view it
  // (and add/remove a CC'd email, which is handled by the CC editor independently).
  const canEdit = user.isSupport || user.isSuperAdmin || user.isHarvester;
  const editDisabled = !canEdit || isClosed;

  const centralIdentityURL = (centralID: string) =>
    `/controlpanel/libreone/users/${centralID}`;

  const { data: queues } = useQuery({
    queryKey: ["supportQueues"],
    queryFn: async () => {
      const res = await api.getSupportQueues();
      return res.data.queues;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      payload,
    }: {
      payload: Parameters<typeof api.updateSupportTicket>[1];
      successMessage: string;
    }) => {
      const res = await api.updateSupportTicket(ticket.uuid, payload);
      if (res.data.err) throw new Error(res.data.errMsg);
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries(["ticket", ticket.uuid]);
      addNotification({ type: "success", message: variables.successMessage });
    },
    onError: (error: any) => {
      addNotification({
        type: "error",
        message:
          error?.response?.data?.errMsg ||
          "An error occurred while updating the ticket.",
      });
    },
  });

  return (
    <Card padding="sm" variant="default">
      <Card.Header>
        <Stack direction="horizontal" gap="md" align="start" justify="between">
          <Heading level={4} align="left" className="!mb-0">
            Ticket Details
          </Heading>
        </Stack>
      </Card.Header>
      <Card.Body className="py-4">
        <Stack gap="sm">
          {/* Read-only request info (two-column key/value layout) */}
          <div className="flex flex-col">
            <MetaRow label="Subject">{ticket?.title}</MetaRow>
            <MetaRow label="Requester">
              {ticket.user && (
                <Link
                  href={
                    ticket.user?.centralID
                      ? centralIdentityURL(ticket.user.centralID)
                      : "#"
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  {`${ticket.user.firstName} ${ticket.user.lastName} (${ticket.user.email})`}{" "}
                  (Authenticated)
                </Link>
              )}
              {ticket.guest && (
                <span className="inline-flex flex-wrap items-center gap-2">
                  {ticket.guest.firstName} {ticket.guest.lastName} (
                  {ticket.guest.email})
                  <Badge variant="warning" label="Guest" />
                </span>
              )}
            </MetaRow>
            <MetaRow label="Captured URL">
              {ticket?.capturedURL ? (
                <a href={ticket.capturedURL} target="_blank" rel="noreferrer">
                  {ticket.capturedURL}
                </a>
              ) : (
                "N/A"
              )}
            </MetaRow>
            <MetaRow label="Date Opened">
              {format(parseISO(ticket.timeOpened), "MM/dd/yyyy hh:mm aa")}
            </MetaRow>
            {ticket.status === "closed" && ticket.timeClosed && (
              <MetaRow label="Date Closed">
                {format(parseISO(ticket.timeClosed), "MM/dd/yyyy hh:mm aa")}
              </MetaRow>
            )}
            <MetaRow label="Device">
              {ticket.deviceInfo &&
                Object.keys(ticket.deviceInfo).length !== 0 ? (
                <span className="flex flex-col gap-0.5 text-xs text-gray-500">
                  <span>
                    <span className="font-semibold">User Agent:</span>{" "}
                    {ticket.deviceInfo?.userAgent || "Unknown"}
                  </span>
                  <span>
                    <span className="font-semibold">Language:</span>{" "}
                    {ticket.deviceInfo?.language || "Unknown"}
                  </span>
                  <span>
                    <span className="font-semibold">Screen Resolution:</span>{" "}
                    {ticket.deviceInfo?.screenResolution || "Unknown"}
                  </span>
                  <span>
                    <span className="font-semibold">Time Zone:</span>{" "}
                    {ticket.deviceInfo?.timeZone || "Unknown"}
                  </span>
                </span>
              ) : (
                "Not Available"
              )}
            </MetaRow>
          </div>

          <Divider className="my-1" />

          {/* Editable metadata */}
          <div id="ticket-assignee-field" className="flex flex-col gap-1 rounded-md p-1">
            <FieldLabel htmlText="Assignees" />
            <TicketAssigneePicker
              ticketId={ticket.uuid}
              assignedUUIDs={ticket.assignedUUIDs}
              disabled={editDisabled}
            />
          </div>

          <Divider className="my-1" />

          <div className="flex flex-col gap-1">
            <FieldLabel htmlText="CC'd" />
            <TicketCCEditor
              ticketId={ticket.uuid}
              ccedEmails={ticket.ccedEmails}
              disabled={isClosed}
            />
          </div>
          <Divider className="my-1" />

          <Stack direction="vertical" gap="md">
            <div className="flex flex-col">
              <FieldLabel htmlText="Queue" />
              <Select
                name="queue"
                label="Queue"
                labelClassName="sr-only"
                placeholder="Select a queue"
                value={ticket.queue?.slug ?? ""}
                disabled={editDisabled}
                options={(queues ?? []).map((q) => ({
                  value: q.slug,
                  label: q.ticket_descriptor || q.name,
                }))}
                onChange={(e) => {
                  const label =
                    (queues ?? []).find((q) => q.slug === e.target.value)
                      ?.ticket_descriptor ?? e.target.value;
                  updateMutation.mutate({
                    payload: { queue: e.target.value },
                    successMessage: `Moved to ${label} queue.`,
                  });
                }}
              />
            </div>

            <div className="flex flex-col">
              <FieldLabel htmlText="Category" />
              <Select
                name="category"
                label="Category"
                labelClassName="sr-only"
                placeholder="Select a category"
                value={ticket.category ?? ""}
                disabled={editDisabled}
                options={SupportTicketCategoryOptions.map((o) => ({
                  value: o.value,
                  label: o.text,
                }))}
                onChange={(e) =>
                  updateMutation.mutate({
                    payload: { category: e.target.value },
                    successMessage: `Category set to ${getPrettySupportTicketCategory(
                      e.target.value
                    )}.`,
                  })
                }
              />
            </div>

            <div className="flex flex-col">
              <FieldLabel htmlText="Status" />
              <Listbox
                value={ticket.status}
                disabled={editDisabled}
                onChange={(val) =>
                  updateMutation.mutate({
                    payload: { status: val as SupportTicketStatus },
                    successMessage: `Status set to ${getPrettySupportTicketStatus(
                      val
                    )}.`,
                  })
                }
              >
                <Listbox.Button
                  aria-label="Status"
                  displayValue={(v) =>
                    getPrettySupportTicketStatus(v ?? ticket.status)
                  }
                />
                <Listbox.Options>
                  {SupportTicketStatusOptions.map((o) => (
                    <Listbox.Option key={o.value} value={o.value}>
                      <span className="flex items-center gap-2">
                        <Dot className={statusDotColor(o.value)} />
                        {o.text}
                      </span>
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Listbox>
            </div>

            <div className="flex flex-col">
              <FieldLabel htmlText="Priority" />
              <Listbox
                value={ticket.priority ?? "medium"}
                disabled={editDisabled}
                onChange={(val) =>
                  updateMutation.mutate({
                    payload: { priority: val as SupportTicketPriority },
                    successMessage: `Priority set to ${capitalizeFirstLetter(
                      val
                    )}.`,
                  })
                }
              >
                <Listbox.Button
                  aria-label="Priority"
                  displayValue={(v) =>
                    capitalizeFirstLetter(v ?? ticket.priority ?? "medium")
                  }
                />
                <Listbox.Options>
                  {SupportTicketPriorityOptions.map((o) => (
                    <Listbox.Option key={o.value} value={o.value}>
                      <span className="flex items-center gap-2">
                        <Dot className={priorityDotColor(o.value)} />
                        {o.text}
                      </span>
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Listbox>
            </div>
          </Stack>

          {/* <Divider className="my-1" />

          <div className="flex flex-col">
            <FieldLabel htmlText="Automation" />
            <Switch
              name="auto-close"
              label="Auto-close when resolved"
              description="Automatically close this ticket after a period of inactivity once it is resolved."
              checked={!ticket.autoCloseSilenced}
              disabled={isClosed}
              onChange={(checked) =>
                updateMutation.mutate({
                  payload: { autoCloseSilenced: !checked },
                  successMessage: checked
                    ? "Auto-close enabled."
                    : "Auto-close disabled.",
                })
              }
            />
          </div> */}
        </Stack>
      </Card.Body>
    </Card>
  );
};

export default TicketDetails;
