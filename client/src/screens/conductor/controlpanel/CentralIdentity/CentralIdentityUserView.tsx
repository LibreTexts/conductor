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
import { CentralIdentityUser, CentralIdentityApp } from "../../../../types";
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
import { dirtyValues } from "../../../../utils/misc";
import { useNotifications } from "../../../../context/NotificationContext";
import CtlTextInput from "../../../../components/ControlledInputs/CtlTextInput";
import CtlCheckbox from "../../../../components/ControlledInputs/CtlCheckbox";
import CopyButton from "../../../../components/util/CopyButton";
import { format, parseISO } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";
const AddUserAppModal = lazy(() => import("../../../../components/controlpanel/CentralIdentity/AddUserAppModal"));
const AddUserOrgModal = lazy(() => import("../../../../components/controlpanel/CentralIdentity/AddUserOrgModal"));
const ConfirmRemoveOrgOrAppModal = lazy(() => import("../../../../components/controlpanel/CentralIdentity/ConfirmRemoveOrgOrAppModal"));
const ViewUserProjectsModal = lazy(() => import("../../../../components/controlpanel/CentralIdentity/ViewUserProjectsModal"));
const InternalNotesSection = lazy(() => import("../../../../components/Notes/InternalNotesSection"));
import api from "../../../../api";

const CentralIdentityUserView = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const DEFAULT_AVATAR_URL = "https://cdn.libretexts.net/DefaultImages/avatar.png";

  const [editingFirstName, setEditingFirstName] = useState<boolean>(false);
  const [editingLastName, setEditingLastName] = useState<boolean>(false);
  const [editingUserType, setEditingUserType] = useState<boolean>(false);
  const [editingStudentId, setEditingStudentId] = useState<boolean>(false);
  const [editingBioURL, setEditingBioURL] = useState<boolean>(false);
  const [editingVerifyStatus, setEditingVerifyStatus] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [showAddAppModal, setShowAddAppModal] = useState<boolean>(false);
  const [showAddOrgModal, setShowAddOrgModal] = useState<boolean>(false);
  const [userApps, setUserApps] = useState<CentralIdentityApp[]>([]);
  const [showRemoveOrgOrAppModal, setShowRemoveOrgOrAppModal] = useState<boolean>(false);
  const [removeOrgOrAppType, setRemoveOrgOrAppType] = useState<"org" | "app">("org");
  const [removeOrgOrAppTargetId, setRemoveOrgOrAppTargetId] = useState<string>("");
  const [userInitVal, setUserInitVal] = useState<CentralIdentityUser | undefined>(undefined);
  const [showViewUserProjectsModal, setShowViewUserProjectsModal] = useState<boolean>(false);

  const { handleGlobalError } = useGlobalError();
  const { addNotification } = useNotifications();
  const { control, formState, reset, watch, getValues, setValue } = useForm<CentralIdentityUser>({
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
  const [copied, setCopied] = useState(false);

  const handleCopyUUID = () => {
    const uuid = typeof getValues("uuid") === "string" ? getValues("uuid") : "unknown";
    navigator.clipboard.writeText(uuid)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500); 
      });
  };

  useEffect(() => {
    if (uuid) {
      loadUser();
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

  function handleResetDataItem(key: keyof CentralIdentityUser) {
    if (isCentralIdentityUserProperty(key) && userInitVal) {
      setValue(key, userInitVal[key], { shouldDirty: false });
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

  function handleViewUserProjectsModalClose() {
    setShowViewUserProjectsModal(false);
  }

  async function handleSave() {
    try {
      if (!userInitVal) return;
      setLoading(true);

      const data = dirtyValues<CentralIdentityUser>(formState.dirtyFields, getValues());
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

  return (
    <div style={{ padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>
      <div className="controlpanel-container" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Header as="h1" dividing>
          Manage User
        </Header>
    
        {loading ? (
          <LoadingSpinner />
        ) : (
          <Grid stackable columns={2} divided>
            <Grid.Row>
              <Grid.Column width={8}>
                <Segment>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
                    <Header as="h3" style={{ margin: 0 }}>User Details</Header>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      
                      <CtlCheckbox
                        name="disabled"
                        control={control}
                        toggle
                        negated
                      />
                      <span>
                        {getValues("disabled") ? <strong>Disabled</strong> : <strong>Active</strong>}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
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
                  </div>
                  <div style={{ marginBottom: "1.25rem", width: "100%" }}>
                    <Header sub>Email</Header>
                    <span style={{ width: "100%", display: "block", fontSize: "1.1em", wordBreak: "break-all" }}>
                      {getValues("email")}
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
                                    
                  <div style={{
                    marginTop: "2rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <Button onClick={loadUser}>Cancel</Button>
                    {formState.isDirty && (
                      <Button color="green" onClick={handleSave} loading={loading}>
                        <Icon name="save" />
                        Save
                      </Button>
                    )}
                  </div>
                </Segment>
                <Segment>
                <Header as="h3" dividing>Authentication & Security Data</Header>
                <div style={{ marginBottom: "1.25rem", width: "100%" }}>
                  <Header sub>UUID</Header>
                  <span style={{ fontFamily: "monospace" }}>
                    {getValues("uuid")}
                    <Icon
                      name="copy"
                      color={copied ? "green" : "blue"}
                      style={{ cursor: "pointer", marginLeft: "0.5rem" }}
                      onClick={handleCopyUUID}
                    />
                    {copied && <span style={{ color: "green", marginLeft: 8 }}>Copied!</span>}
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
                
              </Grid.Column>
    
              <Grid.Column width={8}>
                <Segment>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                      <Header as="h3" style={{ margin: 0 }}>Organizations</Header>
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
                                <span>
                                    {org.system ? org.system.name : ""}
                                </span>
                              </Table.Cell>
                              <Table.Cell>
                                <Button
                                  icon
                                  color="red"
                                  size="tiny"
                                  onClick={() =>
                                    handleOpenRemoveOrgOrAppModal("org", org.id.toString())
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                      <Header as="h3" style={{ margin: 0 }}>Applications</Header>
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
                                    handleOpenRemoveOrgOrAppModal("app", app.id.toString())
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
                <Segment>
                  <InternalNotesSection userId={uuid} />
                </Segment>
              </Grid.Column>
            </Grid.Row>
          </Grid>
        )}
        <AddUserAppModal
          show={showAddAppModal}
          userId={uuid}
          currentApps={userApps.map((app) => app.id.toString())}
          onClose={handleAddAppModalClose}
        />
        <AddUserOrgModal
          show={showAddOrgModal}
          userId={uuid}
          currentOrgs={getValues("organizations")?.map((org) => org.id.toString())}
          onClose={handleAddOrgModalClose}
        />
        <ConfirmRemoveOrgOrAppModal
          show={showRemoveOrgOrAppModal}
          type={removeOrgOrAppType}
          userId={uuid}
          targetId={removeOrgOrAppTargetId}
          onClose={handleRemoveOrgOrAppModalClose}
        />
        <ViewUserProjectsModal
          show={showViewUserProjectsModal}
          userId={uuid}
          onClose={handleViewUserProjectsModalClose}
        />
      </div>
    </div>
  );
};

export default CentralIdentityUserView;