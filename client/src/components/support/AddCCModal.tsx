import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Icon, Input, Modal, ModalProps } from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import { useNotifications } from "../../context/NotificationContext";
import api from "../../api";
import { useState } from "react";

interface AddCCModalProps extends ModalProps {
  open: boolean;
  onClose: () => void;
  ticketId: string;
}

const AddCCModal: React.FC<AddCCModalProps> = ({
  open,
  onClose,
  ticketId,
  ...rest
}) => {
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();
  const [newEmail, setNewEmail] = useState("");

  const addCCMutation = useMutation({
    mutationFn: async (newEmail: string) => {
      if (!ticketId) throw new Error("Ticket ID is required");

      const res = await api.addSupportTicketCC(ticketId, newEmail);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["ticket", ticketId]);
      addNotification({
        type: "success",
        message: "Successfully added CC to ticket",
      });
      onClose();
    },
    onError: (err: Error) => {
      handleGlobalError(err);
    },
  });

  return (
    <Modal open={open} onClose={onClose} {...rest}>
      <Modal.Header>Add CC'd User</Modal.Header>
      <Modal.Content>
        <Modal.Description>
          <div className="w-full">
            <p className="">
              This user will receive all updates and messages related to this
              ticket and can respond to them. <strong>Caution:</strong> Once
              you've added a user to the CC list, they'll always be able to
              access this ticket.
            </p>
            <Input
              placeholder="Email Address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full mt-2"
            />
          </div>
        </Modal.Description>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => addCCMutation.mutate(newEmail)}
          color="green"
          disabled={!newEmail || newEmail.length < 3}
          loading={addCCMutation.isLoading}
        >
          <Icon name="plus" />
          Add
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default AddCCModal;
