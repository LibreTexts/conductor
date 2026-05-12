import { useEffect } from "react";
import { SupportTicket, User } from "../../types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../api";
import { useNotifications } from "../../context/NotificationContext";
import { useForm } from "react-hook-form";
import { Button, Listbox, Modal } from "@libretexts/davis-react";
import { IconCheck, IconX } from "@tabler/icons-react";

interface AssignTicketModalProps {
  open: boolean;
  onCancel: () => void;
  onSave: () => void;
  ticketId: string;
}

const AssignTicketModal: React.FC<AssignTicketModalProps> = ({
  open,
  onCancel,
  onSave,
  ticketId,
  ...rest
}) => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const { control, getValues, setValue, watch, register } = useForm<{
    assignees: string[];
  }>({
    defaultValues: {
      assignees: [],
    },
  });

  const { data: ticket } = useQuery<SupportTicket>({
    queryKey: ["ticket", ticketId],
    queryFn: async () => {
      const res = await api.getSupportTicket(ticketId);
      return res.data.ticket;
    },
    enabled: open && !!ticketId,
  });

  const { data: assignableUsers } = useQuery<
    Pick<User, "uuid" | "firstName" | "lastName" | "email" | "avatar">[]
  >({
    queryKey: ["assignableUsers"],
    queryFn: async () => {
      const res = await api.getSupportAssignableUsers();
      return res.data.users;
    },
    enabled: open && !!ticketId,
  });

  useEffect(() => {
    if (!ticket || !open) return;
    // Set the current assignees in the form
    if (ticket.assignedUUIDs && ticket.assignedUUIDs.length > 0) {
      setValue("assignees", ticket.assignedUUIDs);
    }
  }, [ticket, open]);

  const updateAssignedMutation = useMutation({
    mutationFn: async (data: { assignees: string[] }) => {
      if (!ticketId) return;
      const res = await api.assignSupportTicket(ticketId, data.assignees);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
    },
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries(["ticket", ticketId]);
      addNotification({
        type: "success",
        message: `Successfully updated assignees.`,
      });
      onSave();
    },
    onError: (error: any) => {
      console.error("Error updating assignees:", error);
      addNotification({
        type: "error",
        message:
          error?.response?.data?.errMsg ||
          `An error occurred while updating assignees.`,
      });
    },
  });

  const getAssignedNames = (v: string[]) => {
    if (v.length === 0) return "No change...";
    const names = assignableUsers
      ?.filter((user) => v.includes(user.uuid))
      .map((user) => `${user.firstName} ${user.lastName}`);
    return names?.join(", ") || "No change...";
  }

  return (
    <Modal {...rest} open={open} onClose={onCancel}>
      <Modal.Header>
        <Modal.Title>Assign Ticket to User(s)</Modal.Title>
      </Modal.Header>
      <Modal.Body className="">
        <Listbox
          // {...register("assignees")}
          value={watch('assignees')}
          onChange={(v) => setValue("assignees", v)}
          multiple
        >
          <Listbox.Button
            displayValue={(v) => getAssignedNames(v as unknown as string[])}
            placeholder="No change..."
          />

          <Listbox.Options>
            {
              assignableUsers?.map((user) => (
                <Listbox.Option key={user.uuid} value={user.uuid}>
                  {`${user.firstName} ${user.lastName} (${user.email})`}
                </Listbox.Option>
              )) || []
            }
          </Listbox.Options>
        </Listbox>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="outline"
          onClick={() => onCancel()}
          icon={<IconX size={18} />}
          loading={updateAssignedMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          color="blue"
          onClick={() => updateAssignedMutation.mutate(getValues())}
          icon={<IconCheck size={18} />}
          loading={updateAssignedMutation.isPending}
          disabled={watch("assignees").length === 0}
        >
          Save Changes
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AssignTicketModal;
