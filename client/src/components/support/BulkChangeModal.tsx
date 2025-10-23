import { Modal } from "semantic-ui-react";
import { useSupportCenterContext } from "../../context/SupportCenterContext";
import useSupportQueues from "../../hooks/useSupportQueues";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User } from "../../types";
import api from "../../api";
import { useForm } from "react-hook-form";
import {
  SupportTicketPriorityOptions,
  SupportTicketStatusOptions,
} from "../../utils/supportHelpers";
import { capitalizeFirstLetter } from "../util/HelperFunctions";
import Button from "../NextGenComponents/Button";
import { useEffect, useMemo } from "react";
import CtlNextGenCombobox from "../ControlledInputs/CtlNextGenCombobox";
import { useNotifications } from "../../context/NotificationContext";

type BulkChangeFormData = {
  queue: string;
  assignees: string[];
  priority: string;
  status: string;
};

interface BulkChangeModalProps {
  open: boolean;
  onCancel: () => void;
  onSave: () => void;
}

const BulkChangeModal: React.FC<BulkChangeModalProps> = ({
  open,
  onCancel,
  onSave,
}) => {
  const { control, reset, getValues, watch } = useForm<BulkChangeFormData>({
    defaultValues: {
      queue: "",
      assignees: [],
      priority: "",
      status: "",
    },
  });

  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const { selectedTickets } = useSupportCenterContext();
  const { data: queues } = useSupportQueues({
    withCount: false,
  });

  const { data: assignableUsers, isFetching: isFetchingUsers } = useQuery<
    Pick<User, "uuid" | "firstName" | "lastName" | "email" | "avatar">[]
  >({
    queryKey: ["assignableUsers"],
    queryFn: async () => {
      const res = await api.getSupportAssignableUsers();
      return res.data.users;
    },
  });

  useEffect(() => {
    if (open) {
      reset({ queue: "", assignees: [], priority: "", status: "" });
    }
  }, [open]);

  const saveDisabled = useMemo(() => {
    if (
      !getValues("queue") &&
      getValues("assignees").length === 0 &&
      !getValues("priority") &&
      !getValues("status")
    ) {
      return true;
    }
    return false;
  }, [watch("queue"), watch("assignees"), watch("priority"), watch("status")]);

  const bulkUpdateMutation = useMutation({
    mutationFn: async (data: BulkChangeFormData) => {
      await api.bulkUpdateTickets({
        tickets: selectedTickets,
        queue: data.queue || undefined,
        assignee: data.assignees.length > 0 ? data.assignees : undefined,
        priority: data.priority || undefined,
        status: data.status || undefined,
      });
    },
    onSuccess: async () => {
      addNotification({
        type: "success",
        message: `Successfully updated ${selectedTickets.length} tickets.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["supportTickets"] });
      onSave();
    },
    onError: (error: any) => {
      console.error("Error bulk updating tickets:", error);
      addNotification({
        type: "error",
        message:
          error?.response?.data?.errMsg ||
          `An error occurred while updating tickets.`,
      });
    },
  });

  return (
    <Modal open={open} onClose={onCancel} size="small">
      <Modal.Header>Bulk Change {selectedTickets.length} Tickets</Modal.Header>
      <Modal.Content className="space-y-8">
        <CtlNextGenCombobox
          control={control}
          name="queue"
          label="Change Queue"
          placeholder="No Change..."
          items={
            queues?.map((queue) => ({
              key: queue.slug,
              value: queue.slug,
              text: queue.name,
            })) || []
          }
        />
        <CtlNextGenCombobox
          control={control}
          name="priority"
          label="Change Priority"
          placeholder="No Change..."
          items={SupportTicketPriorityOptions.map((priority) => ({
            key: priority.value,
            value: priority.value,
            text: capitalizeFirstLetter(priority.text),
          }))}
        />
        <CtlNextGenCombobox
          control={control}
          name="status"
          label="Change Status"
          placeholder="No Change..."
          items={SupportTicketStatusOptions.map((status) => ({
            key: status.value,
            value: status.value,
            text: capitalizeFirstLetter(status.text),
          }))}
        />
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
          loading={bulkUpdateMutation.isLoading}
        >
          Cancel
        </Button>
        <Button
          color="blue"
          onClick={() => bulkUpdateMutation.mutate(getValues())}
          icon="IconCheck"
          disabled={saveDisabled}
          loading={bulkUpdateMutation.isLoading}
        >
          Save Changes
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default BulkChangeModal;
