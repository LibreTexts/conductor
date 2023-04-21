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
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';

import {
    truncateString
} from '../util/HelperFunctions.js';
import { itemsPerPageOptions } from '../util/PaginationOptions.js';
import useGlobalError from '../error/ErrorHooks';

const HomeworkManager = (_props) => {

    // Global State
    const { handleGlobalError } = useGlobalError();
    const isSuperAdmin = useSelector((state) => state.user.isSuperAdmin);

    // Data
    const [homework, setHomework] = useState([]);
    const [displayHw, setDisplayHw] = useState([]);
    const [pageHw, setPageHw] = useState([]);
    const [syncResponse, setSyncResponse] = useState('');

    // UI
    const [activePage, setActivePage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [loadedData, setLoadedData] = useState(false);
    const [searchString, setSearchString] = useState('');
    const [sortChoice, setSortChoice] = useState('title');

    // Sync Modal
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [syncInProgress, setSyncInProgress] = useState(false);
    const [syncFinished, setSyncFinished] = useState(false);

    // Course View Modal
    const [showCourseModal, setShowCourseModal] = useState(false);
    const [courseModalID, setCourseModalID] = useState('');
    const [courseModalTitle, setCourseModalTitle] = useState('');
    const [courseModalDescrip, setCourseModalDescrip] = useState('');
    const [courseModalAsgmts, setCourseModalAsgmts] = useState([]);
    const [courseModalOpenCourse, setCourseModalOpenCourse] = useState(false);

    useEffect(() => {
        document.title = "LibreTexts Conductor | Homework Manager";
        getHomework();
    }, []);

    const sortOptions = [
        { key: 'title', text: 'Sort by Title', value: 'title' },
        { key: 'description', text: 'Sort by Description', value: 'description' },
        { key: 'type', text: 'Sort by Type', value: 'type' }
    ];


    useEffect(() => {
        setTotalPages(Math.ceil(displayHw.length / itemsPerPage));
        setPageHw(displayHw.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage));
    }, [itemsPerPage, displayHw, activePage]);

    /**
     * Filter and sort homework according to
     * user's choices, then update the list.
     */
    useEffect(() => {
        filterAndSortHws();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [homework, searchString, sortChoice]);

    const getHomework = () => {
        axios.get('/commons/homework/all').then((res) => {
            if (!res.data.err) {
                if (res.data.homework && Array.isArray(res.data.homework)) {
                    setHomework(res.data.homework);
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
     * Filter and sort homework according
     * to current filters and sort
     * choice.
     */
    const filterAndSortHws = () => {
        setLoadedData(false);
        let filtered = homework.filter((hw) => {
            var include = true;
            var descripString = String(hw.title).toLowerCase() + String(hw.description).toLowerCase();
            if (searchString !== '' && String(descripString).indexOf(String(searchString).toLowerCase()) === -1) {
                include = false;
            }
            if (include) {
                return hw;
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
            setDisplayHw(sorted);
        } else if (sortChoice === 'description') {
            const sorted = [...filtered].sort((a, b) => {
                if (a.description < b.description) {
                    return -1;
                }
                if (a.description > b.description) {
                    return 1;
                }
                return 0;
            });
            setDisplayHw(sorted);
        } else if (sortChoice === 'type') {
            const sorted = [...filtered].sort((a, b) => {
                if (a.kind < b.kind) {
                    return -1;
                }
                if (a.kind > b.kind) {
                    return 1;
                }
                return 0;
            });
            setDisplayHw(sorted);
        }
        setLoadedData(true);
    };

    /**
     * Set Sync loading indicators and
     * send a request to the server to
     * sync the Homework Catalog with
     * the ADAPT and H5P providers.
     */
    const syncWithProviders = () => {
        setSyncInProgress(true);
        axios.post('/commons/homework/sync').then((res) => {
            if (!res.data.err) {
                setSyncResponse(res.data.msg);
                getHomework();
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setSyncInProgress(false);
            setSyncFinished(true);
        }).catch((err) => {
            handleGlobalError(err);
            setSyncInProgress(false);
            setSyncFinished(true);
        });
    }

    /**
     * Open the Sync modal and
     * ensure it is reset to
     * initial state.
     */
    const openSyncModal = () => {
        setShowSyncModal(true);
        setSyncInProgress(false);
        setSyncFinished(false);
        setSyncResponse('');
    };

    /**
     * Close the Sync modal and
     * reset to initial state.
     */
    const closeSyncModal = () => {
        setShowSyncModal(false);
        setSyncInProgress(false);
        setSyncFinished(false);
        setSyncResponse('');
    };

    /**
     * Open the Course View modal and populate
     * information for the given @courseID
     */
    const openCourseViewModal = (courseID) => {
        var course = homework.find((element) => {
            return element.hwID === courseID;
        });
        if (course !== undefined) {
            setCourseModalID(course.externalID);
            setCourseModalTitle(course.title);
            setCourseModalDescrip(course.description);
            setCourseModalAsgmts(course.adaptAssignments);
            if (course.hasOwnProperty('adaptOpen')) {
                setCourseModalOpenCourse(course.adaptOpen);
            }
            setShowCourseModal(true);
        }
    };

    /**
     * Close the Course View modal and
     * clear the information.
     */
    const closeCourseViewModal = () => {
        setShowCourseModal(false);
        setCourseModalID('');
        setCourseModalTitle('');
        setCourseModalDescrip('');
        setCourseModalOpenCourse(false);
        setCourseModalAsgmts([]);
    };

    return (
        <Grid className='controlpanel-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Homework Manager</Header>
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
                                    Homework Manager
                                </Breadcrumb.Section>
                            </Breadcrumb>
                        </Segment>
                        <Segment>
                            <div className='flex-row-div'>
                                <div className='left-flex'>
                                    <span className='ml-1p'><strong>Sync Schedule:</strong> Daily at 12:30 AM PST</span>
                                </div>
                                <div className='right-flex'>
                                    {isSuperAdmin &&
                                        <Button
                                            color='blue'
                                            onClick={openSyncModal}
                                        >
                                            <Icon name='sync alternate' />
                                            Sync Homework Systems
                                        </Button>
                                    }
                                </div>
                            </div>
                        </Segment>
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
                                </div>
                                <div className='right-flex'>
                                    <Input
                                        icon='search'
                                        placeholder='Search results...'
                                        onChange={(e) => { setSearchString(e.target.value) }}
                                        value={searchString}
                                    />
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
                                    <span> items per page of <strong>{Number(homework.length).toLocaleString()}</strong> results.</span>
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
                                            {(sortChoice === 'title')
                                                ? <span><em>Resource Title</em></span>
                                                : <span>Resource Title</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'description')
                                                ? <span><em>Resource Description</em></span>
                                                : <span>Resource Description</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'type')
                                                ? <span><em>Resource Type</em></span>
                                                : <span>Resource Type</span>
                                            }
                                        </Table.HeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {(pageHw.length > 0) &&
                                        pageHw.map((item, index) => {
                                            return (
                                                <Table.Row key={index}>
                                                    <Table.Cell>
                                                        <p
                                                            onClick={() => { openCourseViewModal(item.hwID) }}
                                                            className='text-link'
                                                        >
                                                            <strong>{item.title}</strong>
                                                        </p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p>{truncateString(item.description, 150)}</p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p>{String(item.kind).toUpperCase()}</p>
                                                    </Table.Cell>
                                                </Table.Row>
                                            )
                                        })
                                    }
                                    {(pageHw.length === 0) &&
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
                    {/* Homework Systems Sync Modal */}
                    <Modal
                        open={showSyncModal}
                        closeOnDimmerClick={false}
                    >
                        <Modal.Header>Homework Systems Sync</Modal.Header>
                        <Modal.Content>
                            <p><strong>Caution:</strong> you are about to manually sync Homework with: <em>ADAPT Commons</em>. This operation is resource-intensive and should not be performed often.</p>
                            <p><em>This may result in a brief service interruption while the database is updated.</em></p>
                            {!syncFinished &&
                                <Button
                                    color='blue'
                                    onClick={syncWithProviders}
                                    fluid
                                    loading={syncInProgress}
                                >
                                    <Icon name='sync alternate' />
                                    Sync Homework Systems
                                </Button>
                            }
                            {(syncInProgress) &&
                                <p className='text-center mt-1p'><strong>Sync Status:</strong> <em>In progress...</em></p>
                            }
                            {(syncResponse !== '') &&
                                <p className='text-center mt-1p'><strong>Sync Status:</strong> {syncResponse}</p>
                            }
                        </Modal.Content>
                        <Modal.Actions>
                            {!syncFinished &&
                                <Button
                                    onClick={closeSyncModal}
                                    disabled={syncInProgress}
                                >
                                    Cancel
                                </Button>
                            }
                            {syncFinished &&
                                <Button
                                    onClick={closeSyncModal}
                                    disabled={syncInProgress}
                                    color='blue'
                                >
                                    Done
                                </Button>
                            }
                        </Modal.Actions>
                    </Modal>
                    {/* Course View Modal */}
                    <Modal
                        open={showCourseModal}
                        onClose={closeCourseViewModal}
                    >
                        <Modal.Header>{courseModalTitle}</Modal.Header>
                        <Modal.Content scrolling>
                            <Header size='small' dividing>Description</Header>
                            <p>{courseModalDescrip}</p>
                            {courseModalOpenCourse &&
                                <div>
                                    <p><em>This course is open for anonymous viewing.</em></p>
                                    <Button
                                        color='blue'
                                        fluid
                                        as='a'
                                        href={`https://adapt.libretexts.org/courses/${courseModalID}/anonymous`}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                    >
                                        <Icon name='external' />
                                        View Course
                                    </Button>
                                </div>
                            }
                            <Header size='small' dividing>Assignments</Header>
                            <Segment
                                basic
                            >
                                {(courseModalAsgmts.length > 0) &&
                                    <List bulleted>
                                        {courseModalAsgmts.map((item, idx) => {
                                            return (
                                                <List.Item key={idx}>{item.title}</List.Item>
                                            )
                                        })}
                                    </List>
                                }
                                {(courseModalAsgmts.length === 0) &&
                                    <p><em>No assignments found.</em></p>
                                }
                            </Segment>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button color='blue' onClick={closeCourseViewModal}>Done</Button>
                        </Modal.Actions>
                    </Modal>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )

}

export default HomeworkManager;
