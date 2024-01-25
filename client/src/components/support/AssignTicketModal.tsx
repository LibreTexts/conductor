import { useEffect, useState } from "react";
import {
  Modal,
  Button,
  ModalProps,
  Dropdown,
  Form,
  Icon,
} from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import { User } from "../../types";
import axios from "axios";

interface AssignTicketModalProps extends ModalProps {
  open: boolean;
  onClose: () => void;
  ticketId: string;
}

const AssignTicketModal: React.FC<AssignTicketModalProps> = ({
  open,
  onClose,
  ticketId,
  ...rest
}) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<
    Pick<User, "uuid" | "firstName" | "lastName" | "email">[]
  >([]);
  const [usersToAssign, setUsersToAssign] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      getAssignableUsers();
    }
  }, [open]);

  async function getAssignableUsers() {
    try {
      if (!ticketId) return;
      setLoading(true);

      const res = await axios.get(`/support/ticket/${ticketId}/assign`);

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.users) {
        throw new Error("Invalid response from server");
      }

      setUsers(res.data.users);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function assignTicket() {
    try {
      setLoading(true);
      if (!ticketId) return;
      if (!usersToAssign || !usersToAssign.length) {
        throw new Error("No users selected");
      }

      const res = await axios.patch(`/support/ticket/${ticketId}/assign`, {
        assigned: usersToAssign,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      onClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} {...rest}>
      <Modal.Header>Assign Ticket to User(s)</Modal.Header>
      <Modal.Content>
        <Form onSubmit={(e) => e.preventDefault()}>
          <Dropdown
            id="selectUsers"
            options={users.map((u) => ({
              key: u.uuid,
              value: u.uuid,
              text: `${u.firstName} ${u.lastName} (${u.email})`,
            }))}
            onChange={(e, { value }) => {
              setUsersToAssign(value as string[]);
            }}
            fluid
            selection
            multiple
            search
            placeholder="Select User(s)"
          />
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose} loading={loading}>
          Cancel
        </Button>
        <Button
          onClick={assignTicket}
          positive
          disabled={usersToAssign.length === 0}
          loading={loading}
        >
          <Icon name="user plus" />
          Assign
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default AssignTicketModal;
