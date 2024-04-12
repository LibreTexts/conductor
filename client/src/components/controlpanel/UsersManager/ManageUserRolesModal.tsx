import axios from 'axios';
import { Button, Dropdown, List, Loader, Modal } from 'semantic-ui-react';
import { Organization } from '../../../types';
import React, { useEffect, useState } from 'react';
import useGlobalError from '../../error/ErrorHooks';
import { UserRoleOptions } from '../../../utils/userHelpers';

type ManageUserRolesModalProps = {
  firstName: string;
  isSuperAdmin: boolean;
  lastName: string;
  onClose: () => void;
  orgID: string;
  show: boolean;
  uuid: string;
};

const ManageUserRolesModal: React.FC<ManageUserRolesModalProps> = ({
  firstName,
  isSuperAdmin,
  lastName,
  onClose,
  orgID,
  show,
  uuid,
  ...props
}) => {
  const { handleGlobalError } = useGlobalError();
  const allRoleOpts = UserRoleOptions;
  const roleOpts = UserRoleOptions.filter((o) => o.value !== 'superadmin');

  const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [userRoles, setUserRoles] = useState<{ org: Organization; role: string; roleInternal: string }[]>([]);

  async function getAllOrganizations() {
    try {
      setLoading(true);
      const res = await axios.get('/orgs');
      if (res.data?.errMsg) {
        handleGlobalError(res.data.errMsg);
        return;
      }
      if (!Array.isArray(res.data?.orgs)) return;
      const orgs = (res.data.orgs as Organization[]).sort((a, b) => a.name.localeCompare(b.name));
      setAllOrganizations(
        isSuperAdmin
        ? orgs
        : orgs.filter((org) => org.orgID === orgID)
      );
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function getUserRoles() {
    try {
      setLoading(true);
      const res = await axios.get('/user/roles', {
        params: {
          uuid,
        },
      });
      if (res.data?.errMsg) {
        handleGlobalError(res.data.errMsg);
        return;
      }
      if (!res.data?.user || !Array.isArray(res.data?.user?.roles)) return;
      setUserRoles(res.data.user.roles);
    } catch (err) {

    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (show) {
      getAllOrganizations();
      getUserRoles();
    } else {
      setAllOrganizations([]);
      setUserRoles([]);
    }
  }, [show]);

  async function updateUserRole(newRole: string, orgToUpdateID: string) {
    try {
      setLoading(true);
      const res = await axios.put('/user/role/update', {
        orgID: orgToUpdateID,
        role: newRole,
        uuid,
      });
      if (res.data?.errMsg) {
        handleGlobalError(res.data.errMsg);
        return;
      }
      await getUserRoles();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal size="large" open={show} onClose={onClose} {...props}>
      <Modal.Header>
        <i>{firstName} {lastName}:</i>{' '}
        Manage User Roles
      </Modal.Header>
      <Modal.Content scrolling style={{ minHeight: "30vh" }}>
        {loading && <Loader />}
        <List divided verticalAlign="middle">
          {allOrganizations.map((org) => (
            <List.Item key={org.orgID}>
              <div className="flex-row-div">
                <div className="left-flex">
                  <span>{org.name}</span>
                </div>
                <div className="right-flex">
                  <Dropdown
                    onChange={(_e, { value }) => {
                      if (typeof value !== 'string') return;
                      const current = userRoles.find((r) => r.org?.orgID === org.orgID)?.roleInternal;
                      if (value === current) return;
                      updateUserRole(value, org.orgID);
                    }}
                    options={org.orgID === 'libretexts' ? allRoleOpts : roleOpts}
                    placeholder="No role set"
                    selection
                    value={userRoles.find((r) => r.org?.orgID === org.orgID)?.roleInternal}
                  />
                </div>
              </div>
            </List.Item>
          ))}
        </List>
      </Modal.Content>
      <Modal.Actions>
        <Button loading={loading} onClick={onClose}>
          Close
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default ManageUserRolesModal;
