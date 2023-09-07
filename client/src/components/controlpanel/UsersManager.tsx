import './ControlPanel.css';

import {
  Grid,
  Header,
  Segment,
  Table,
  Modal,
  Button,
  Dropdown,
  Icon,
  Pagination,
  Input,
  Breadcrumb,
  List
} from 'semantic-ui-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTypedSelector } from '../../state/hooks';
import axios from 'axios';

import { itemsPerPageOptions } from '../util/PaginationOptions.js';
import useGlobalError from '../error/ErrorHooks';
import { User } from '../../types';

const UsersManager = () => {

    // Global State
    const { handleGlobalError } = useGlobalError();
    const org = useTypedSelector((state) => state.org);
    const isSuperAdmin = useTypedSelector((state) => state.user.isSuperAdmin);
    const isCampusAdmin = useTypedSelector((state) => state.user.isCampusAdmin);

    // Data
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [displayUsers, setDisplayUsers] = useState<User[]>([]);
    const [pageUsers, setPageUsers] = useState<User[]>([]);

    // UI
    const [activePage, setActivePage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [itemsPerPage, setItemsPerPage] = useState<number>(10);
    const [loadedData, setLoadedData] = useState<boolean>(false);

    const [searchString, setSearchString] = useState<string>('');
    const [sortChoice, setSortChoice] = useState<string>('first');

    // Manage Roles Modal
    const [showManageUserModal, setShowManageUserModal] = useState<boolean>(false);
    const [manageUserUUID, setManageUserUUID] = useState<string>('');
    const [manageUserName, setManageUserName] = useState<string>('');

    //TODO: Determine correct typing here
    const [manageUserRoles, setManageUserRoles] = useState<any[]>([]);

    const [manageUserOrgRole, setManageUserOrgRole] = useState<string>('');
    const [manageUserOrgRoleText, setManageUserOrgRoleText] = useState<string>('');
    const [manageUserLoading, setManageUserLoading] = useState<boolean>(false);

    // Delete User Modal
    const [showDelUserModal, setShowDelUserModal] = useState<boolean>(false);
    const [delUserUUID, setDelUserUUID] = useState<string>('');
    const [delUserName, setDelUserName] = useState<string>('');
    const [delUserLoading, setDelUserLoading] = useState<boolean>(false);

    const sortOptions = [
        { key: 'first', text: 'Sort by First Name', value: 'first' },
        { key: 'last', text: 'Sort by Last Name', value: 'last' },
        { key: 'email', text: 'Sort by Email', value: 'email' },
    ];


    /**
     * Set page title and retrieve
     * users on initial load.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Users Manager";
        getUsers();
    }, []);


    /**
     * Track changes to the number of users loaded
     * and the selected itemsPerPage and update the
     * set of users to display.
     */
    useEffect(() => {
        setTotalPages(Math.ceil(displayUsers.length/itemsPerPage));
        setPageUsers(displayUsers.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage));
    }, [itemsPerPage, displayUsers, activePage]);


    /**
     * Refilter whenever the sort option
     * or the search string changes.
     */
    useEffect(() => {
        filterAndSortUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allUsers, searchString, sortChoice]);


    /**
     * Retrieve the list of users from
     * the server.
     */
    const getUsers = () => {
        setLoadedData(false);
        if (isSuperAdmin || isCampusAdmin) {
            axios.get('/users').then((res) => {
                if (!res.data.err) {
                    if (res.data.users && Array.isArray(res.data.users)) {
                        setAllUsers(res.data.users);
                    }
                } else {
                    handleGlobalError(res.data.errMsg);
                }
                setLoadedData(true);
            }).catch((err) => {
                handleGlobalError(err);
                setLoadedData(true);
            });
        }
    };


    /**
     * Filter and sort users according
     * to current filters and sort
     * choice.
     */
    const filterAndSortUsers = () => {
        setLoadedData(false);
        let filtered = allUsers.filter((user) => {
            var include = true;
            var descripString = String(user.firstName).toLowerCase() + String(user.lastName).toLowerCase()
                                + String(user.email).toLowerCase() + String(user.authType).toLowerCase();
            if (searchString !== '' && String(descripString).indexOf(String(searchString).toLowerCase()) === -1) {
                include = false;
            }
            if (include) {
                return user;
            } else {
                return false;
            }
        });
        if (sortChoice === 'first') {
            const sorted = [...filtered].sort((a, b) => {
                var normalA = String(a.firstName).toLowerCase().replace(/[^A-Za-z]+/g, "");
                var normalB = String(b.firstName).toLowerCase().replace(/[^A-Za-z]+/g, "");
                if (normalA < normalB) {
                    return -1;
                }
                if (normalA > normalB) {
                    return 1;
                }
                return 0;
            });
            setDisplayUsers(sorted);
        } else if (sortChoice === 'last') {
            const sorted = [...filtered].sort((a, b) => {
                var normalA = String(a.lastName).toLowerCase().replace(/[^A-Za-z]+/g, "");
                var normalB = String(b.lastName).toLowerCase().replace(/[^A-Za-z]+/g, "");
                if (normalA < normalB) {
                    return -1;
                }
                if (normalA > normalB) {
                    return 1;
                }
                return 0;
            });
            setDisplayUsers(sorted);
        } else if (sortChoice === 'email') {
            const sorted = [...filtered].sort((a, b) => {
                var normalA = String(a.email).toLowerCase().replace(/[^A-Za-z]+/g, "");
                var normalB = String(b.email).toLowerCase().replace(/[^A-Za-z]+/g, "");
                if (normalA < normalB) {
                    return -1;
                }
                if (normalA > normalB) {
                    return 1;
                }
                return 0;
            });
            setDisplayUsers(sorted);
        } else if (sortChoice === 'auth') {
            const sorted = [...filtered].sort((a, b) => {
                var normalA = String(a.authType).toLowerCase().replace(/[^A-Za-z]+/g, "");
                var normalB = String(b.authType).toLowerCase().replace(/[^A-Za-z]+/g, "");
                if (normalA < normalB) {
                    return -1;
                }
                if (normalA > normalB) {
                    return 1;
                }
                return 0;
            });
            setDisplayUsers(sorted);
        }
        setLoadedData(true);
    };


    /**
     * Retrieves the roles held by the user
     * identified by @uuid and sets up
     * either the Super Admin or Campus Admin
     * interface with the relevant information.
     */
    const getUserRoles = (uuid: string) => {
        setManageUserLoading(true);
        axios.get('/user/roles', {
            params: {
                uuid: uuid
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.user) {
                    if (isSuperAdmin) {
                        if (res.data.user.roles && Array.isArray(res.data.user.roles)) {
                            setManageUserRoles(res.data.user.roles);
                        }
                    } else if (isCampusAdmin) {
                        if (res.data.user.roles.length === 1) {
                            var campusRole = res.data.user.roles[0];
                            if (campusRole.org && campusRole.org.orgID === org.orgID) {
                                setManageUserOrgRole(campusRole.role);
                                setManageUserOrgRoleText(campusRole.roleText);
                            }
                        } else if (res.data.user.roles.length === 0) {
                            setManageUserOrgRole('');
                            setManageUserOrgRoleText('Not Joined/Unknown');
                        }
                    }
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setManageUserLoading(false);
        }).catch((err) => {
            handleGlobalError(err);
            setManageUserLoading(false);
        });
    };


    /**
     * Submits a PUT request to update
     * the user being modified in the Manage Roles
     * Modal (manageUserUUID) to have the org-relevant
     * role specified by @newRole, then closes the Modal.
     * For use in the Campus Administrator interface.
     */
    const campusAdminSetRole = (newRole: string) => {
        axios.put('/user/role/update', {
            uuid: manageUserUUID,
            orgID: org.orgID,
            role: newRole
        }).then((res) => {
            if (!res.data.err) {
                closeManageUserModal();
            } else {
                handleGlobalError(res.data.errMsg);
                setManageUserLoading(false);
            }
        }).catch((err) => {
            handleGlobalError(err);
            setManageUserLoading(false);
        });
    };


    /**
     * Submits a PUT request to update
     * the user specified by @uuid to have the role
     * specified by @newRole in @orgID, then reloads the
     * User's roles.
     * For use in the Super Administrator interface.
     */
    const superSetOrgRole = (uuid: string, orgID: string, newRole: string) => {
        setManageUserLoading(true);
        if (uuid !== '') {
            axios.put('/user/role/update', {
                uuid: uuid,
                orgID: orgID,
                role: newRole
            }).then((res) => {
                if (!res.data.err) {
                    getUserRoles(uuid);
                } else {
                    handleGlobalError(res.data.errMsg);
                }
                setManageUserLoading(false);
            }).catch((err) => {
                handleGlobalError(err);
                setManageUserLoading(false);
            });
        }
    };


    /**
     * Open the Manage User Roles Modal and
     * set its respective values to the
     * requested user.
     */
    const openManageUserModal = (uuid: string, firstName: string, lastName: string) => {
        if ((uuid !== '') && (firstName !== '') && (lastName !== '')) {
            setManageUserUUID(uuid);
            setManageUserName(firstName + ' ' + lastName);
            setManageUserRoles([]);
            setManageUserOrgRole('');
            setManageUserOrgRoleText('');
            setManageUserLoading(false);
            setShowManageUserModal(true);
            getUserRoles(uuid);
        }
    };


    /**
     * Close the Manage User Roles Modal and
     * reset its values to their defaults.
     */
    const closeManageUserModal = () => {
        setShowManageUserModal(false);
        setManageUserUUID('');
        setManageUserName('');
        setManageUserRoles([]);
        setManageUserOrgRole('');
        setManageUserOrgRoleText('');
        setManageUserLoading(false);
    };


    /**
     * Submit a PUT request to the server
     * to delete the user currently
     * being modified in the Delete
     * User Modal (delUserUUID).
     */
    const submitDeleteUser = () => {
        setDelUserLoading(true);
        axios.put('/user/delete', {
            uuid: delUserUUID
        }).then((res) => {
            if (!res.data.err) {
                closeDelUserModal();
                getUsers();
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setDelUserLoading(false);
        }).catch((err) => {
            handleGlobalError(err);
            setDelUserLoading(false);
        });
    };


    /**
     * Open the Delete User Modal and
     * set its respective values to the
     * requested user.
     */
    const openDelUserModal = (uuid: string, firstName: string, lastName: string) => {
        if ((uuid !== '') && (firstName !== '') && (lastName !== '')) {
            setDelUserUUID(uuid);
            setDelUserName(firstName + ' ' + lastName);
            setDelUserLoading(false);
            setShowDelUserModal(true);
        }
    };


    /**
     * Close the Delete User Modal and
     * reset its values to their defaults.
     */
    const closeDelUserModal = () => {
        setShowDelUserModal(false);
        setDelUserUUID('');
        setDelUserName('');
        setDelUserLoading(false);
    };


    return (
        <Grid className='controlpanel-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Users Manager</Header>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Segment.Group>
                        <Segment>
                            <Breadcrumb>
                                <Breadcrumb.Section as={Link} to='/controlpanel'>
                                    Control Panel
                                </Breadcrumb.Section>
                                <Breadcrumb.Divider icon='right chevron' />
                                <Breadcrumb.Section active>
                                    Users Manager
                                </Breadcrumb.Section>
                            </Breadcrumb>
                        </Segment>
                        <Segment>
                            <Grid>
                                <Grid.Row>
                                    <Grid.Column width={11}>
                                        <Dropdown
                                            placeholder='Sort by...'
                                            floating
                                            selection
                                            button
                                            options={sortOptions}
                                            onChange={(_e, { value }) => { setSortChoice(value as string) }}
                                            value={sortChoice}
                                        />
                                    </Grid.Column>
                                    <Grid.Column width={5}>
                                        <Input
                                            icon='search'
                                            placeholder='Search...'
                                            onChange={(e) => { setSearchString(e.target.value) }}
                                            value={searchString}
                                            fluid
                                        />
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Segment>
                        <Segment>
                            <div className='flex-row-div'>
                                <div className='left-flex'>
                                    <span>Displaying </span>
                                    <Dropdown
                                        className='commons-content-pagemenu-dropdown'
                                        selection
                                        options={itemsPerPageOptions}
                                        onChange={(_e, { value }) => {
                                            setItemsPerPage(value as number);
                                        }}
                                        value={itemsPerPage}
                                    />
                                    <span> items per page of <strong>{Number(allUsers.length).toLocaleString()}</strong> results.</span>
                                </div>
                                <div className='right-flex'>
                                    <Pagination
                                        activePage={activePage}
                                        totalPages={totalPages}
                                        firstItem={null}
                                        lastItem={null}
                                        onPageChange={(_e, data) => {
                                            setActivePage(data.activePage as number)
                                        }}
                                    />
                                </div>
                            </div>
                        </Segment>
                        <Segment loading={!loadedData}>
                            <Table striped celled fixed>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'first')
                                                ? <span><em>First Name</em></span>
                                                : <span>First Name</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'last')
                                                ? <span><em>Last Name</em></span>
                                                : <span>Last Name</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'email')
                                                ? <span><em>Email</em></span>
                                                : <span>Email</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Actions</span>
                                        </Table.HeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {(pageUsers.length > 0) &&
                                        pageUsers.map((item, index) => {
                                            return (
                                                <Table.Row key={index}>
                                                    <Table.Cell>
                                                        <p>{item.firstName}</p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p>{item.lastName}</p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p>{item.email}</p>
                                                    </Table.Cell>
                                                    <Table.Cell textAlign='center'>
                                                        <Button.Group vertical fluid>
                                                            <Button
                                                                color='blue'
                                                                onClick={() => { openManageUserModal(item.uuid, item.firstName, item.lastName) }}
                                                            >
                                                                <Icon name='user doctor' />
                                                                <span>Manage Roles</span>
                                                            </Button>
                                                            <Button
                                                                color='teal'
                                                                as={Link}
                                                                to={`/controlpanel/usersmanager/${item.uuid}`}
                                                            >
                                                                <Icon name='list ul' />
                                                                <span>View Projects</span>
                                                            </Button>
                                                        </Button.Group>
                                                    </Table.Cell>
                                                </Table.Row>
                                            )
                                        })
                                    }
                                    {(pageUsers.length === 0) &&
                                        <Table.Row>
                                            <Table.Cell colSpan={5}>
                                                <p className='text-center'><em>No results found.</em></p>
                                            </Table.Cell>
                                        </Table.Row>
                                    }
                                </Table.Body>
                            </Table>
                        </Segment>
                    </Segment.Group>
                    {/* Manager User Modal */}
                    <Modal
                        open={showManageUserModal}
                        closeOnDimmerClick={false}
                    >
                        <Modal.Header>Manage User Roles</Modal.Header>
                        <Modal.Content scrolling>
                            <p><strong>User: </strong> {manageUserName}</p>
                            {(isSuperAdmin && !isCampusAdmin) &&
                                <div>
                                    <p><strong>Roles: </strong></p>
                                    {(Array.isArray(manageUserRoles) && manageUserRoles.length > 0)
                                        ? (
                                            <List verticalAlign='middle' celled relaxed>
                                                {manageUserRoles.map((item, idx) => {
                                                    var orgVal = '';
                                                    var orgText = 'Unknown Organization';
                                                    var roleVal = '';
                                                    var roleText = 'Unknown Role';
                                                    if (item.org) {
                                                        orgVal = item.org.orgID;
                                                        if (item.org.shortName) orgText = item.org.shortName;
                                                        else if (item.org.name) orgText = item.org.name;
                                                    }
                                                    if (typeof(item.roleInternal) === 'string') roleVal = item.roleInternal;
                                                    if (typeof(item.role)) roleText = item.role;
                                                    let ActionButton = null;
                                                    switch (roleVal) {
                                                        case 'superadmin':
                                                            ActionButton = (
                                                                <Button
                                                                    color='orange'
                                                                    onClick={() => { superSetOrgRole(manageUserUUID, orgVal, 'campusadmin') }}
                                                                >
                                                                    <Icon name='level down' />
                                                                    <span>Lower to Campus Administrator</span>
                                                                </Button>
                                                            );
                                                            break;
                                                        case 'campusadmin':
                                                            if (orgVal === 'libretexts') {
                                                                ActionButton = (
                                                                    <Button.Group widths={2}>
                                                                        <Button
                                                                            color='violet'
                                                                            onClick={() => { superSetOrgRole(manageUserUUID, orgVal, 'superadmin') }}
                                                                        >
                                                                            <Icon name='level up' />
                                                                            Elevate to Super Administrator
                                                                        </Button>
                                                                        <Button
                                                                            color='yellow'
                                                                            onClick={() => { superSetOrgRole(manageUserUUID, orgVal, 'member') }}
                                                                        >
                                                                            <Icon name='level down' />
                                                                            <span>Lower to Campus Member</span>
                                                                        </Button>
                                                                    </Button.Group>
                                                                );
                                                            } else {
                                                                ActionButton = (
                                                                    <Button
                                                                        color='yellow'
                                                                        onClick={() => { superSetOrgRole(manageUserUUID, orgVal, 'member') }}
                                                                    >
                                                                        <Icon name='level down' />
                                                                        <span>Lower to Campus Member</span>
                                                                    </Button>
                                                                );
                                                            }
                                                            break;
                                                        case 'member':
                                                            ActionButton = (
                                                                <Button
                                                                    color='green'
                                                                    onClick={() => { superSetOrgRole(manageUserUUID, orgVal, 'campusadmin') }}
                                                                >
                                                                    <Icon name='level up' />
                                                                    <span>Elevate to Campus Administrator</span>
                                                                </Button>
                                                            );
                                                            break;
                                                    }
                                                    return (
                                                        <List.Item key={idx}>
                                                            <List.Content floated='right'>
                                                                {ActionButton}
                                                            </List.Content>
                                                            <List.Content>
                                                                <List.Header>{orgText}</List.Header>
                                                                <List.Description>
                                                                    {roleText}
                                                                </List.Description>
                                                            </List.Content>
                                                        </List.Item>
                                                    )
                                                })}
                                            </List>
                                        )
                                        : (<p><em>No roles available.</em></p>)
                                    }
                                </div>
                            }
                            {isCampusAdmin &&
                                <div>
                                    <p><strong>Role in <em>{org.shortName}</em>: </strong>{manageUserOrgRoleText}</p>
                                    <Button
                                        color={(manageUserOrgRole === 'campusadmin') ? 'yellow' : 'green'}
                                        disabled={manageUserOrgRole === 'superadmin'}
                                        fluid
                                        onClick={() => {
                                            if (manageUserOrgRole === 'campusadmin') campusAdminSetRole('member')
                                            else campusAdminSetRole('campusadmin')
                                        }}
                                    >
                                        <Icon name={(manageUserOrgRole === 'campusadmin') ? 'level down' : 'level up'} />
                                        {(manageUserOrgRole === 'campusadmin')
                                            ? (<span>Lower to Campus Member</span>)
                                            : (<span>Elevate to Campus Administrator</span>)
                                        }
                                    </Button>
                                </div>
                            }
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                color='blue'
                                loading={manageUserLoading}
                                onClick={closeManageUserModal}
                            >
                                Done
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Delete User Modal */}
                    <Modal
                        open={showDelUserModal}
                        closeOnDimmerClick={false}
                    >
                        <Modal.Header>Delete User</Modal.Header>
                        <Modal.Content>
                            <p><strong><em>CAUTION: </em></strong>Are you sure you want to delete user <strong>{delUserName}</strong> <span className='muted-text'>({delUserUUID})</span>?</p>
                            <p><em>Note: this will not prevent the user from registering again in the future.</em></p>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeDelUserModal}
                            >
                                <span>Cancel</span>
                            </Button>
                            <Button
                                color='red'
                                loading={delUserLoading}
                                onClick={submitDeleteUser}
                            >
                                <Icon name='user delete' />
                                <span>Delete</span>
                            </Button>
                        </Modal.Actions>
                    </Modal>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )

}

export default UsersManager;
