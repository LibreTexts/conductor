import { useCallback } from "react";
import {
  Modal,
  Button,
  ModalProps,
  Icon,
  Table,
  Image,
} from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import { SupportTicket, User } from "../../types";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../api";
import { useNotifications } from "../../context/NotificationContext";

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
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();

  const { data: ticket, isFetching: isFetchingTicket } =
    useQuery<SupportTicket>({
      queryKey: ["ticket", ticketId],
      queryFn: async () => {
        const res = await api.getSupportTicket(ticketId);
        return res.data.ticket;
      },
      enabled: !!ticketId,
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

  async function updateAssigned(assigned: string[]) {
    try {
      if (!ticketId) return;

      const res = await api.assignSupportTicket(ticketId, assigned);

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
    } catch (err) {
      handleGlobalError(err);
    }
  }

  const updateAssignedMutation = useMutation({
    mutationFn: ({
      uuid,
      action,
    }: {
      uuid: string;
      action: "assign" | "unassign";
    }) => {
      const calcAssigned = () => {
        if (action === "assign") {
          return [...(ticket?.assignedUUIDs ?? []), uuid];
        } else {
          const filtered = ticket?.assignedUUIDs?.filter((u) => u !== uuid);
          return filtered ?? [];
        }
      };

      return updateAssigned(calcAssigned());
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(["ticket", ticketId]);
      addNotification({
        type: "success",
        message: `User ${
          variables.action === "assign" ? "assigned" : "unassigned"
        } successfully`,
      });
    },
  });

  const isAssigned = useCallback(
    (uuid: string) => {
      if (!ticket?.assignedUUIDs) return false;
      return ticket?.assignedUUIDs?.some((u) => u === uuid);
    },
    [ticket?.assignedUUIDs]
  );

  return (
    <Modal open={open} onClose={onClose} {...rest}>
      <Modal.Header>Assign Ticket to User(s)</Modal.Header>
      <Modal.Content>
        <div className="flex flex-col">
          <div className="flex">
            <Table celled striped compact>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell width={"7"}>Name</Table.HeaderCell>
                  <Table.HeaderCell width={"1"}>Actions</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {assignableUsers?.map((item) => {
                  const userAssigned = isAssigned(item.uuid);
                  return (
                    <Table.Row key={item.uuid}>
                      <Table.Cell>
                        <Image avatar src={item.avatar} />
                        {item.firstName} {item.lastName}
                      </Table.Cell>
                      <Table.Cell>
                        <Button
                          color={userAssigned ? "red" : "green"}
                          className="ml-1p w-36"
                          onClick={() => {
                            updateAssignedMutation.mutateAsync({
                              uuid: item.uuid,
                              action: userAssigned ? "unassign" : "assign",
                            });
                          }}
                          icon
                          loading={updateAssignedMutation.isLoading}
                        >
                          <Icon
                            name={userAssigned ? "user delete" : "user plus"}
                          />
                          <span className="ml-2">
                            {userAssigned ? "Unassign" : "Assign"}
                          </span>
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table>
          </div>
        </div>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose} loading={isFetchingTicket || isFetchingUsers}>
          Close
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default AssignTicketModal;
