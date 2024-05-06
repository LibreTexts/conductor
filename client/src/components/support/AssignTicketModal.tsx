import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Button,
  ModalProps,
  Dropdown,
  Form,
  Icon,
  Table,
  Image,
} from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import { SupportTicket, User } from "../../types";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

  const { data: ticket, isFetching: isFetchingTicket } =
    useQuery<SupportTicket>({
      queryKey: ["ticket", ticketId],
      queryFn: async () => {
        const res = await axios.get(`/support/ticket/${ticketId}`);
        return res.data.ticket;
      },
      enabled: !!ticketId,
    });

  const { data: assignableUsers, isFetching: isFetchingUsers } = useQuery<
    Pick<User, "uuid" | "firstName" | "lastName" | "email">[]
  >({
    queryKey: ["assignableUsers", ticketId, ticket?.assignedUUIDs ?? []],
    queryFn: () => getAssignableUsers(ticketId),
    enabled: !!ticketId,
  });

  async function getAssignableUsers(ticketId: string) {
    try {
      if (!ticketId) return [];

      const res = await axios.get(`/support/ticket/${ticketId}/assign`);

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.users) {
        throw new Error("Invalid response from server");
      }

      return res.data.users ?? [];
    } catch (err) {
      handleGlobalError(err);
      return [];
    }
  }

  async function assignTicket(userToAssign: string) {
    try {
      if (!ticketId || !ticketId) return;

      const res = await axios.patch(`/support/ticket/${ticketId}/assign`, {
        assigned: [...(ticket?.assignedUUIDs ?? []), userToAssign],
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
    } catch (err) {
      handleGlobalError(err);
    }
  }

  async function unassignTicket(userToUnassign: string) {
    try {
      if (!ticketId || !ticketId) return;

      const res = await axios.patch(`/support/ticket/${ticketId}/assign`, {
        assigned: (ticket?.assignedUUIDs ?? []).filter(
          (uuid) => uuid !== userToUnassign
        ),
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
    } catch (err) {
      handleGlobalError(err);
    }
  }

  const assignTicketMutation = useMutation({
    mutationFn: ({ userToAssign }: { userToAssign: string }) =>
      assignTicket(userToAssign),
    onSuccess: () => {
      queryClient.invalidateQueries(["ticket", ticketId]);
    },
  });

  const unassignTicketMutation = useMutation({
    mutationFn: ({ userToUnassign }: { userToUnassign: string }) =>
      unassignTicket(userToUnassign),
    onSuccess: () => {
      queryClient.invalidateQueries(["ticket", ticketId]);
    },
  });

  return (
    <Modal open={open} onClose={onClose} {...rest}>
      <Modal.Header>Assign Ticket to User(s)</Modal.Header>
      <Modal.Content>
        <div className="flex flex-col">
          <p className="text-lg font-semibold">Current Assigned Users</p>
          <div className="flex">
            <Table celled striped compact>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell width={"7"}>Name</Table.HeaderCell>
                  <Table.HeaderCell width={"1"}>Actions</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {ticket?.assignedUsers?.map((item) => (
                  <Table.Row key={item.uuid}>
                    <Table.Cell>
                      <Image avatar src={item.avatar} />
                      {item.firstName} {item.lastName}
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        color="red"
                        className="ml-1p"
                        onClick={() => {
                          unassignTicketMutation.mutateAsync({
                            userToUnassign: item.uuid,
                          });
                        }}
                        icon
                        loading={unassignTicketMutation.isLoading}
                      >
                        <Icon name="remove circle" />
                        <span className="ml-2">Remove</span>
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </div>
        <Form onSubmit={(e) => e.preventDefault()} className="mt-8">
          <p className="!mt-0">
            Assigned users will be notified of new messages and updates on this
            ticket.
          </p>
          <Dropdown
            id="selectUsers"
            options={assignableUsers?.map((u) => ({
              key: u.uuid,
              value: u.uuid,
              text: `${u.firstName} ${u.lastName} (${u.email})`,
            }))}
            onChange={(e, { value }) => {
              assignTicketMutation.mutateAsync({
                userToAssign: value as string,
              });
            }}
            fluid
            selection
            search
            placeholder="Select User to Assign..."
            loading={isFetchingUsers || isFetchingTicket}
            selectOnBlur={false}
          />
        </Form>
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
