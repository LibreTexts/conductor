import { useEffect, useMemo, useState } from "react";
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
  Table,
  Input,
  TableProps,
  Radio,
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
import { useTypedSelector } from "../../state/hooks";
import { extractEmailDomain } from "../../utils/misc";

type ProjectDisplayMember = User & { roleValue: string; roleDisplay: string };
type AddableUser = Pick<User, "uuid" | "firstName" | "lastName" | "avatar">;

interface ManageTeamModalProps extends ModalProps {
  show: boolean;
  project: Project;
  onDataChanged: () => void;
  onClose: () => void;
}

interface RenderCurrentTeamTableProps extends TableProps {
  project: Project;
}

const ManageTeamModal: React.FC<ManageTeamModalProps> = ({
  show,
  project,
  onDataChanged,
  onClose,
}) => {
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();
  const user = useTypedSelector((state) => state.user);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasNotSearched, setHasNotSearched] = useState<boolean>(true);
  const [searchString, setSearchString] = useState<string>("");
  const [includeOutsideOrg, setIncludeOutsideOrg] = useState<boolean>(false);
  const [teamUserOptions, setTeamUserOptions] = useState<AddableUser[]>([]);
  const [teamUserOptsLoading, setTeamUserOptsLoading] =
    useState<boolean>(false);

  const userOrgDomain = useMemo(() => {
    if (!user?.email) return "";
    return extractEmailDomain(user.email);
  }, [user.email]);

  /**
   * Resets state before calling the provided onClose function.
   */
  const handleClose = () => {
    setLoading(false);
    setTeamUserOptions([]);
    setTeamUserOptsLoading(false);
    setSearchString("");

    if (onClose) {
      onClose();
    }
  };

  /**
   * Retrieves a list of users that can be added as team members to the
   * project, then processes and sets them in state.
   */
  async function getTeamUserOptions(searchString: string) {
    try {
      if (!project.projectID) return;

      setHasNotSearched(false);
      setTeamUserOptsLoading(true);
      const res = await axios.get(
        `/project/${project.projectID}/team/addable?search=${searchString}&includeOutsideOrg=${includeOutsideOrg}&page=1&limit=5`
      );
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.users || !Array.isArray(res.data.users)) {
        throw new Error(
          "Invalid response from server. This may be caused by an internal error."
        );
      }

      setTeamUserOptions(res.data.users);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setTeamUserOptsLoading(false);
    }
  }

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
  const submitAddTeamMember = async (uuid: string) => {
    try {
      if (!project.projectID || !uuid) {
        throw new Error(
          "Invalid user or project UUID. This may be caused by an internal error."
        );
      }

      setLoading(true);
      const res = await axios.post(`/project/${project.projectID}/team`, {
        uuid
      });

      if (res.data.err) {
        handleGlobalError(res.data.errMsg);
        return;
      }

      getTeamUserOptions(searchString); // Refresh addable users list
      onDataChanged();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  };

  const RenderCurrentTeamTable: React.FC<RenderCurrentTeamTableProps> = ({
    project,
    ...rest
  }: {
    project: Project;
  }) => {
    const projTeam: ProjectDisplayMember[] = [];
    if (project.leads && Array.isArray(project.leads)) {
      project.leads.forEach((item) => {
        projTeam.push({ ...item, roleValue: "lead", roleDisplay: "Lead" });
      });
    }
    if (project.liaisons && Array.isArray(project.liaisons)) {
      project.liaisons.forEach((item) => {
        projTeam.push({
          ...item,
          roleValue: "liaison",
          roleDisplay: "Liaison",
        });
      });
    }
    if (project.members && Array.isArray(project.members)) {
      project.members.forEach((item) => {
        projTeam.push({ ...item, roleValue: "member", roleDisplay: "Member" });
      });
    }
    if (project.auditors && Array.isArray(project.auditors)) {
      project.auditors.forEach((item) => {
        projTeam.push({
          ...item,
          roleValue: "auditor",
          roleDisplay: "Auditor",
        });
      });
    }
    const sortedTeam = sortUsersByName(projTeam) as ProjectDisplayMember[];

    return (
      <Table celled striped compact {...rest}>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell width={"7"}>Name</Table.HeaderCell>
            <Table.HeaderCell width={"2"}>Role</Table.HeaderCell>
            <Table.HeaderCell width={"1"}>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {sortedTeam.map((item) => (
            <Table.Row key={item.uuid}>
              <Table.Cell>
                <Image avatar src={item.avatar} />
                {item.firstName} {item.lastName}
              </Table.Cell>
              <Table.Cell>
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
              </Table.Cell>
              <Table.Cell>
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
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    );
  };

  return (
    <Modal open={show} onClose={handleClose} size="large" closeIcon>
      <Modal.Header>Manage Project Team</Modal.Header>
      <Modal.Content
        scrolling
        className="!min-h-[48rem]"
      >
        {!loading ? (
          <>
            <p className="text-xl font-semibold">Current Team Members</p>
            <RenderCurrentTeamTable
              project={project}
              id="current-team-table"
              className="!mt-0.5"
            />
            <Form onSubmit={(e) => e.preventDefault()} className="mt-16 h-72">
              <Form.Field className="flex flex-col">
                <div className="flex flex-row justify-between items-center mb-1">
                  <p className="text-xl font-semibold">Add Team Members</p>
                  <div className="flex flex-row items-center">
                    <label className="" htmlFor="outside-org-radio">
                      Include users outside of{" "}
                      <span className="">{userOrgDomain}</span>
                    </label>
                    <Radio
                      id="outside-org-radio"
                      toggle
                      className="ml-2"
                      checked={includeOutsideOrg}
                      onClick={(e) => setIncludeOutsideOrg(!includeOutsideOrg)}
                    />
                  </div>
                </div>
                <Input
                  icon="search"
                  placeholder="Start typing to search by name or email..."
                  value={searchString}
                  onChange={(e, { value }) => {
                    setSearchString(value);
                    getTeamUserOptionsDebounced(value);
                  }}
                />
              </Form.Field>
              <Table celled compact>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell width={"8"}>Name</Table.HeaderCell>
                    <Table.HeaderCell width={"2"}>Actions</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {teamUserOptsLoading && <Loader active inline="centered" />}
                  {!teamUserOptsLoading &&
                    teamUserOptions.map((item) => (
                      <Table.Row key={item.uuid}>
                        <Table.Cell>
                          <Image avatar src={item.avatar} />
                          {item.firstName} {item.lastName}
                        </Table.Cell>
                        <Table.Cell>
                          <Popup
                            position="top center"
                            trigger={
                              <Button
                                color="green"
                                className="ml-1p"
                                onClick={() => {
                                  submitAddTeamMember(item.uuid);
                                }}
                                icon
                              >
                                <Icon name="add user" />
                                <span className="ml-2">Add to Project</span>
                              </Button>
                            }
                            content="Add to project"
                          />
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  {!teamUserOptsLoading &&
                    !hasNotSearched &&
                    teamUserOptions.length === 0 && (
                      <Table.Row>
                        <Table.Cell colSpan={2}>
                          <p className="text-center">
                            No users found. Please try another search.
                          </p>
                        </Table.Cell>
                      </Table.Row>
                    )}
                  {!teamUserOptsLoading && hasNotSearched && (
                    <Table.Row>
                      <Table.Cell colSpan={2}>
                        <p className="text-center">
                          Start typing to search for users to add to the
                          project.
                        </p>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
            </Form>
          </>
        ) : (
          <Loader active inline="centered" />
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={handleClose}>Close</Button>
      </Modal.Actions>
    </Modal>
  );
};

export default ManageTeamModal;
