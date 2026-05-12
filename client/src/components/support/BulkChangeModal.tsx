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
import { useEffect, useMemo } from "react";
import { useNotifications } from "../../context/NotificationContext";
import { Button, Listbox, Modal } from "@libretexts/davis-react";
import { IconCheck, IconX } from "@tabler/icons-react";

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
  const { control, reset, getValues, watch, setValue } =
    useForm<BulkChangeFormData>({
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
  const { data: queues, invalidate: invalidateQueues } = useSupportQueues({
    withCount: false,
  });

  const { data: assignableUsers } = useQuery<
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
      invalidateQueues();
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

  const getQueueName = (v: string) => {
    if (!v) return "No Change...";
    return queues?.find((q) => q.slug === v)?.name || "No Change...";
  };

  const getPriorityName = (v: string) => {
    if (!v) return "No Change...";
    const found = SupportTicketPriorityOptions.find((p) => p.value === v);
    return found ? capitalizeFirstLetter(found.text) : "No Change...";
  };

  const getStatusName = (v: string) => {
    if (!v) return "No Change...";
    const found = SupportTicketStatusOptions.find((s) => s.value === v);
    return found ? capitalizeFirstLetter(found.text) : "No Change...";
  };

  const getAssignedNames = (v: string[]) => {
    if (v.length === 0) return "No Change...";
    const names = assignableUsers
      ?.filter((user) => v.includes(user.uuid))
      .map((user) => `${user.firstName} ${user.lastName}`);
    return names?.join(", ") || "No Change...";
  };

  return (
    <Modal open={open} onClose={onCancel}>
      <Modal.Header>
        <Modal.Title>
          Bulk Change {selectedTickets.length} Tickets
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="space-y-8">
        <Listbox
          value={watch("queue")}
          onChange={(v) => setValue("queue", v)}
        >
          <Listbox.Label>Change Queue</Listbox.Label>
          <Listbox.Button
            displayValue={(v) => getQueueName(v as string)}
            placeholder="No Change..."
          />
          <Listbox.Options>
            {queues?.map((queue) => (
              <Listbox.Option key={queue.slug} value={queue.slug}>
                {queue.name}
              </Listbox.Option>
            )) || []}
          </Listbox.Options>
        </Listbox>
        <Listbox
          value={watch("priority")}
          onChange={(v) => setValue("priority", v)}
        >
          <Listbox.Label>Change Priority</Listbox.Label>
          <Listbox.Button
            displayValue={(v) => getPriorityName(v as string)}
            placeholder="No Change..."
          />
          <Listbox.Options>
            {SupportTicketPriorityOptions.map((priority) => (
              <Listbox.Option key={priority.value} value={priority.value}>
                {capitalizeFirstLetter(priority.text)}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Listbox>
        <Listbox
          value={watch("status")}
          onChange={(v) => setValue("status", v)}
        >
          <Listbox.Label>Change Status</Listbox.Label>
          <Listbox.Button
            displayValue={(v) => getStatusName(v as string)}
            placeholder="No Change..."
          />
          <Listbox.Options>
            {SupportTicketStatusOptions.map((status) => (
              <Listbox.Option key={status.value} value={status.value}>
                {capitalizeFirstLetter(status.text)}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Listbox>
        <Listbox
          value={watch("assignees")}
          onChange={(v) => setValue("assignees", v)}
          multiple
        >
          <Listbox.Label>Change Assignees</Listbox.Label>
          <Listbox.Button
            displayValue={(v) => getAssignedNames(v as unknown as string[])}
            placeholder="No Change..."
          />
          <Listbox.Options>
            {assignableUsers?.map((user) => (
              <Listbox.Option key={user.uuid} value={user.uuid}>
                {`${user.firstName} ${user.lastName} (${user.email})`}
              </Listbox.Option>
            )) || []}
          </Listbox.Options>
        </Listbox>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="outline"
          onClick={() => onCancel()}
          icon={<IconX size={18} />}
          loading={bulkUpdateMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          color="blue"
          onClick={() => bulkUpdateMutation.mutate(getValues())}
          icon={<IconCheck size={18} />}
          disabled={saveDisabled}
          loading={bulkUpdateMutation.isPending}
        >
          Save Changes
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default BulkChangeModal;
