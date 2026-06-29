import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Text } from "@libretexts/davis-react";
import { IconPlus, IconX } from "@tabler/icons-react";
import api from "../../api";
import { useNotifications } from "../../context/NotificationContext";

interface TicketCCEditorProps {
  ticketId: string;
  ccedEmails?: { email: string }[];
  /** When the ticket is closed, render CC list read-only. */
  disabled?: boolean;
}

// Pragmatic client-side check; the server validates with z.string().email() as source of truth.
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const TicketCCEditor: React.FC<TicketCCEditorProps> = ({
  ticketId,
  ccedEmails,
  disabled = false,
}) => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const [newEmail, setNewEmail] = useState("");

  const emails = (ccedEmails ?? []).map((c) => c.email);

  const addMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await api.addSupportTicketCC(ticketId, email);
      if (res.data.err) throw new Error(res.data.errMsg);
    },
    onSuccess: async () => {
      setNewEmail("");
      await queryClient.invalidateQueries(["ticket", ticketId]);
      addNotification({ type: "success", message: "Successfully added CC." });
    },
    onError: (error: any) => {
      addNotification({
        type: "error",
        message:
          error?.response?.data?.errMsg ||
          "An error occurred while adding the CC.",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await api.removeSupportTicketCC(ticketId, email);
      if (res.data.err) throw new Error(res.data.errMsg);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries(["ticket", ticketId]);
      addNotification({ type: "success", message: "Successfully removed CC." });
    },
    onError: (error: any) => {
      addNotification({
        type: "error",
        message:
          error?.response?.data?.errMsg ||
          "An error occurred while removing the CC.",
      });
    },
  });

  const handleAdd = () => {
    const email = newEmail.trim();
    if (!isValidEmail(email)) {
      addNotification({
        type: "error",
        message: "Please enter a valid email address.",
      });
      return;
    }
    if (emails.includes(email)) {
      addNotification({ type: "error", message: "That email is already CC'd." });
      return;
    }
    addMutation.mutate(email);
  };

  if (disabled) {
    return (
      <Text size="sm" color={emails.length ? undefined : "muted"}>
        {emails.length ? emails.join(", ") : "None"}
      </Text>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {emails.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {emails.map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-0.5 pl-2.5 pr-1"
            >
              <Text size="sm" className="break-all">
                {email}
              </Text>
              <button
                type="button"
                aria-label={`Remove ${email}`}
                onClick={() => removeMutation.mutate(email)}
                disabled={removeMutation.isPending}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <IconX size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-start gap-2">
        <Input
          name="cc-email"
          label="Add a CC'd email"
          labelClassName="sr-only"
          placeholder="Email address"
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="grow"
          helperText="CC'd recipients receive all updates and retain access to this ticket."
        />
        <Button
          variant="outline"
          onClick={handleAdd}
          loading={addMutation.isPending}
          disabled={!newEmail.trim()}
          icon={<IconPlus size={16} />}
        >
          Add
        </Button>
      </div>
    </div>
  );
};

export default TicketCCEditor;
