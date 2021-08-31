import './SupervisorDashboard.css';

import { DateInput } from 'semantic-ui-calendar-react';
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
  Input
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';

import {
    isEmptyString,
} from '../util/HelperFunctions.js';
import { itemsPerPageOptions } from '../util/PaginationOptions.js';
import useGlobalError from '../error/ErrorHooks.js';

const CollectionsManager = (props) => {

    // Global State
    const { handleGlobalError } = useGlobalError();
    const org = useSelector((state) => state.org);

    // Data
    const [collections, setCollections] = useState([]);
    const [displayColls, setDisplayColls] = useState([]);
    const [pageColls, setPageColls] = useState([]);

    // UI
    const [activePage, setActivePage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [loadedData, setLoadedData] = useState(false);
    const [searchString, setSearchString] = useState('');
    const [sortChoice, setSortChoice] = useState('title');

    // Create/Edit Collection Modal
    const [showEditCollModal, setShowEditCollModal] = useState(false);
    const [editCollCreate, setEditCollCreate] = useState(false);
    const [editCollID, setEditCollID] = useState('');
    const [editCollTitle, setEditCollTitle] = useState('');
    const [editCollPhoto, setEditCollPhoto] = useState('');
    const [editCollOrigTitle, setEditCollOrigTitle] = useState('');
    const [editCollOrigPhoto, setEditCollOrigPhoto] = useState('');
    const [editCollTitleErr, setEditCollTitleErr] = useState(false);
    const [editCollLoading, setEditCollLoading] = useState(false);

    // Toggle Collection Status Modal
    const [showCollStatusModal, setShowCollStatusModal] = useState(false);
    const [collStatusID, setCollStatusID] = useState('');
    const [collStatusCurrent, setCollStatusCurrent] = useState(false);
    const [collStatusLoading, setCollStatusLoading] = useState(false);

    useEffect(() => {
        document.title = "LibreTexts Conductor | Collections Manager";
        date.plugin(ordinal);
        getCollections();
    }, []);

    const sortOptions = [
        { key: 'title', text: 'Sort by Title', value: 'title' },
        { key: 'resources', text: 'Sort by Number of Resources', value: 'resources' }
    ];


    useEffect(() => {
        setTotalPages(Math.ceil(displayColls.length/itemsPerPage));
        setPageColls(displayColls.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage));
    }, [itemsPerPage, displayColls, activePage]);

    /**
     * Filter and sort collections according to
     * user's choices, then update the list.
     */
    useEffect(() => {
        filterAndSortColls();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collections, searchString, sortChoice]);

    const getCollections = () => {
        axios.get('/commons/collections').then((res) => {
            if (!res.data.err) {
                if (res.data.colls && Array.isArray(res.data.colls) && res.data.colls.length > 0) {
                    setCollections(res.data.colls);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedData(true);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedData(true);
        });
    };

    /**
     * Filter and sort collections according
     * to current filters and sort
     * choice.
     */
    const filterAndSortColls = () => {
        setLoadedData(false);
        let filtered = collections.filter((coll) => {
            var include = true;
            var descripString = String(coll.title).toLowerCase();
            if (searchString !== '' && String(descripString).indexOf(String(searchString).toLowerCase()) === -1) {
                include = false;
            }
            if (include) {
                return coll;
            } else {
                return false;
            }
        })
        if (sortChoice === 'title') {
            const sorted = [...filtered].sort((a, b) => {
                var normalA = String(a.title).toLowerCase().replace(/[^A-Za-z]+/g, "");
                var normalB = String(b.title).toLowerCase().replace(/[^A-Za-z]+/g, "");
                if (normalA < normalB) {
                    return -1;
                }
                if (normalA > normalB) {
                    return 1;
                }
                return 0;
            });
            setDisplayColls(sorted);
        } else if (sortChoice === 'resources') {
            const sorted = [...filtered].sort((a, b) => {
                if (a.resources < b.resources) {
                    return -1;
                }
                if (a.resources > b.resources) {
                    return 1;
                }
                return 0;
            });
            setDisplayColls(sorted);
        }
        setLoadedData(true);
    }

    const resetEditCollForm = () => {
        setEditCollTitleErr(false);
    };

    const validateEditCollForm = () => {
        var validForm = true;
        if (isEmptyString(editCollTitle) || String(editCollTitle).length < 3) {
            validForm = false;
            setEditCollTitleErr(true);
        }
        return validForm;
    };

    const submitEditCollForm = () => {
        resetEditCollForm();
        if (validateEditCollForm()) {
            setEditCollLoading(true);
            var collData = {};
            var axiosReq;
            if (editCollCreate) {
                collData.title = editCollTitle;
                if (!isEmptyString(editCollPhoto)) {
                    collData.coverPhoto = editCollPhoto;
                }
                axiosReq = axios.post('/commons/collection/create', collData);
            } else {
                collData.collID = editCollID;
                if (editCollTitle !== editCollOrigTitle) {
                    collData.title = editCollTitle;
                }
                if (editCollPhoto !== editCollOrigPhoto) {
                    collData.coverPhoto = editCollPhoto;
                }
                axiosReq = axios.put('/commons/collection/edit', collData);
            }
            axiosReq.then((res) => {
                if (!res.data.err) {
                    closeEditCollModal();
                    getCollections();
                } else {
                    handleGlobalError(res.data.errMsg);
                }
                setEditCollLoading(false);
            }).catch((err) => {
                handleGlobalError(err);
                setEditCollLoading(false);
            });
        }
    };

    const openCreateCollModal = () => {
        setShowEditCollModal(true);
        setEditCollCreate(true);
        setEditCollTitle('');
        setEditCollOrigTitle('');
        setEditCollPhoto('');
        setEditCollOrigPhoto('');
        resetEditCollForm();
    };

    const openEditCollModal = (collID, collTitle, collPhoto) => {
        setShowEditCollModal(true);
        setEditCollCreate(false);
        setEditCollID(collID)
        setEditCollTitle(collTitle);
        setEditCollOrigTitle(collTitle);
        setEditCollPhoto(collPhoto);
        setEditCollOrigPhoto(collPhoto);
        resetEditCollForm();
    };

    const closeEditCollModal = () => {
        setShowEditCollModal(false);
        setEditCollCreate(false);
        setEditCollID('');
        setEditCollTitle('');
        setEditCollOrigTitle('');
        setEditCollPhoto('');
        setEditCollOrigPhoto('');
        resetEditCollForm();
    };

    const toggleCollectionStatus = () => {
        if (collStatusID !== '') {
            setCollStatusLoading(true);
            axios.put('/commons/collection/togglestatus', {
                collID: collStatusID
            }).then((res) => {
                if (!res.data.err) {
                    closeCollStatusModal();
                    getCollections();
                } else {
                    handleGlobalError(res.data.errMsg);
                }
                setCollStatusLoading(false);
            }).catch((err) => {
                handleGlobalError(err);
                setCollStatusLoading(false);
            });
        }
    };

    const openCollStatusModal = (collID, collStatus) => {
        if ((collID !== undefined) && (collID !== null) && (collID !== undefined) && (collID !== null)) {
            setShowCollStatusModal(true);
            setCollStatusID(collID);
            setCollStatusCurrent(collStatus);
        }
    };

    const closeCollStatusModal = () => {
        setShowCollStatusModal(false);
        setCollStatusID('');
        setCollStatusCurrent(false);
    };

    return (
        <Grid className='component-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Collections Manager</Header>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Segment.Group>
                        <Segment>
                            <div className='flex-row-div'>
                                <div className='left-flex'>
                                    <Dropdown
                                        placeholder='Sort by...'
                                        floating
                                        selection
                                        button
                                        options={sortOptions}
                                        onChange={(_e, { value }) => { setSortChoice(value) }}
                                        value={sortChoice}
                                    />
                                    <Input
                                        icon='search'
                                        placeholder='Search...'
                                        onChange={(e) => { setSearchString(e.target.value) }}
                                        value={searchString}
                                    />
                                </div>
                                <div className='right-flex'>
                                    <Button
                                        color='green'
                                        className='float-right'
                                        onClick={openCreateCollModal}
                                    >
                                        <Icon name='add' />
                                        Create Collection
                                    </Button>
                                </div>
                            </div>
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
                                    <span> items per page of <strong>{Number(collections.length).toLocaleString()}</strong> results.</span>
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
                                        <Table.HeaderCell colSpan='3'>
                                            {(sortChoice === 'title')
                                                ? <span><em>Collection Title</em></span>
                                                : <span>Collection Title</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'resources')
                                                ? <span><em>Number of Resources</em></span>
                                                : <span>Number of Resources</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Actions</span>
                                        </Table.HeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {(pageColls.length > 0) &&
                                        pageColls.map((item, index) => {
                                            return (
                                                <Table.Row key={index}>
                                                    <Table.Cell colSpan='3'>
                                                        <p><strong>{item.title}</strong></p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p>{item.resources}</p>
                                                    </Table.Cell>
                                                    <Table.Cell textAlign='center'>
                                                        <Button.Group vertical fluid>
                                                            <Button
                                                                color='blue'
                                                                onClick={() => { openEditCollModal(item.collID, item.title, item.coverPhoto) }}
                                                            >
                                                                <Icon name='edit' />
                                                                Edit Collection Details
                                                            </Button>
                                                            <Button color='teal'>
                                                                <Icon name='list alternate outline' />
                                                                Manage Resources
                                                            </Button>
                                                            {(item.enabled)
                                                                ? (
                                                                    <Button
                                                                        color='red'
                                                                        onClick={() => { openCollStatusModal(item.collID, item.enabled) }}
                                                                    >
                                                                        <Icon name='eye slash' />
                                                                        Disable Collection
                                                                    </Button>
                                                                )
                                                                : (
                                                                    <Button
                                                                        color='green'
                                                                        onClick={() => { openCollStatusModal(item.collID, item.enabled )}}
                                                                    >
                                                                        <Icon name='eye' />
                                                                        Enable Collection
                                                                    </Button>
                                                                )
                                                            }
                                                        </Button.Group>
                                                    </Table.Cell>
                                                </Table.Row>
                                            )
                                        })
                                    }
                                    {(pageColls.length === 0) &&
                                        <Table.Row>
                                            <Table.Cell colSpan='3'>
                                                <p className='text-center'><em>No results found.</em></p>
                                            </Table.Cell>
                                        </Table.Row>
                                    }
                                </Table.Body>
                            </Table>
                        </Segment>
                    </Segment.Group>
                    {/* Create/Edit Collection Modal */}
                    <Modal
                        open={showEditCollModal}
                        closeOnDimmerClick={false}
                    >
                        <Modal.Header>{editCollCreate ? 'Create' : 'Edit'} Collection</Modal.Header>
                        <Modal.Content>
                            {(editCollCreate) &&
                                <p><em>This collection will be created inside of <strong>{org.shortName}</strong>. It will automatically be enabled upon creation.</em></p>
                            }
                            <Form noValidate>
                                <Form.Field
                                    error={editCollTitleErr}
                                >
                                    <label>Collection Title</label>
                                    <Input
                                        icon='folder open'
                                        placeholder='Collection Title...'
                                        type='text'
                                        iconPosition='left'
                                        onChange={(e) => { setEditCollTitle(e.target.value) }}
                                        value={editCollTitle}
                                    />
                                </Form.Field>
                                <Form.Field>
                                    <label>Collection Cover Photo URL <em>(direct link to image download)</em></label>
                                    <Input
                                        icon='file image'
                                        placeholder='Collection Cover Photo...'
                                        type='url'
                                        iconPosition='left'
                                        onChange={(e) => { setEditCollPhoto(e.target.value) }}
                                        value={editCollPhoto}
                                    />
                                </Form.Field>
                            </Form>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeEditCollModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                color={editCollCreate ? 'green' : 'blue'}
                                onClick={submitEditCollForm}
                                loading={editCollLoading}
                            >
                                <Icon name={editCollCreate ? 'add' : 'edit'} />
                                Create
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Toggle Collection Status Modal */}
                    <Modal
                        open={showCollStatusModal}
                        closeOnDimmerClick={false}
                    >
                        <Modal.Header>Change Collection Status</Modal.Header>
                        <Modal.Content>
                            {collStatusCurrent
                                ? <p>Are you sure you want to <strong>disable</strong> this collection? It will be hidden from Commons immediately.</p>
                                : <p>Are you sure you want to <strong>enable</strong> this collection? It will be available on Commons immediately.</p>
                            }
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeCollStatusModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                color={collStatusCurrent ? 'red' : 'green'}
                                onClick={toggleCollectionStatus}
                                loading={collStatusLoading}
                            >
                                <Icon name={collStatusCurrent ? 'eye slash' : 'eye'} />
                                {collStatusCurrent ? 'Disable Collection' : 'Enable Collection'}
                            </Button>
                        </Modal.Actions>
                    </Modal>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )

}

export default CollectionsManager;
