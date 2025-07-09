import { useState, useEffect, lazy } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Header,
  Segment,
  Grid,
  Breadcrumb,
  Table,
  Icon,
  Button,
  Dropdown,
  Image,
  Popup,
} from "semantic-ui-react";
import {
  CentralIdentityUser,
  CentralIdentityApp,
  SupportTicket,
} from "../../../../types";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { useForm, Controller } from "react-hook-form";
import axios from "axios";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import {
  getPrettyAuthSource,
  getPrettyUserType,
  getPrettyVerficationStatus,
  userTypeOptions,
  verificationStatusOptions,
} from "../../../../utils/centralIdentityHelpers";
import { isCentralIdentityUserProperty } from "../../../../utils/typeHelpers";
import HandleUserDisableModal from "../../../../components/controlpanel/CentralIdentity/HandleUserDisableModal";
import { dirtyValues } from "../../../../utils/misc";
import { useNotifications } from "../../../../context/NotificationContext";
import CtlTextInput from "../../../../components/ControlledInputs/CtlTextInput";
import CtlCheckbox from "../../../../components/ControlledInputs/CtlCheckbox";
import CopyButton from "../../../../components/util/CopyButton";
import { format, parseISO } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";
const AddUserAppModal = lazy(
  () =>
    import(
      "../../../../components/controlpanel/CentralIdentity/AddUserAppModal"
    )
);
const AddUserOrgModal = lazy(
  () =>
    import(
      "../../../../components/controlpanel/CentralIdentity/AddUserOrgModal"
    )
);
const ConfirmRemoveOrgOrAppModal = lazy(
  () =>
    import(
      "../../../../components/controlpanel/CentralIdentity/ConfirmRemoveOrgOrAppModal"
    )
);
const InternalNotesSection = lazy(
  () => import("../../../../components/Notes/InternalNotesSection")
);
const UserSupportTickets = lazy(
  () =>
    import(
      "../../../../components/controlpanel/CentralIdentity/UserSupportTickets"
    )
);

import api from "../../../../api";
import UserConductorData from "../../../../components/controlpanel/CentralIdentity/UserConductorData";

const CentralIdentityUserView = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const DEFAULT_AVATAR_URL =
    "https://cdn.libretexts.net/DefaultImages/avatar.png";

  const [loading, setLoading] = useState<boolean>(false);
  const [showAddAppModal, setShowAddAppModal] = useState<boolean>(false);
  const [showDisableUserModal, setShowDisableUserModal] = useState<boolean>(false);
  const [showAddOrgModal, setShowAddOrgModal] = useState<boolean>(false);
  const [userApps, setUserApps] = useState<CentralIdentityApp[]>([]);
  const [showRemoveOrgOrAppModal, setShowRemoveOrgOrAppModal] =
    useState<boolean>(false);
  const [removeOrgOrAppType, setRemoveOrgOrAppType] = useState<"org" | "app">(
    "org"
  );
  const [removeOrgOrAppTargetId, setRemoveOrgOrAppTargetId] =
    useState<string>("");
  const [userInitVal, setUserInitVal] = useState<
    CentralIdentityUser | undefined
  >(undefined);
  const [userLocalID, setUserLocalID] = useState<string>("");

  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();
  const { control, formState, reset, watch, getValues, setValue } =
    useForm<CentralIdentityUser>({
      defaultValues: {
        first_name: "",
        last_name: "",
        disabled: false,
        bio_url: "",
        user_type: "student",
        student_id: "",
        avatar: DEFAULT_AVATAR_URL,
        last_access: "",
        last_password_change: "",
      },
    });

  useEffect(() => {
    if (uuid) {
      loadUser();
      loadUserLocalID();
      loadUserApps();
    }
  }, [uuid]);

  async function loadUser() {
    try {
      if (!uuid) return;
      setLoading(true);

      const res = await api.getCentralIdentityUser(uuid);
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

  async function loadUserLocalID() {
    try {
      if (!uuid) return;
      setLoading(true);

      const res = await api.getUserFromCentralID(uuid);
      if (res.err) {
        handleGlobalError(res.errMsg || "An error occurred");
        return;
      }

      setUserLocalID(res.uuid);
    } catch (err) {
      handleGlobalError(
        "User does not have a local Conductor record. This may or may not be expected."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadUserApps() {
    try {
      if (!uuid) return;
      setLoading(true);

      const res = await api.getCentralIdentityUserApplications(uuid);
      if (res.data.err) {
        handleGlobalError(res.data.errMsg || "An error occurred");
        return;
      }

      setUserApps([...(res.data.applications as CentralIdentityApp[])]);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleResetAvatar() {
    setValue("avatar", DEFAULT_AVATAR_URL.toString(), { shouldDirty: true });
  }

  function handleAddAppModalClose() {
    setShowAddAppModal(false);
    loadUserApps();
  }

  function handleAddOrgModalClose() {
    setShowAddOrgModal(false);
    loadUser();
  }

  function handleOpenRemoveOrgOrAppModal(type: "org" | "app", id: string) {
    setRemoveOrgOrAppType(type);
    setRemoveOrgOrAppTargetId(id);
    setShowRemoveOrgOrAppModal(true);
  }

  function handleRemoveOrgOrAppModalClose() {
    setShowRemoveOrgOrAppModal(false);
    if (removeOrgOrAppType === "org") {
      loadUser();
      return;
    }
    loadUserApps();
  }

  function handleOpenDisableUserModal() {
    setShowDisableUserModal(true);
  }

  function handleCloseDisableUserModal() {
    setShowDisableUserModal(false);
    loadUser();
  }

  async function handleSave() {
    try {
      if (!userInitVal) return;
      setLoading(true);

      const data = dirtyValues<CentralIdentityUser>(
        formState.dirtyFields,
        getValues()
      );
      const res = await api.updateCentralIdentityUser(userInitVal.uuid, data);

      if (res.data.err) {
        handleGlobalError(res.data.errMsg);
        return;
      }

      addNotification({
        message: "User updated successfully!",
        type: "success",
      });
      loadUser();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleReEnableUser() {
    try {
      if (!uuid) return;
      setLoading(true);
      const res = await api.reEnableCentralIdentityUser(uuid);
      
      if (res.data?.err) {
        handleGlobalError(res.data.errMsg || res.data.err);
        return;
      }
      loadUser();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Grid stackable className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header" as="h2">
            Manage User
          </Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column>
          <Segment className="flex flex-row items-center justify-between">
            <Breadcrumb>
              <Breadcrumb.Section as={Link} to="/controlpanel">
                Control Panel
              </Breadcrumb.Section>
              <Breadcrumb.Divider icon="right chevron" />
              <Breadcrumb.Section as={Link} to="/controlpanel/libreone">
                LibreOne Admin Consoles
              </Breadcrumb.Section>
              <Breadcrumb.Divider icon="right chevron" />
              <Breadcrumb.Section as={Link} to="/controlpanel/libreone/users">
                Users
              </Breadcrumb.Section>
              <Breadcrumb.Divider icon="right chevron" />
              <Breadcrumb.Section active>
                {getValues("first_name") ?? ""} {getValues("last_name") ?? ""}
              </Breadcrumb.Section>
            </Breadcrumb>
            {/* Disabled control for now */}
            {/* <div className="flex items-center gap-2">
              <CtlCheckbox name="disabled" control={control} toggle negated />
              <span>
                {getValues("disabled") ? (
                  <strong>Disabled</strong>
                ) : (
                  <strong>Active</strong>
                )}
              </span>
            </div> */}
          </Segment>
          <div className="flex flex-row justify-between pb-4">
            <div className="flex flex-col basis-1/2">
              <Segment>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: "1.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1.5rem",
                    }}
                  >
                    <Image
                      avatar
                      size="small"
                      src={getValues("avatar") ?? DEFAULT_AVATAR_URL}
                    />
                    <Popup
                      content="Reset to default avatar"
                      trigger={
                        <Button
                          icon="ban"
                          circular
                          size="tiny"
                          onClick={handleResetAvatar}
                        />
                      }
                    />
                  </div>
                  {getValues("disabled") ? (
                    <Button
                      icon
                      color="yellow"
                      size="tiny"
                      onClick={handleReEnableUser}
                    >
                      <Icon name="refresh" /> Re-Enable User
                    </Button>
                  ):  
                    <Button
                      icon
                      color="red"
                      size="tiny"
                      onClick={handleOpenDisableUserModal}
                    >
                      <Icon name="ban" /> Disable User
                    </Button>
                  }
                </div>
                <div style={{ marginBottom: "1.25rem", width: "100%" }}>
                  <Header sub>Email</Header>
                  <span
                    style={{
                      width: "100%",
                      display: "block",
                      fontSize: "1.1em",
                      wordBreak: "break-all",
                    }}
                  >
                    {getValues("email")}
                    <CopyButton val={getValues("email") ?? ""}>
                      {({ copied, copy }) => (
                        <Icon
                          name="copy"
                          className="cursor-pointer !ml-1"
                          onClick={() => {
                            copy();
                            addNotification({
                              message: "Copied to clipboard!",
                              type: "success",
                              duration: 2000,
                            });
                          }}
                          color={copied ? "green" : "blue"}
                        />
                      )}
                    </CopyButton>
                  </span>
                </div>
                <div style={{ marginBottom: "1.25rem", width: "100%" }}>
                  <Header sub>First Name</Header>
                  <CtlTextInput
                    name="first_name"
                    control={control}
                    rules={{ required: true }}
                    fluid
                    style={{ width: "100%" }}
                  />
                </div>
                <div style={{ marginBottom: "1.25rem", width: "100%" }}>
                  <Header sub>Last Name</Header>
                  <CtlTextInput
                    name="last_name"
                    control={control}
                    rules={{ required: true }}
                    fluid
                    style={{ width: "100%" }}
                  />
                </div>
                <div style={{ marginBottom: "1.25rem", width: "100%" }}>
                  <Header sub>User Type</Header>
                  <Controller
                    name="user_type"
                    control={control}
                    render={({ field }) => (
                      <Dropdown
                        options={userTypeOptions}
                        {...field}
                        onChange={(e, data) => {
                          field.onChange(data.value?.toString() ?? "student");
                        }}
                        selection
                        fluid
                      />
                    )}
                  />
                </div>
                {getValues("user_type") === "student" && (
                  <div style={{ marginBottom: "1.25rem", width: "100%" }}>
                    <Header sub>Student ID</Header>
                    <CtlTextInput
                      name="student_id"
                      control={control}
                      fluid
                      style={{ width: "100%" }}
                    />
                  </div>
                )}
                {getValues("user_type") === "instructor" && (
                  <div style={{ marginBottom: "1.25rem", width: "100%" }}>
                    <Header sub>Verification Status</Header>
                    <Controller
                      name="verify_status"
                      control={control}
                      render={({ field }) => (
                        <Dropdown
                          options={verificationStatusOptions}
                          {...field}
                          onChange={(e, data) => {
                            field.onChange(data.value?.toString() ?? "pending");
                          }}
                          selection
                          fluid
                        />
                      )}
                    />
                  </div>
                )}
                {getValues("user_type") === "instructor" && (
                  <div style={{ marginBottom: "1.25rem", width: "100%" }}>
                    <Header sub>Bio URL</Header>
                    <CtlTextInput
                      name="bio_url"
                      control={control}
                      placeholder="Bio URL..."
                      fluid
                      style={{ width: "100%" }}
                    />
                  </div>
                )}

                <div
                  style={{
                    marginTop: "2rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Button onClick={loadUser}>Cancel</Button>
                  {formState.isDirty && (
                    <Button
                      color="green"
                      onClick={handleSave}
                      loading={loading}
                    >
                      <Icon name="save" />
                      Save
                    </Button>
                  )}
                </div>
              </Segment>
              <Segment>
                <Header as="h3" dividing>
                  Authentication & Security Data
                </Header>
                <div style={{ marginBottom: "1.25rem", width: "100%" }}>
                  <Header sub>UUID</Header>
                  <span style={{ fontFamily: "monospace" }}>
                    {getValues("uuid")}
                    <CopyButton val={getValues("uuid") ?? ""}>
                      {({ copied, copy }) => (
                        <Icon
                          name="copy"
                          className="cursor-pointer !ml-1"
                          onClick={() => {
                            copy();
                            addNotification({
                              message: "Copied to clipboard!",
                              type: "success",
                              duration: 2000,
                            });
                          }}
                          color={copied ? "green" : "blue"}
                        />
                      )}
                    </CopyButton>
                  </span>
                </div>
                <div style={{ marginBottom: "1.25rem", width: "100%" }}>
                  <Header sub>Authentication Source</Header>
                  <span>
                    {getValues("external_idp")
                      ? getPrettyAuthSource(getValues("external_idp") ?? "")
                      : "LibreOne (Local)"}
                  </span>
                </div>
                <div style={{ marginBottom: "1.25rem", width: "100%" }}>
                  <Header sub>Time of Account Creation</Header>
                  <span>
                    {getValues("created_at")
                      ? format(
                          utcToZonedTime(
                            parseISO(getValues("created_at") as string),
                            getValues("time_zone") as string
                          ),
                          "MM/dd/yyyy hh:mm aa"
                        )
                      : ""}
                  </span>
                </div>
                <div style={{ marginBottom: "1.25rem", width: "100%" }}>
                  <Header sub>Time of Last Access</Header>
                  <span>
                    {getValues("last_access")
                      ? format(
                          parseISO(getValues("last_access") as string),
                          "MM/dd/yyyy hh:mm aa"
                        )
                      : "Unknown"}
                  </span>
                </div>
                <div style={{ marginBottom: "1.25rem", width: "100%" }}>
                  <Header sub>Time of Last Password Change</Header>
                  <span>
                    {getValues("last_password_change")
                      ? format(
                          parseISO(getValues("last_password_change") as string),
                          "MM/dd/yyyy hh:mm aa"
                        )
                      : "Unknown"}
                  </span>
                </div>
              </Segment>
              {userLocalID && <UserConductorData uuid={userLocalID} />}
            </div>
            <div className="flex flex-col basis-1/2 ml-8">
              <Segment>
                <div className="flex justify-between items-center mb-4 border-b border-slate-300 pb-2">
                  <Header as="h3" style={{ margin: 0 }}>
                    Organizations
                  </Header>
                  <Button
                    icon
                    color="blue"
                    size="tiny"
                    onClick={() => setShowAddOrgModal(true)}
                  >
                    <Icon name="plus" />
                  </Button>
                </div>
                <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                  <Table compact celled>
                    <Table.Header>
                      <Table.Row>
                        <Table.HeaderCell>Name</Table.HeaderCell>
                        <Table.HeaderCell>System Name</Table.HeaderCell>
                        <Table.HeaderCell>Actions</Table.HeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {getValues("organizations") &&
                      getValues("organizations")?.length > 0 ? (
                        getValues("organizations").map((org) => (
                          <Table.Row key={org.id}>
                            <Table.Cell>{org.name}</Table.Cell>
                            <Table.Cell>
                              <span>{org.system ? org.system.name : ""}</span>
                            </Table.Cell>
                            <Table.Cell>
                              <Button
                                icon
                                color="red"
                                size="tiny"
                                onClick={() =>
                                  handleOpenRemoveOrgOrAppModal(
                                    "org",
                                    org.id.toString()
                                  )
                                }
                              >
                                <Icon name="trash" />
                              </Button>
                            </Table.Cell>
                          </Table.Row>
                        ))
                      ) : (
                        <Table.Row>
                          <Table.Cell colSpan={3} textAlign="center">
                            <em>No organizations found.</em>
                          </Table.Cell>
                        </Table.Row>
                      )}
                    </Table.Body>
                  </Table>
                </div>
              </Segment>

              <Segment>
                <div className="flex justify-between items-center mb-4 border-b border-slate-300 pb-2">
                  <Header as="h3" style={{ margin: 0 }}>
                    Applications
                  </Header>
                  <Button
                    icon
                    color="blue"
                    size="tiny"
                    onClick={() => setShowAddAppModal(true)}
                  >
                    <Icon name="plus" />
                  </Button>
                </div>
                <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                  <Table compact celled>
                    <Table.Header>
                      <Table.Row>
                        <Table.HeaderCell>Name</Table.HeaderCell>
                        <Table.HeaderCell>Actions</Table.HeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {userApps.length > 0 ? (
                        userApps.map((app) => (
                          <Table.Row key={app.id}>
                            <Table.Cell>{app.name}</Table.Cell>
                            <Table.Cell>
                              <Button
                                icon
                                color="red"
                                size="tiny"
                                onClick={() =>
                                  handleOpenRemoveOrgOrAppModal(
                                    "app",
                                    app.id.toString()
                                  )
                                }
                              >
                                <Icon name="trash" />
                              </Button>
                            </Table.Cell>
                          </Table.Row>
                        ))
                      ) : (
                        <Table.Row>
                          <Table.Cell colSpan={2} textAlign="center">
                            <em>No applications found.</em>
                          </Table.Cell>
                        </Table.Row>
                      )}
                    </Table.Body>
                  </Table>
                </div>
              </Segment>
              {userLocalID && <UserSupportTickets uuid={userLocalID} />}
              <Segment>
                <InternalNotesSection userId={uuid} />
              </Segment>
            </div>
          </div>
        </Grid.Column>
      </Grid.Row>

      <AddUserAppModal
        show={showAddAppModal}
        userId={uuid}
        currentApps={userApps.map((app) => app.id.toString())}
        onClose={handleAddAppModalClose}
      />
      <AddUserOrgModal
        show={showAddOrgModal}
        userId={uuid}
        currentOrgs={getValues("organizations")?.map((org) =>
          org.id.toString()
        )}
        onClose={handleAddOrgModalClose}
      />
      <ConfirmRemoveOrgOrAppModal
        show={showRemoveOrgOrAppModal}
        type={removeOrgOrAppType}
        userId={uuid}
        targetId={removeOrgOrAppTargetId}
        onClose={handleRemoveOrgOrAppModalClose}
      />
      <HandleUserDisableModal
        show={showDisableUserModal}
        userId={uuid}
        onClose={handleCloseDisableUserModal}
      />
    </Grid>
  );
};

export default CentralIdentityUserView;
