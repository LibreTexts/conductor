import { useEffect } from "react";
import { Modal, ModalProps } from "semantic-ui-react";
import { SupportTicket, User } from "../../types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../api";
import { useNotifications } from "../../context/NotificationContext";
import CtlNextGenCombobox from "../ControlledInputs/CtlNextGenCombobox";
import { useForm } from "react-hook-form";
import Button from "../NextGenComponents/Button";

interface AssignTicketModalProps extends ModalProps {
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
  const { control, getValues, setValue, watch } = useForm<{
    assignees: string[];
  }>({
    defaultValues: {
      assignees: [],
    },
  });

  const { data: ticket, isFetching: isFetchingTicket } =
    useQuery<SupportTicket>({
      queryKey: ["ticket", ticketId],
      queryFn: async () => {
        const res = await api.getSupportTicket(ticketId);
        return res.data.ticket;
      },
      enabled: open && !!ticketId,
    });

  const { data: assignableUsers, isFetching: isFetchingUsers } = useQuery<
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

  return (
    <Modal {...rest} open={open} onClose={onCancel}>
      <Modal.Header>Assign Ticket to User(s)</Modal.Header>
      <Modal.Content className="!mb-64">
        <CtlNextGenCombobox
          control={control}
          name="assignees"
          label="Change Assignees"
          placeholder="No Change..."
          multiple={true}
          loading={isFetchingUsers}
          items={
            assignableUsers?.map((user) => ({
              key: user.uuid,
              value: user.uuid,
              text: `${user.firstName} ${user.lastName} (${user.email})`,
            })) || []
          }
        />
      </Modal.Content>
      <Modal.Actions className="flex justify-end space-x-2">
        <Button
          variant="secondary"
          onClick={() => onCancel()}
          icon="IconX"
          loading={updateAssignedMutation.isLoading}
        >
          Cancel
        </Button>
        <Button
          color="blue"
          onClick={() => updateAssignedMutation.mutate(getValues())}
          icon="IconCheck"
          loading={updateAssignedMutation.isLoading}
          disabled={watch("assignees").length === 0}
        >
          Save Changes
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default AssignTicketModal;
