import { useState } from "react";
import axios from "axios";
import {
  Modal,
  Form,
  Divider,
  Button,
  Icon,
  ModalProps,
  Loader,
  List,
  Image,
  Dropdown,
  Popup,
} from "semantic-ui-react";
import { CentralIdentityOrg, Project, User } from "../../types";
import {
  isEmptyString,
  sortUsersByName,
  truncateString,
} from "../util/HelperFunctions";
import { projectRoleOptions } from "../util/ProjectHelpers";
import useGlobalError from "../error/ErrorHooks";
import useDebounce from "../../hooks/useDebounce";

type ProjectDisplayMember = User & { roleValue: string; roleDisplay: string };
type TeamUserOpt = {
  key: string;
  text: string;
  value: string;
  image?: { avatar?: boolean; src?: string };
};

interface ManageTeamModalProps extends ModalProps {
  show: boolean;
  project: Project;
  onDataChanged: () => void;
  onClose: () => void;
}

const ManageTeamModal: React.FC<ManageTeamModalProps> = ({
  show,
  project,
  onDataChanged,
  onClose,
}) => {
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();
  const [loading, setLoading] = useState<boolean>(false);
  const [teamUserOptions, setTeamUserOptions] = useState<TeamUserOpt[]>([]);
  const [teamUserOptsLoading, setTeamUserOptsLoading] =
    useState<boolean>(false);
  const [teamUserUUIDToAdd, setTeamUserUUIDToAdd] = useState<string | null>(
    null
  );

  /**
   * Resets state before calling the provided onClose function.
   */
  const handleClose = () => {
    setLoading(false);
    setTeamUserOptions([]);
    setTeamUserOptsLoading(false);
    setTeamUserUUIDToAdd(null);

    if (onClose) {
      onClose();
    }
  };

  /**
   * Retrieves a list of users that can be added as team members to the
   * project, then processes and sets them in state.
   */
  const getTeamUserOptions = async (searchString: string) => {
    try {
      if (!project.projectID) return;

      setTeamUserOptsLoading(true);
      const res = await axios.get(
        `/project/${project.projectID}/team/addable?search=${searchString}`
      );
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.users || !Array.isArray(res.data.users)) {
        throw new Error(
          "Invalid response from server. This may be caused by an internal error."
        );
      }

      const newOptions: TeamUserOpt[] = [];
      res.data.users.forEach((item: User & { orgs?: CentralIdentityOrg[] }) => {
        newOptions.push({
          key: item.uuid,
          text: `${item.firstName} ${item.lastName} ${
            item.orgs && item.orgs[0] && item.orgs[0].name
              ? `(${truncateString(item.orgs[0].name, 50)})`
              : ""
          }`,
          value: item.uuid,
          image: {
            avatar: true,
            src: item.avatar,
          },
        });
      });

      setTeamUserOptions(newOptions);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setTeamUserOptsLoading(false);
    }
  };

  const getTeamUserOptionsDebounced = debounce(
    (inputVal: string) => getTeamUserOptions(inputVal),
    200
  );

  /**
   * Submits a PUT request to the server to update the team member's
   * role in the project, then refreshes the project data.
   * @param {String} memberUUID - the UUID of the team member to update
   * @param {String} newRole - the new role setting
   */
  const submitChangeTeamMemberRole = async (
    memberUUID: string,
    newRole: string
  ) => {
    try {
      if (
        isEmptyString(memberUUID) ||
        isEmptyString(newRole) ||
        isEmptyString(project.projectID)
      ) {
        throw new Error(
          "Invalid user UUID or role. This may be caused by an internal error."
        );
      }

      setLoading(true);
      const res = await axios.put(
        `/project/${project.projectID}/team/${memberUUID}/role`,
        {
          newRole: newRole,
        }
      );
      if (res.data.err) {
        handleGlobalError(res.data.errMsg);
        return;
      }

      setTeamUserOptions([]);
      onDataChanged();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Submits a PUT request to the server to remove the specified user
   * from the project's team, then refreshes the
   * project data and Addable Users options.
   * @param  {String} memberUUID  - the uuid of the user to remove
   */
  const submitRemoveTeamMember = async (memberUUID: string) => {
    try {
      if (isEmptyString(memberUUID) || isEmptyString(project.projectID)) {
        throw new Error(
          "Invalid user or project UUID. This may be caused by an internal error."
        );
      }

      setLoading(true);
      const res = await axios.delete(
        `/project/${project.projectID}/team/${memberUUID}`
      );
      if (res.data.err) {
        handleGlobalError(res.data.errMsg);
        return;
      }

      setTeamUserOptions([]);
      onDataChanged();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Submits a PUT request to the server to add the user
   * in state (teamUserToAdd) to the project's team, then
   * refreshes the project data and Addable Users options.
   */
  const submitAddTeamMember = async () => {
    try {
      if (
        !teamUserUUIDToAdd ||
        isEmptyString(teamUserUUIDToAdd) ||
        isEmptyString(project.projectID)
      ) {
        throw new Error(
          "Invalid user or project UUID. This may be caused by an internal error."
        );
      }

      setLoading(true);
      const res = await axios.post(`/project/${project.projectID}/team`, {
        uuid: teamUserUUIDToAdd,
      });

      if (res.data.err) {
        handleGlobalError(res.data.errMsg);
        return;
      }

      setTeamUserOptions([]);
      setTeamUserUUIDToAdd(null);
      onDataChanged();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  };

  const renderTeamModalList = (projData: Project) => {
    if (!projData) return null;
    let projTeam: ProjectDisplayMember[] = [];
    if (projData.leads && Array.isArray(projData.leads)) {
      projData.leads.forEach((item) => {
        projTeam.push({ ...item, roleValue: "lead", roleDisplay: "Lead" });
      });
    }
    if (projData.liaisons && Array.isArray(projData.liaisons)) {
      projData.liaisons.forEach((item) => {
        projTeam.push({
          ...item,
          roleValue: "liaison",
          roleDisplay: "Liaison",
        });
      });
    }
    if (projData.members && Array.isArray(projData.members)) {
      projData.members.forEach((item) => {
        projTeam.push({ ...item, roleValue: "member", roleDisplay: "Member" });
      });
    }
    if (projData.auditors && Array.isArray(projData.auditors)) {
      projData.auditors.forEach((item) => {
        projTeam.push({
          ...item,
          roleValue: "auditor",
          roleDisplay: "Auditor",
        });
      });
    }
    projTeam = sortUsersByName(projTeam) as ProjectDisplayMember[];
    return (
      <List divided verticalAlign="middle" className="mb-4p">
        {projTeam.map((item, idx) => {
          return (
            <List.Item key={`team-${idx}`}>
              <div className="flex-row-div">
                <div className="left-flex">
                  <Image avatar src={item.avatar} />
                  <List.Content className="ml-1p">
                    {item.firstName} {item.lastName}
                  </List.Content>
                </div>
                <div className="right-flex">
                  <Dropdown
                    placeholder="Change role..."
                    selection
                    options={projectRoleOptions}
                    value={item.roleValue}
                    loading={loading}
                    onChange={(_e, { value }) =>
                      submitChangeTeamMemberRole(
                        item.uuid,
                        value ? value.toString() : ""
                      )
                    }
                  />
                  <Popup
                    position="top center"
                    trigger={
                      <Button
                        color="red"
                        className="ml-1p"
                        onClick={() => {
                          submitRemoveTeamMember(item.uuid);
                        }}
                        icon
                      >
                        <Icon name="remove circle" />
                      </Button>
                    }
                    content="Remove from project"
                  />
                </div>
              </div>
            </List.Item>
          );
        })}
      </List>
    );
  };

  return (
    <Modal open={show} onClose={handleClose} size="large" closeIcon>
      <Modal.Header>Manage Project Team</Modal.Header>
      <Modal.Content scrolling id="project-manage-team-content">
        <Form noValidate>
          <Form.Select
            search
            label="Add Team Member"
            placeholder="Start typing to search by name..."
            options={teamUserOptions}
            onChange={(_e, { value }) => {
              if (typeof value === "string") {
                setTeamUserUUIDToAdd(value);
              }
            }}
            onSearchChange={(_e, { searchQuery }) => {
              if (searchQuery) {
                getTeamUserOptionsDebounced(searchQuery);
              }
            }}
            loading={teamUserOptsLoading}
            disabled={teamUserOptsLoading}
          />
          <Button
            fluid
            color="green"
            loading={loading}
            onClick={submitAddTeamMember}
          >
            <Icon name="add user" />
            Add Team Member
          </Button>
        </Form>
        <Divider />
        {!loading ? (
          renderTeamModalList(project)
        ) : (
          <Loader active inline="centered" />
        )}
      </Modal.Content>
    </Modal>
  );
};

export default ManageTeamModal;
