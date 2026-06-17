import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Listbox,
  Modal,
  Select,
  Switch,
} from "@libretexts/davis-react";
import { IconCheck, IconX } from "@tabler/icons-react";
import api from "../../api";
import { useNotifications } from "../../context/NotificationContext";
import { useSupportCenterContext } from "../../context/SupportCenterContext";
import { SupportQueueAutoAssignConfig, User } from "../../types";

interface QueueAutoAssignmentModalProps {
  open: boolean;
  onClose: () => void;
}

const QueueAutoAssignmentModal: React.FC<QueueAutoAssignmentModalProps> = ({
  open,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const { selectedQueue } = useSupportCenterContext();

  const [selectedQueueId, setSelectedQueueId] = useState<string>("");
  const [enabled, setEnabled] = useState<boolean>(false);
  const [assigneeUUIDs, setAssigneeUUIDs] = useState<string[]>([]);

  const { data: configs, isLoading: isConfigsLoading } = useQuery<SupportQueueAutoAssignConfig[]>({
    queryKey: ["queueAutoAssignConfig"],
    queryFn: async () => {
      const res = await api.getQueueAutoAssignConfig();
      return res.data.queues;
    },
    enabled: open,
  });

  const { data: assignableUsers, isLoading: isAssignableUsersLoading } = useQuery<
    Pick<User, "uuid" | "firstName" | "lastName" | "email" | "avatar">[]
  >({
    queryKey: ["assignableUsers"],
    queryFn: async () => {
      const res = await api.getSupportAssignableUsers();
      return res.data.users;
    },
    enabled: open,
  });

  // Default the selected queue to the one active in the sidebar, falling back to the first.
  useEffect(() => {
    if (!open || !configs || configs.length === 0) return;
    if (selectedQueueId) return;
    const bySlug = configs.find((q) => q.slug === selectedQueue);
    setSelectedQueueId(bySlug?.id || configs[0].id);
  }, [open, configs, selectedQueue, selectedQueueId]);

  // Prefill the form whenever the selected queue (or loaded config) changes.
  useEffect(() => {
    if (!configs || !selectedQueueId) return;
    const current = configs.find((q) => q.id === selectedQueueId);
    setEnabled(current?.auto_assign_enabled ?? false);
    setAssigneeUUIDs(current?.auto_assign_uuids ?? []);
  }, [configs, selectedQueueId]);

  // Reset transient selection when the modal is closed so it re-defaults on next open.
  useEffect(() => {
    if (!open) setSelectedQueueId("");
  }, [open]);

  const queueOptions = useMemo(
    () => (configs || []).map((q) => ({ value: q.id, label: q.name })),
    [configs]
  );

  const getAssignedNames = (v: string[]) => {
    if (!v || v.length === 0) return "No staff selected";
    const names = assignableUsers
      ?.filter((user) => v.includes(user.uuid))
      .map((user) => `${user.firstName} ${user.lastName}`);
    return names?.join(", ") || "No staff selected";
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.updateQueueAutoAssignConfig(selectedQueueId, {
        auto_assign_enabled: enabled,
        auto_assign_uuids: enabled ? assigneeUUIDs : [],
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries(["queueAutoAssignConfig"]);
      await queryClient.invalidateQueries(["supportQueues"]);
      addNotification({
        type: "success",
        message: "Auto-assignment settings saved.",
      });
      onClose();
    },
    onError: (error: any) => {
      addNotification({
        type: "error",
        message:
          error?.response?.data?.errMsg ||
          "An error occurred while saving auto-assignment settings.",
      });
    },
  });

  return (
    <Modal open={open} onClose={onClose}>
      <Modal.Header>
        <Modal.Title>Queue Auto-Assignment</Modal.Title>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-4">
        <Select
          name="auto-assign-queue"
          label="Queue"
          value={selectedQueueId}
          options={queueOptions}
          placeholder="Select a queue"
          onChange={(e) => setSelectedQueueId(e.target.value)}
          disabled={isConfigsLoading}
        />
        <Switch
          name="auto-assign-enabled"
          label="Auto-assign new tickets in this queue"
          description="When enabled, every new ticket routed to this queue is automatically assigned to the selected staff."
          checked={enabled}
          onChange={setEnabled}
          disabled={!selectedQueueId || isConfigsLoading}
        />
        <Listbox
          value={assigneeUUIDs}
          onChange={(v) => setAssigneeUUIDs(v as unknown as string[])}
          multiple
          disabled={!enabled || !selectedQueueId || isAssignableUsersLoading || isConfigsLoading}
        >
          <Listbox.Label>Support staff</Listbox.Label>
          <Listbox.Button
            displayValue={(v) => getAssignedNames(v as unknown as string[])}
            placeholder="No staff selected"
            disabled={!enabled || !selectedQueueId}
            aria-label="Select support staff to auto-assign"
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
          onClick={() => onClose()}
          icon={<IconX size={18} />}
          loading={saveMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          color="blue"
          onClick={() => saveMutation.mutate()}
          icon={<IconCheck size={18} />}
          loading={saveMutation.isPending}
          disabled={!selectedQueueId}
        >
          Save Changes
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default QueueAutoAssignmentModal;
