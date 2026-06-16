import { useMemo, useState, useEffect } from "react";
import axios from "axios";
import { Button, Input, Modal, Select, Spinner, Tooltip } from "@libretexts/davis-react";
import {
  IconAlertTriangle,
  IconRefresh,
  IconSend,
  IconTrash,
  IconUserPlus,
  IconX,
} from "@tabler/icons-react";
import { AddableProjectTeamMember, Project, User } from "../../types";
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
import api from "../../api";
import { useModals } from "../../context/ModalContext";
import ConfirmModal from "../ConfirmModal";
import { useNotifications } from "../../context/NotificationContext";

type ProjectDisplayMember = User & { roleValue: string; roleDisplay: string };

interface ProjectInvitation {
  inviteID: string;
  email: string;
  role: string;
  projectID: string;
}

interface ManageTeamModalProps {
  show: boolean;
  project: Project;
  onDataChanged: () => void;
  onClose: () => void;
}

const roleSelectOptions = projectRoleOptions.map((o) => ({ value: o.value, label: o.text }));

const ManageTeamModal: React.FC<ManageTeamModalProps> = ({
  show,
  project,
  onDataChanged,
  onClose,
}) => {
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();
  const user = useTypedSelector((state) => state.user);
  const { openModal, closeAllModals } = useModals();
  const { addNotification } = useNotifications();
  const [loading, setLoading] = useState<boolean>(false);
  const [hasNotSearched, setHasNotSearched] = useState<boolean>(true);
  const [searchString, setSearchString] = useState<string>("");
  const [inviteEmail, setInviteEmail] = useState<string>("");
  const [includeOutsideOrg, setIncludeOutsideOrg] = useState<boolean>(true);
  const [invitationsLoading, setInvitationsLoading] = useState<boolean>(false);
  const [pendingInvitations, setPendingInvitations] = useState<ProjectInvitation[]>([]);
  const [teamUserOptions, setTeamUserOptions] = useState<AddableProjectTeamMember[]>([]);
  const [teamUserOptsLoading, setTeamUserOptsLoading] = useState<boolean>(false);
  const [currentInvitationPage, setCurrentInvitationPage] = useState<number>(1);
  const [totalInvitationPages, setTotalInvitationPages] = useState<number>(1);
  const [membersWithoutAccess, setMembersWithoutAccess] = useState<string[]>([]);
  const ITEMS_PER_INVITATION_PAGE = 5;

  const userOrgDomain = useMemo(() => {
    if (!user?.email) return "";
    return extractEmailDomain(user.email);
  }, [user.email]);

  const handleClose = () => {
    setLoading(false);
    setTeamUserOptions([]);
    setTeamUserOptsLoading(false);
    setSearchString("");
    if (onClose) onClose();
  };

  const handleInviteSubmit = async () => {
    try {
      if (!project.projectID || !inviteEmail) throw new Error("Please enter a valid email address");
      setLoading(true);
      await api.createProjectInvitation(project.projectID, inviteEmail, "member");
      setInviteEmail("");
      setCurrentInvitationPage(1);
      await fetchPendingInvitations();
      onDataChanged();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingInvitations = async (page: number = 1) => {
    try {
      setInvitationsLoading(true);
      const res = await api.getAllProjectInvitations(project.projectID, page, ITEMS_PER_INVITATION_PAGE);
      setPendingInvitations(res.data.invitations || []);
      setTotalInvitationPages(Math.ceil(res.data.total / ITEMS_PER_INVITATION_PAGE));
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setInvitationsLoading(false);
    }
  };

  const handleDeleteInvitation = async (invitationId: string) => {
    try {
      setLoading(true);
      await api.deleteInvitation(invitationId);
      await fetchPendingInvitations();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembersLibraryAccess = async () => {
    try {
      if (!project.projectID || !project.libreLibrary || !project.libreCoverID) return;
      const teamMembers = [
        ...(project?.auditors || []),
        ...(project?.leads || []),
        ...(project?.liaisons || []),
        ...(project?.members || []),
      ].map((m) => m.uuid);

      const libRes = await api.getLibraryFromSubdomain(project.libreLibrary, true);
      if (!libRes || libRes.data.err) throw new Error("Failed to fetch library information");
      const libID = libRes.data?.library?.centralIdentityAppId;
      const res = await api.checkTeamLibraryAccess(libID, teamMembers);
      const withoutAccess = teamMembers.filter(
        (member) => !res.data.accessResults.find((r: any) => r.id === member)?.hasAccess
      );
      setMembersWithoutAccess(withoutAccess);
      return withoutAccess;
    } catch (err) {
      handleGlobalError(err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (show) {
        await fetchPendingInvitations();
        await fetchTeamMembersLibraryAccess();
      }
    };
    fetchData();
  }, [show]);

  async function getTeamUserOptions(searchStr: string, includeOutside: boolean = false) {
    try {
      if (!project.projectID) return;
      setHasNotSearched(false);
      setTeamUserOptsLoading(true);
      const res = await api.getAddableTeamMembers({
        projectID: project.projectID,
        searchString: searchStr,
        includeOutsideOrg: includeOutside,
      });
      if (res.data.err) throw new Error(res.data.errMsg);
      if (!res.data.users || !Array.isArray(res.data.users)) throw new Error("Invalid response from server.");
      setTeamUserOptions(res.data.users);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setTeamUserOptsLoading(false);
    }
  }

  const getTeamUserOptionsDebounced = debounce(
    (inputVal: string) => getTeamUserOptions(inputVal, includeOutsideOrg),
    200
  );

  const submitChangeTeamMemberRole = async (memberUUID: string, newRole: string) => {
    try {
      if (isEmptyString(memberUUID) || isEmptyString(newRole) || isEmptyString(project.projectID)) {
        throw new Error("Invalid user UUID or role.");
      }
      setLoading(true);
      const res = await axios.put(`/project/${project.projectID}/team/${memberUUID}/role`, { newRole });
      if (res.data.err) { handleGlobalError(res.data.errMsg); return; }
      setTeamUserOptions([]);
      onDataChanged();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  };

  const submitChangeInvitationRole = async (inviteID: string, role: string) => {
    try {
      if (isEmptyString(inviteID) || isEmptyString(role)) throw new Error("Invalid invite ID or role.");
      setLoading(true);
      await api.updateInvitationRole(inviteID, role);
      await fetchPendingInvitations(currentInvitationPage);
      onDataChanged();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  };

  const submitRemoveTeamMember = async (memberUUID: string) => {
    try {
      if (isEmptyString(memberUUID) || isEmptyString(project.projectID)) throw new Error("Invalid user or project UUID.");
      setLoading(true);
      const res = await axios.delete(`/project/${project.projectID}/team/${memberUUID}`);
      if (res.data.err) { handleGlobalError(res.data.errMsg); return; }
      setTeamUserOptions([]);
      onDataChanged();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  };

  const submitAddTeamMember = async (uuid: string) => {
    try {
      if (!project.projectID || !uuid) throw new Error("Invalid user or project UUID.");
      setLoading(true);
      const res = await axios.post(`/project/${project.projectID}/team`, { uuid });
      if (res.data.err) { handleGlobalError(res.data.errMsg); return; }
      getTeamUserOptions(searchString);
      onDataChanged();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  };

  const submitReSyncAccess = async () => {
    try {
      if (!project.libreCoverID || !project.libreLibrary) return;
      setLoading(true);
      const res = await api.reSyncProjectTeamBookAccess(project.projectID);
      if (res.data.err) { handleGlobalError(res.data.errMsg); return; }
      await fetchTeamMembersLibraryAccess();
      addNotification({ type: "success", message: "Successfully requested re-sync of book access." });
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  };

  const onReSyncAccessClick = () => {
    if (!project.libreCoverID || !project.libreLibrary) return;
    openModal(
      <ConfirmModal
        text="Are you sure you want to re-sync book access? Conductor handles this automatically, so this is only necessary if you are having issues with access."
        onConfirm={() => { closeAllModals(); submitReSyncAccess(); }}
        confirmText="Re-Sync"
        cancelText="Cancel"
        onCancel={closeAllModals}
      />
    );
  };

  // Build current team list
  const sortedTeam = useMemo((): ProjectDisplayMember[] => {
    const projTeam: ProjectDisplayMember[] = [];
    project.leads?.forEach((m) => projTeam.push({ ...m, roleValue: "lead", roleDisplay: "Lead" }));
    project.liaisons?.forEach((m) => projTeam.push({ ...m, roleValue: "liaison", roleDisplay: "Liaison" }));
    project.members?.forEach((m) => projTeam.push({ ...m, roleValue: "member", roleDisplay: "Member" }));
    project.auditors?.forEach((m) => projTeam.push({ ...m, roleValue: "auditor", roleDisplay: "Auditor" }));
    return sortUsersByName(projTeam) as ProjectDisplayMember[];
  }, [project]);

  const ITEMS_PER_TEAM_PAGE = 5;
  const [currentTeamPage, setCurrentTeamPage] = useState(1);
  const totalTeamPages = Math.ceil(sortedTeam.length / ITEMS_PER_TEAM_PAGE);
  const paginatedTeam = sortedTeam.slice(
    (currentTeamPage - 1) * ITEMS_PER_TEAM_PAGE,
    currentTeamPage * ITEMS_PER_TEAM_PAGE
  );

  const paginatedInvitations = pendingInvitations.slice(
    (currentInvitationPage - 1) * ITEMS_PER_INVITATION_PAGE,
    currentInvitationPage * ITEMS_PER_INVITATION_PAGE
  );

  return (
    <Modal open={show} onClose={(v) => !v && handleClose()}>
      <Modal.Header>
        <div className="flex items-center justify-between w-full">
          <Modal.Title>Manage Project Team</Modal.Title>
          {project.libreLibrary && project.libreCoverID && (
            <Button size="sm" variant="outline" icon={<IconRefresh size={14} />} onClick={onReSyncAccessClick}>
              Re-Sync Book Access
            </Button>
          )}
        </div>
      </Modal.Header>
      <Modal.Body className="overflow-y-auto max-h-[calc(100dvh-10rem)] space-y-8">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <>
            {/* Current Team Members */}
            <section>
              <p className="text-lg font-semibold mb-2">Current Team Members</p>
              <table className="w-full border-collapse border border-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-200 px-3 py-2 text-left w-7/12">Name</th>
                    <th className="border border-gray-200 px-3 py-2 text-left w-3/12">Role</th>
                    <th className="border border-gray-200 px-3 py-2 text-left w-2/12">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTeam.map((item) => {
                    const lackAccess = membersWithoutAccess.includes(item.uuid);
                    return (
                      <tr key={item.uuid} className="even:bg-gray-50">
                        <td className="border border-gray-200 px-3 py-2">
                          <div className="flex items-center gap-2">
                            {lackAccess && project.libreLibrary && project.libreCoverID && (
                              <Tooltip content="This user doesn't have access to the library for this project.">
                                <IconAlertTriangle size={16} className="text-yellow-500" />
                              </Tooltip>
                            )}
                            {item.avatar && (
                              <img src={item.avatar} alt="" className="w-6 h-6 rounded-full" />
                            )}
                            {item.firstName} {item.lastName}
                          </div>
                        </td>
                        <td className="border border-gray-200 px-3 py-2">
                          <Select
                            name={`role-${item.uuid}`}
                            label=""
                            placeholder="Change role..."
                            options={roleSelectOptions}
                            value={item.roleValue}
                            onChange={(e) => submitChangeTeamMemberRole(item.uuid, e.target.value)}
                          />
                        </td>
                        <td className="border border-gray-200 px-3 py-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            icon={<IconX size={14} />}
                            onClick={() => submitRemoveTeamMember(item.uuid)}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedTeam.length === 0 && (
                    <tr>
                      <td colSpan={3} className="border border-gray-200 px-3 py-4 text-center text-gray-400">
                        No team members yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {totalTeamPages > 1 && (
                <div className="flex justify-center gap-2 mt-2">
                  <Button size="sm" variant="outline" disabled={currentTeamPage === 1} onClick={() => setCurrentTeamPage(p => p - 1)}>Prev</Button>
                  <span className="text-sm self-center">{currentTeamPage} / {totalTeamPages}</span>
                  <Button size="sm" variant="outline" disabled={currentTeamPage === totalTeamPages} onClick={() => setCurrentTeamPage(p => p + 1)}>Next</Button>
                </div>
              )}
            </section>

            {/* Invite by Email */}
            <section>
              <p className="text-lg font-semibold mb-3">Invite Team Members By Email</p>
              <div className="flex gap-2 items-end">
                <Input
                  name="inviteEmail"
                  label="Email address"
                  placeholder="Enter email address..."
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1"
                />
                <Button
                  className="!bg-green-600 !text-white hover:!bg-green-700"
                  icon={<IconSend size={15} />}
                  onClick={handleInviteSubmit}
                  disabled={!inviteEmail}
                >
                  Send Invite
                </Button>
              </div>

              <div className="mt-6">
                <p className="text-base font-semibold mb-2">Pending Invitations</p>
                <table className="w-full border-collapse border border-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border border-gray-200 px-3 py-2 text-left w-7/12">Email Address</th>
                      <th className="border border-gray-200 px-3 py-2 text-left w-3/12">Role</th>
                      <th className="border border-gray-200 px-3 py-2 text-left w-2/12">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitationsLoading ? (
                      <tr>
                        <td colSpan={3} className="border border-gray-200 px-3 py-4">
                          <div className="flex justify-center"><Spinner /></div>
                        </td>
                      </tr>
                    ) : pendingInvitations.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="border border-gray-200 px-3 py-4 text-center text-gray-400">
                          No pending invitations
                        </td>
                      </tr>
                    ) : (
                      paginatedInvitations.map((inv) => (
                        <tr key={inv.inviteID} className="even:bg-gray-50">
                          <td className="border border-gray-200 px-3 py-2">{inv.email}</td>
                          <td className="border border-gray-200 px-3 py-2">
                            <Select
                              name={`inv-role-${inv.inviteID}`}
                              label=""
                              placeholder="Change role..."
                              options={roleSelectOptions}
                              value={inv.role}
                              onChange={(e) => submitChangeInvitationRole(inv.inviteID, e.target.value)}
                            />
                          </td>
                          <td className="border border-gray-200 px-3 py-2">
                            <Button
                              variant="destructive"
                              size="sm"
                              icon={<IconTrash size={14} />}
                              onClick={() => handleDeleteInvitation(inv.inviteID)}
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {totalInvitationPages > 1 && (
                  <div className="flex justify-center gap-2 mt-2">
                    <Button size="sm" variant="outline" disabled={currentInvitationPage === 1} onClick={() => { const p = currentInvitationPage - 1; setCurrentInvitationPage(p); fetchPendingInvitations(p); }}>Prev</Button>
                    <span className="text-sm self-center">{currentInvitationPage} / {totalInvitationPages}</span>
                    <Button size="sm" variant="outline" disabled={currentInvitationPage === totalInvitationPages} onClick={() => { const p = currentInvitationPage + 1; setCurrentInvitationPage(p); fetchPendingInvitations(p); }}>Next</Button>
                  </div>
                )}
              </div>
            </section>

            {/* Add by Name */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <p className="text-lg font-semibold">Add Team Members By Name</p>
                  <Tooltip content="Add users to the project team by searching for their name or email address. Use the toggle to restrict search to users with the same email domain as you.">
                    <span className="text-gray-400 cursor-help text-sm">(?)</span>
                  </Tooltip>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <span>Include users outside of {userOrgDomain}</span>
                  <input
                    type="checkbox"
                    checked={includeOutsideOrg}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIncludeOutsideOrg(checked);
                      getTeamUserOptions(searchString, checked);
                    }}
                    className="w-4 h-4"
                  />
                </label>
              </div>
              <Input
                name="teamSearch"
                label="Search users"
                placeholder="Start typing to search by name or email..."
                value={searchString}
                onChange={(e) => {
                  setSearchString(e.target.value);
                  getTeamUserOptionsDebounced(e.target.value);
                }}
              />
              <table className="w-full border-collapse border border-gray-200 text-sm mt-2">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-200 px-3 py-2 text-left w-4/12">Name</th>
                    <th className="border border-gray-200 px-3 py-2 text-left w-3/12">Organization</th>
                    <th className="border border-gray-200 px-3 py-2 text-left w-2/12">Domain</th>
                    <th className="border border-gray-200 px-3 py-2 text-left w-3/12">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamUserOptsLoading && (
                    <tr>
                      <td colSpan={3} className="border border-gray-200 px-3 py-4">
                        <div className="flex justify-center"><Spinner /></div>
                      </td>
                    </tr>
                  )}
                  {!teamUserOptsLoading && teamUserOptions.map((item) => {
                    const orgsStr = item.orgs
                      ? truncateString(item.orgs.slice(0, 3).map((o: { name: string }) => o.name).join(", "), 135)
                      : "";
                    return (
                      <tr key={item.uuid} className="even:bg-gray-50">
                        <td className="border border-gray-200 px-3 py-2">
                          <div className="flex items-center gap-2">
                            {item.avatar && <img src={item.avatar} alt="" className="w-6 h-6 rounded-full" />}
                            {item.firstName} {item.lastName}
                          </div>
                        </td>
                        <td className="border border-gray-200 px-3 py-2">
                          {orgsStr && orgsStr !== "Unknown Organization" && <p>{orgsStr}</p>}
                        </td>
                        <td className="border border-gray-200 px-3 py-2">
                          {item.email && <p>{item.emailDomain}</p>}
                        </td>
                        <td className="border border-gray-200 px-3 py-2">
                          <Button
                            className="!bg-green-600 !text-white hover:!bg-green-700"
                            size="sm"
                            icon={<IconUserPlus size={14} />}
                            onClick={() => submitAddTeamMember(item.uuid)}
                          >
                            Add to Project
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {!teamUserOptsLoading && !hasNotSearched && teamUserOptions.length === 0 && (
                    <tr>
                      <td colSpan={3} className="border border-gray-200 px-3 py-4 text-center text-gray-400">
                        No users found. Please try another search.
                      </td>
                    </tr>
                  )}
                  {!teamUserOptsLoading && hasNotSearched && (
                    <tr>
                      <td colSpan={3} className="border border-gray-200 px-3 py-4 text-center text-gray-400">
                        Start typing to search for users to add to the project.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={handleClose}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ManageTeamModal;
