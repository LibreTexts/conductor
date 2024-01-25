import {
  Button,
  Form,
  Icon,
  Modal,
  ModalProps,
  Table,
} from "semantic-ui-react";
import { useTypedSelector } from "../../state/hooks";
import { useFieldArray, useForm } from "react-hook-form";
import { Organization } from "../../types";
import { useState } from "react";
import axios from "axios";
import useGlobalError from "../error/ErrorHooks";

interface SupportCenterSettingsModalProps extends ModalProps {
  open: boolean;
  onClose: () => void;
}

const SupportCenterSettingsModal: React.FC<SupportCenterSettingsModalProps> = ({
  open,
  onClose,
  ...rest
}) => {
  const { handleGlobalError } = useGlobalError();
  const org = useTypedSelector((state) => state.org);
  const [supportTicketNotifiers, setSupportTicketNotifiers] = useState<
    string[]
  >(org?.supportTicketNotifiers ?? []);
  const [emailToAdd, setEmailToAdd] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  async function handleSave() {
    try {
      setLoading(true);
      const res = await axios.put(`/org/${org.orgID}`, {
        supportTicketNotifiers,
      });

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.updatedOrg) {
        throw new Error("Invalid response from server");
      }

      onClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleAddEmail() {
    if (!emailToAdd) return;
    setSupportTicketNotifiers([...supportTicketNotifiers, emailToAdd]);
    setEmailToAdd("");
  }

  function handleRemoveEmail(email: string) {
    setSupportTicketNotifiers(
      supportTicketNotifiers.filter((item) => item !== email)
    );
  }

  return (
    <Modal open={open} onClose={onClose} size="fullscreen" {...rest}>
      <Modal.Header>Support Center Settings</Modal.Header>
      <Modal.Content>
        <div>
          <p className="font-bold ml-0.5 text-lg">
            New Ticket Notification Recipients:
          </p>
          <Table className="!mt-0.5" celled striped>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell width={9}>Email Address</Table.HeaderCell>
                <Table.HeaderCell width={1}>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {supportTicketNotifiers.map((item, index) => {
                return (
                  <Table.Row key={crypto.randomUUID()}>
                    <Table.Cell>{item}</Table.Cell>
                    <Table.Cell>
                      <Button
                        color="red"
                        icon="trash"
                        onClick={() => handleRemoveEmail(item)}
                      />
                    </Table.Cell>
                  </Table.Row>
                );
              })}
              {supportTicketNotifiers.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={2} className="text-center">
                    No email addresses added.
                  </Table.Cell>
                </Table.Row>
              )}
              <Table.Row>
                <Table.Cell>
                  <Form onSubmit={handleAddEmail}>
                    <Form.Input
                      type="email"
                      placeholder="Email Address"
                      value={emailToAdd}
                      onChange={(e) => setEmailToAdd(e.target.value)}
                    />
                  </Form>
                </Table.Cell>
                <Table.Cell>
                  <Button color="blue" onClick={handleAddEmail}>
                    <Icon name="plus" />
                    Add
                  </Button>
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table>
        </div>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose} loading={loading}>
          <Icon name="close" /> Close
        </Button>
        <Button onClick={handleSave} color="green" loading={loading}>
          <Icon name="save" /> Save
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default SupportCenterSettingsModal;
