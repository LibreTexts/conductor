import "../../../styles/global.css";
import "./ManageUserModal.css";
import {
  Modal,
  Button,
  Icon,
  ModalProps,
  Header,
  Table,
  Image,
  Dropdown,
  Popup,
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
  userTypeOptions,
  verificationStatusOptions,
} from "../../../utils/centralIdentityHelpers";
import CtlCheckbox from "../../ControlledInputs/CtlCheckbox";
import { isCentralIdentityUserProperty } from "../../../utils/typeHelpers";
import axios from "axios";
import useGlobalError from "../../error/ErrorHooks";
import { copyToClipboard, dirtyValues } from "../../../utils/misc";
import LoadingSpinner from "../../LoadingSpinner";

interface ManageUserModalProps extends ModalProps {
  show: boolean;
  userId: string;
  onSave: () => void;
  onClose: () => void;
}

const ManageUserModal: React.FC<ManageUserModalProps> = ({
  show,
  userId,
  onSave,
  onClose,
  ...rest
}) => {
  // Data & UI
  const DEFAULT_AVATAR_URL =
    "https://cdn.libretexts.net/DefaultImages/avatar.png";
  const [editingFirstName, setEditingFirstName] = useState<boolean>(false);
  const [editingLastName, setEditingLastName] = useState<boolean>(false);
  const [editingUserType, setEditingUserType] = useState<boolean>(false);
  const [editingVerifyStatus, setEditingVerifyStatus] =
    useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  // Only used for initial state reference so we can reset to original values as needed
  const [userInitVal, setUserInitVal] = useState<
    CentralIdentityUser | undefined
  >(undefined);

  // Hooks and Error Handling
  const { handleGlobalError } = useGlobalError();
  const { control, formState, reset, watch, getValues, setValue } =
    useForm<CentralIdentityUser>({
      defaultValues: {
        first_name: "",
        last_name: "",
        disabled: false,
        bio_url: "",
        user_type: "student",
        avatar: DEFAULT_AVATAR_URL,
      },
    });

  // Effects
  useEffect(() => {
    if (show) {
      loadUser();
    }

    // Reset editing states when modal is closed
    if (!show) {
      setEditingFirstName(false);
      setEditingLastName(false);
      setEditingUserType(false);
      setEditingVerifyStatus(false);
      reset();
    }
  }, [show, userId]);

  // Handlers & Methods
  async function loadUser() {
    try {
      if (!userId) return;
      setLoading(true);

      const res = await axios.get(`/central-identity/users/${userId}`);
      if (res.data.err) {
        handleGlobalError(res.data.errMsg);
        return;
      }

      setUserInitVal(res.data.user);
      reset(res.data.user);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    reset();
    onClose();
  }

  function handleResetDataItem(key: keyof CentralIdentityUser) {
    if (isCentralIdentityUserProperty(key) && userInitVal) {
      reset({ [key]: userInitVal[key] });
    }
  }

  function handleResetAvatar() {
    setValue("avatar", DEFAULT_AVATAR_URL.toString(), { shouldDirty: true });
  }

  async function handleSave() {
    try {
      if (!userInitVal) return;
      setLoading(true);

      const data = dirtyValues<CentralIdentityUser>(
        formState.dirtyFields,
        getValues()
      );
      const res = await axios.patch(
        `/central-identity/users/${userInitVal.uuid}`,
        data
      );

      if (res.data.err) {
        handleGlobalError(res.data.errMsg);
        return;
      }

      onSave();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={show} onClose={onClose} {...rest} size="fullscreen">
      <Modal.Header>Manage User</Modal.Header>
      <Modal.Content scrolling id="task-view-content">
        {loading && (
          <div className="my-4r">
            <LoadingSpinner />
          </div>
        )}
        {!loading && (
          <div className="flex-col-div">
            <div className="flex-row-div mt-1r mb-05r mx-1r">
              <div className="user-header-div">
                <Header sub>Avatar</Header>
                <div className="flex-row-div">
                  <Image
                    avatar
                    src={getValues("avatar") ?? DEFAULT_AVATAR_URL}
                  />
                  <div className="ml-1p pt-1p">
                    <Popup
                      content="Reset to default avatar"
                      trigger={
                        <Icon
                          name="ban"
                          className="cursor-pointer"
                          onClick={handleResetAvatar}
                        />
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="user-header-div">
                <Header sub>First Name</Header>
                <div className="user-header-textdiv">
                  {editingFirstName && (
                    <div className="mt-2p flex-row-div">
                      <CtlTextInput
                        name="first_name"
                        control={control}
                        rules={{ required: true }}
                      />
                      <Icon
                        name="close"
                        className="mt-3p ml-2p curser-pointer"
                        onClick={() => {
                          handleResetDataItem("first_name");
                          setEditingFirstName(false);
                        }}
                      />
                    </div>
                  )}
                  {!editingFirstName && (
                    <p>
                      {getValues("first_name")}{" "}
                      <Icon
                        name="edit"
                        size="small"
                        className="pb-1p pl-2p"
                        onClick={() => setEditingFirstName(true)}
                      />
                    </p>
                  )}
                </div>
              </div>
              <div className="user-header-div">
                <Header sub>Last Name</Header>
                <div className="user-header-textdiv">
                  {editingLastName && (
                    <div className="mt-2p flex-row-div">
                      <CtlTextInput
                        name="last_name"
                        control={control}
                        rules={{ required: true }}
                      />
                    </div>
                  )}
                  {!editingLastName && (
                    <p>
                      {getValues("last_name")}{" "}
                      <Icon
                        name="edit"
                        size="small"
                        className="pb-1p pl-2p"
                        onClick={() => setEditingLastName(true)}
                      />
                    </p>
                  )}
                </div>
              </div>
              <div className="user-header-div">
                <Header sub>Email</Header>
                <p className="mt-1p">{getValues("email")}</p>
              </div>
              <div className="user-header-div">
                <Header sub>Account Status</Header>
                <div className="flex-row-div mt-2p">
                  <CtlCheckbox
                    name="disabled"
                    control={control}
                    toggle
                    negated
                  />
                  <p className="ml-1r">
                    {getValues("disabled") ? (
                      <strong>Disabled</strong>
                    ) : (
                      "Active"
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="user-details-wrapper px-1r pt-1r">
              <div className="user-details-left">
                <div className="mb-4p">
                  <div className="dividing-header-custom">
                    <h3>Permissions</h3>
                  </div>
                  <div className="flex-col-div">
                    <div className="flex-row-div flex-row-verticalcenter my-auto mt-2p mb-2p">
                      <span>
                        <strong>User Type: </strong>
                      </span>
                      {editingUserType ? (
                        <div className="ml-1p">
                          <Dropdown
                            placeholder="User Type"
                            floating
                            selection
                            button
                            options={userTypeOptions}
                            onChange={(e, { data }) => {
                              setValue("user_type", data, {
                                shouldDirty: true,
                              });
                            }}
                            value={getValues("user_type")}
                          />
                          <Icon
                            name="close"
                            onClick={() => {
                              setEditingUserType(false);
                              handleResetDataItem("user_type");
                            }}
                          />
                        </div>
                      ) : (
                        <>
                          <span className="ml-05p">
                            {getPrettyUserType(getValues("user_type"))}
                          </span>
                          <Icon
                            name="edit"
                            size="small"
                            className="ml-05p"
                            onClick={() => setEditingUserType(true)}
                          />
                        </>
                      )}
                    </div>
                    <div className="flex-row-div flex-row-verticalcenter mb-2p">
                      <span>
                        <strong>Verification Status: </strong>
                      </span>
                      {editingVerifyStatus ? (
                        <div className="ml-1p">
                          <Dropdown
                            placeholder="Verification Status"
                            floating
                            selection
                            button
                            options={verificationStatusOptions}
                            onChange={(e, { data }) => {
                              setValue("verify_status", data, {
                                shouldDirty: true,
                              });
                            }}
                            value={getValues("verify_status")}
                          />
                          <Icon
                            name="close"
                            onClick={() => {
                              setEditingVerifyStatus(false);
                              handleResetDataItem("verify_status");
                            }}
                          />
                        </div>
                      ) : (
                        <>
                          <span className="ml-05p">
                            {getPrettyVerficationStatus(
                              getValues("verify_status")
                            )}
                          </span>
                          <Icon
                            name="edit"
                            size="small"
                            className="ml-05p"
                            onClick={() => setEditingVerifyStatus(true)}
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-1p mb-2p">
                  <div className="dividing-header-custom">
                    <h3>Authentication & Security Data</h3>
                  </div>
                  <div className="flex-col-div">
                    <div className="flex-row-div mt-1p mb-2p">
                      <p>
                        <strong>UUID: </strong>
                        {getValues("uuid")}
                        <Icon
                          name="copy"
                          color="blue"
                          className="pl-2p"
                          style={{ cursor: "pointer" }}
                          onClick={async () => {
                            await copyToClipboard(
                              getValues("uuid") ?? "Unknown"
                            );
                          }}
                        />
                      </p>
                    </div>
                    <div className="flex-row-div mb-2p">
                      <p>
                        <strong>Authentication Source: </strong>
                        {getValues("external_idp")
                          ? getPrettyAuthSource(getValues("external_idp") ?? "")
                          : "LibreOne (Local)"}
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
                        {getValues("last_password_change") ?? "Never"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="user-details-right">
                <div className="flex-col-div justify-center min-h-auto">
                  <Table
                    striped
                    celled
                    size="small"
                    compact
                    className="mx-auto"
                  >
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
                      {getValues("organizations") &&
                        getValues("organizations").length > 0 &&
                        getValues("organizations").map((org) => {
                          return (
                            <Table.Row key={org.id} className="word-break-all">
                              <Table.Cell>
                                <span>{org.name}</span>
                              </Table.Cell>
                              <Table.Cell>
                                <span>
                                  {" "}
                                  {org.system ? org.system.name : ""}
                                </span>
                              </Table.Cell>
                            </Table.Row>
                          );
                        })}
                      {getValues("organizations") &&
                        getValues("organizations").length === 0 && (
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
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={handleCancel}>Cancel</Button>
        {formState.isDirty && (
          <Button color="green" onClick={handleSave} loading={loading}>
            <Icon name="save" />
            Save Changes
          </Button>
        )}
      </Modal.Actions>
    </Modal>
  );
};

export default ManageUserModal;