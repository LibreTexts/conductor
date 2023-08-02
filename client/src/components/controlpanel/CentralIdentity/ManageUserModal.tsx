import "../../../styles/global.css";
import {
  Modal,
  Button,
  Icon,
  ModalProps,
  Header,
  Table,
  Feed,
} from "semantic-ui-react";
import { useState, useEffect } from "react";
import { CentralIdentityUser, User } from "../../../types";
import CtlTextInput from "../../ControlledInputs/CtlTextInput";
import { useForm } from "react-hook-form";
import {
  accountStatusOptions,
  getPrettyAuthSource,
  getPrettyUserType,
  getPrettyVerficationStatus,
} from "../../../utils/centralIdentityHelpers";
import CtlCheckbox from "../../ControlledInputs/CtlCheckbox";

interface ManageUserModalProps extends ModalProps {
  show: boolean;
  user: CentralIdentityUser;
  onSave: () => void;
  onClose: () => void;
}

const ManageUserModal: React.FC<ManageUserModalProps> = ({
  show,
  user,
  onSave,
  onClose,
  ...rest
}) => {
  const { control, formState, reset } = useForm<CentralIdentityUser>({
    defaultValues: user,
  });

  // UI
  const [editingFirstName, setEditingFirstName] = useState<boolean>(false);
  const [editingLastName, setEditingLastName] = useState<boolean>(false);

  // Effects

  useEffect(() => {
    // Reset editing states when modal is closed
    if (!show) {
      setEditingFirstName(false);
      setEditingLastName(false);
    }
  }, [show]);

  // Handlers
  function handleCancel() {
    reset();
    onClose();
  }

  function handleResetFirstName() {
    reset({ first_name: user.first_name });
    setEditingFirstName(false);
  }

  function handleResetLastName() {
    reset({ last_name: user.last_name });
    setEditingLastName(false);
  }

  return (
    <Modal open={show} onClose={onClose} {...rest} size="fullscreen">
      <Modal.Header>Manage User</Modal.Header>
      <Modal.Content scrolling id="task-view-content">
        <div className="flex-col-div">
          <div className="flex-row-div" id="project-task-header">
            <div className="task-detail-div">
              <Header sub>Avatar</Header>
              <Feed.Label>
                <img
                  width={40}
                  height={40}
                  src={user.avatar ?? ""}
                  alt="avatar"
                />
              </Feed.Label>
            </div>
            <div className="task-detail-div">
              <Header sub>First Name</Header>
              <div className="task-detail-textdiv">
                {editingFirstName && (
                  <div className="mt-2p flex-row-div">
                    <CtlTextInput
                      name="first_name"
                      control={control}
                      rules={{ required: true }}
                    />
                    <Icon
                      name="close"
                      size="small"
                      onClick={() => handleResetFirstName()}
                    />
                  </div>
                )}
                {!editingFirstName && (
                  <p>
                    {user.first_name}{" "}
                    <Icon
                      name="pencil"
                      size="small"
                      onClick={() => setEditingFirstName(true)}
                    />
                  </p>
                )}
              </div>
            </div>
            <div className="task-detail-div">
              <Header sub>Last Name</Header>
              <div className="task-detail-textdiv">
                {editingLastName && (
                  <div className="mt-2p flex-row-div">
                    <CtlTextInput
                      name="last_name"
                      control={control}
                      rules={{ required: true }}
                    />
                    <Icon
                      name="close"
                      size="small"
                      onClick={() => handleResetLastName()}
                    />
                  </div>
                )}
                {!editingLastName && (
                  <p>
                    {user.last_name}{" "}
                    <Icon
                      name="pencil"
                      size="small"
                      onClick={() => setEditingLastName(true)}
                    />
                  </p>
                )}
              </div>
            </div>
            <div className="task-detail-div">
              <Header sub>Email</Header>
              <p>{user.email}</p>
            </div>
            <div className="task-detail-div">
              <Header sub>Account Status</Header>
              <CtlCheckbox name="disabled" control={control} toggle />
            </div>
          </div>
          <div className="flex-row-div" id="project-task-page">
            <div id="task-view-left">
              <div className="mt-1p mb-4p">
                <div className="dividing-header-custom">
                  <h3>Permissions</h3>
                </div>
                <div className="flex-col-div">
                  <div className="flex-row-div mt-2p mb-2p">
                    <p>
                      <strong>User Type: </strong>
                      {getPrettyUserType(user.user_type)}
                    </p>
                  </div>
                  <div className="flex-row-div mb-2p">
                    <p>
                      <strong>Verification Status: </strong>
                      {getPrettyVerficationStatus(user.verify_status)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-1p mb-4p">
                <div className="dividing-header-custom">
                  <h3>Authentication & Security Data</h3>
                </div>
                <div className="flex-col-div">
                  <div className="flex-row-div mt-1p mb-2p">
                    <p>
                      <strong>Authentication Source: </strong>
                      {user.external_idp
                        ? getPrettyAuthSource(user.external_idp)
                        : "LibreOne"}
                    </p>
                  </div>
                  <div className="flex-row-div mb-2p">
                    <p>
                      <strong>Time of Last Access:</strong> Unknown
                    </p>
                  </div>
                  <div className="flex-row-div">
                    <p>
                      <strong>Time of Last Password Change: </strong>
                      {user.last_password_change ?? "Never"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div id="task-view-right">
              <div id="task-view-chat">
                <Table striped celled size="small" compact>
                  <Table.Header>
                    <Table.Row key="header1">
                      <Table.HeaderCell colSpan="2">
                        <span>Organizations</span>
                      </Table.HeaderCell>
                    </Table.Row>
                    <Table.Row key="header2">
                      <Table.HeaderCell key="orgNameHeader">
                        <span>Name</span>
                      </Table.HeaderCell>
                      <Table.HeaderCell key="orgSystemHeader">
                        <span>System (if applicable)</span>
                      </Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {user.organizations.length > 0 &&
                      user.organizations.map((org) => {
                        return (
                          <Table.Row key={org.id} className="word-break-all">
                            <Table.Cell>
                              <span>{org.name}</span>
                            </Table.Cell>
                            <Table.Cell>
                              <span></span>
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    {user.organizations.length === 0 && (
                      <Table.Row textAlign="center">
                        <Table.Cell colSpan="2">
                          <em>No associated organizations found.</em>
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={handleCancel}>Cancel</Button>
        {formState.isDirty && (
          <Button color="green" onClick={onSave}>
            <Icon name="save" />
            Save Changes
          </Button>
        )}
      </Modal.Actions>
    </Modal>
  );
};

export default ManageUserModal;
