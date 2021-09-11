import './ControlPanel.css';

import {
  Grid,
  Header,
  Image,
  Segment,
  Form,
  Table,
  Modal,
  Button,
  Dropdown,
  Icon,
  Pagination,
  Input,
  Breadcrumb
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';

import {
    isEmptyString,
    truncateString,
    capitalizeFirstLetter
} from '../util/HelperFunctions.js';
import { itemsPerPageOptions } from '../util/PaginationOptions.js';
import useGlobalError from '../error/ErrorHooks.js';

const UsersManager = (props) => {

    // Global State
    const { handleGlobalError } = useGlobalError();
    const isSuperAdmin = useSelector((state) => state.user.isSuperAdmin);
    const isCampusAdmin = useSelector((state) => state.user.isCampusAdmin);

    // Data
    const [allUsers, setAllUsers] = useState([]);
    const [displayUsers, setDisplayUsers] = useState([]);
    const [pageUsers, setPageUsers] = useState([]);

    // UI
    const [activePage, setActivePage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [loadedData, setLoadedData] = useState(false);

    const [searchString, setSearchString] = useState('');
    const [sortChoice, setSortChoice] = useState('first');

    const sortOptions = [
        { key: 'first', text: 'Sort by First Name', value: 'first' },
        { key: 'last', text: 'Sort by Last Name', value: 'last' },
        { key: 'email', text: 'Sort by Email', value: 'email' },
        { key: 'auth', text: 'Sort by Auth Method', value: 'auth' },
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
                                + String(user.email).toLowerCase() + String(user.authMethod).toLowerCase();
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
                var normalA = String(a.authMethod).toLowerCase().replace(/[^A-Za-z]+/g, "");
                var normalB = String(b.authMethod).toLowerCase().replace(/[^A-Za-z]+/g, "");
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
    }

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
                                            onChange={(_e, { value }) => { setSortChoice(value) }}
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
                                            setItemsPerPage(value);
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
                                            setActivePage(data.activePage)
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
                                            {(sortChoice === 'auth')
                                                ? <span><em>Auth Method</em></span>
                                                : <span>Auth Method</span>
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
                                                    <Table.Cell>
                                                        <p>{item.authMethod}</p>
                                                    </Table.Cell>
                                                    <Table.Cell textAlign='center'>
                                                        <Button.Group vertical fluid>
                                                            <Button
                                                                color='blue'
                                                            >
                                                                <Icon name='user doctor' />
                                                                Manage User and Roles
                                                            </Button>
                                                            <Button
                                                                disabled={!isSuperAdmin}
                                                                color='red'
                                                            >
                                                                <Icon name='user delete' />
                                                                Delete User
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
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )

}

export default UsersManager;
