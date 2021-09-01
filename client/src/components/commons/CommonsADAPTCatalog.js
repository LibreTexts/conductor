import './Commons.css';

import {
    Grid,
    Dropdown,
    Segment,
    Input,
    Pagination,
    Card,
    Table,
    Header,
    Button,
    Modal,
    List
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import { useLocation, useHistory } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import queryString from 'query-string';

import Breakpoint from '../util/Breakpoints.js';
import useGlobalError from '../error/ErrorHooks.js';
import { catalogDisplayOptions } from '../util/CatalogOptions.js';
import { catalogItemsPerPageOptions } from '../util/PaginationOptions.js';
import {
    truncateString,
    updateParams
} from '../util/HelperFunctions.js';

const CommonsADAPTCatalog = (_props) => {

    // Global State and Location/History
    const dispatch = useDispatch();
    const location = useLocation();
    const history = useHistory();
    const { handleGlobalError } = useGlobalError();

    // UI
    const itemsPerPage = useSelector((state) => state.filters.adaptCatalog.itemsPerPage);
    const activePage = useSelector((state) => state.filters.adaptCatalog.activePage);
    const displayChoice = useSelector((state) => state.filters.adaptCatalog.mode);
    const [totalPages, setTotalPages] = useState(1);
    const [loadedCourses, setLoadedCourses] = useState(false);
    const [searchString, setSearchString] = useState('');

    // Data
    const [origCourses, setOrigCourses] = useState([]);
    const [adaptCourses, setAdaptCourses] = useState([]);
    const [pageCourses, setPageCourses] = useState([]);

    // Course View Modal
    const [showCourseModal, setShowCourseModal] = useState(false);
    const [courseModalTitle, setCourseModalTitle] = useState('');
    const [courseModalDescrip, setCourseModalDescrip] = useState('');
    const [courseModalAsgmts, setCourseModalAsgmts] = useState([]);
    const [courseModalLoaded, setCourseModalLoaded] = useState(true);

    /**
     * Retrieve Commons courses from the ADAPT server
     * via GET request.
     */
    const getADAPTCourses = () => {
        axios.get('https://adapt.libretexts.org/api/courses/commons', {
            withCredentials: false
        }).then((res) => {
            if (res.data && res.data.type === 'success') {
                if (res.data.commons_courses && Array.isArray(res.data.commons_courses)) {
                    let sorted = [...res.data.commons_courses].sort((a, b) => {
                        if (a.name < b.name) {
                            return -1;
                        }
                        if (a.name > b.name) {
                            return 1;
                        }
                        return 0;
                    });
                    setAdaptCourses(sorted);
                    setOrigCourses(sorted);
                } else {
                    throw(new Error("Sorry, we're having trouble displaying this data."))
                }
            } else {
                throw(new Error("Sorry, we're having trouble loading this information."));
            }
            setLoadedCourses(true);
        }).catch((err) => {
            handleGlobalError(err);
        });
    };

    /**
     * Retrieve assignments for a specific @courseID from the
     * ADAPT server via GET request.
     */
    const getADAPTCourseAssignments = (courseID) => {
        setCourseModalLoaded(false);
        var reqURL = "https://adapt.libretexts.org/api/assignments/commons/" + courseID;
        axios.get(reqURL, {
            withCredentials: false
        }).then((res) => {
            if (res.data && res.data.type === 'success') {
                if (res.data.assignments && Array.isArray(res.data.assignments)) {
                    var assignments = res.data.assignments.map((item) => {
                        if (item.assignment_id) {
                            delete item.assignment_id;
                        }
                        if (item.description) {
                            delete item.description;
                        }
                        return item;
                    });
                    setCourseModalAsgmts(assignments);
                } else {
                    throw(new Error("Sorry, we're having trouble displaying this data."))
                }
            } else {
                throw(new Error("Sorry, we're having trouble loading this information."));
            }
            setCourseModalLoaded(true);
        }).catch((err) => {
            handleGlobalError(err);
            setCourseModalLoaded(true);
        });
    };

    /**
     * Open the Course View modal and populate
     * information for the given @courseID
     */
    const openCourseViewModal = (courseID) => {
        var course = adaptCourses.find((element) => {
            return element.id === courseID;
        });
        if (course !== undefined) {
            getADAPTCourseAssignments(courseID);
            setShowCourseModal(true);
            setCourseModalTitle(course.name);
            setCourseModalDescrip(course.description);
        }
    };

    /**
     * Close the Course View modal and
     * clear the information.
     */
    const closeCourseViewModal = () => {
        setShowCourseModal(false);
        setCourseModalTitle('');
        setCourseModalDescrip('');
        setCourseModalAsgmts([]);
    };

    /**
     * Run getADAPTCourses() on page load.
     */
    useEffect(() => {
        document.title = "LibreCommons | ADAPT Courses"
        getADAPTCourses();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Subscribe to changes in the URL search string
     * and update state accordingly.
     */
    useEffect(() => {
        var params = queryString.parse(location.search);
        if (params.mode && params.mode !== displayChoice) {
            if ((params.mode === 'visual') || (params.mode === 'itemized')) {
                dispatch({
                    type: 'SET_ADAPT_MODE',
                    payload: params.mode
                });
            }
        }
        if (params.items && params.items !== itemsPerPage) {
            if (!isNaN(parseInt(params.items))) {
                dispatch({
                    type: 'SET_ADAPT_ITEMS',
                    payload: parseInt(params.items)
                });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search]);

    /**
     * Track changes to the number of courses loaded
     * and the selected itemsPerPage and update the
     * set of courses to display.
     */
    useEffect(() => {
        setTotalPages(Math.ceil(adaptCourses.length/itemsPerPage));
        setPageCourses(adaptCourses.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage));
        if (itemsPerPage > adaptCourses.length) {
            dispatch({
                type: 'SET_ADAPT_PAGE',
                payload: 1
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemsPerPage, adaptCourses, activePage]);

    /**
     * Track changes to the UI searchString
     * and update the UI with relevant results.
     */
    useEffect(() => {
        if (searchString !== '') {
            let filtered = origCourses.filter((course) => {
                const descripString = String(course.name + " " + course.description).toLowerCase();
                if (descripString.indexOf(String(searchString).toLowerCase()) > -1) {
                    return course;
                } else {
                    return false;
                }
            });
            setAdaptCourses(filtered);
            if (activePage !== 1) {
                dispatch({
                    type: 'SET_ADAPT_PAGE',
                    payload: 1
                });
            }
        } else {
            setAdaptCourses(origCourses);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchString, origCourses, activePage]);

    const VisualMode = () => {
        if (pageCourses.length > 0) {
            return (
                <Card.Group itemsPerRow={6} stackable>
                    {pageCourses.map((item, index) => {
                        return (
                            <Card
                                key={index}
                            >
                                <Card.Content>
                                    <Card.Header>{item.name}</Card.Header>
                                    <Card.Description>
                                        {truncateString(item.description, 250)}
                                    </Card.Description>
                                </Card.Content>
                                <Card.Content extra>
                                    <Button
                                        color='blue'
                                        fluid
                                        onClick={() => { openCourseViewModal(item.id) }}
                                    >
                                        View Assignments
                                    </Button>
                                </Card.Content>
                            </Card>
                        )
                    })}
                </Card.Group>
            )
        } else {
            return (
                <p className='text-center'><em>No courses available right now.</em></p>
            )
        }
    };

    const ItemizedMode = () => {
        return (
            <Table celled>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell width={6}><Header sub>Name</Header></Table.HeaderCell>
                        <Table.HeaderCell width={10}><Header sub>Description</Header></Table.HeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {(pageCourses.length > 0) &&
                        pageCourses.map((item, index) => {
                            return (
                                <Table.Row key={index}>
                                    <Table.Cell>
                                        <p
                                            onClick={() => { openCourseViewModal(item.id) }}
                                            className='text-link'
                                        >
                                            <strong>{item.name}</strong>
                                        </p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <p>{truncateString(item.description, 250)}</p>
                                    </Table.Cell>
                                </Table.Row>
                            )
                        })
                    }
                    {(pageCourses.length === 0) &&
                        <Table.Row>
                            <Table.Cell colSpan='2'>
                                <p className='text-center'><em>No results found.</em></p>
                            </Table.Cell>
                        </Table.Row>
                    }
                </Table.Body>
            </Table>
        )
    };

    return (
        <Grid className='commons-container'>
            <Grid.Row>
                <Grid.Column>
                    <Segment.Group raised>
                        <Breakpoint name='desktop'>
                            <Segment>
                                <Grid>
                                    <Grid.Column width={12} verticalAlign='middle'>
                                        <p>Courses listed here are part of the LibreTexts Adaptive Learning Assessment System, <a href='https://adapt.libretexts.org' target='_blank' rel='noopener noreferrer'>ADAPT</a>.</p>
                                    </Grid.Column>
                                    <Grid.Column width={4}>
                                        <Input
                                            fluid
                                            icon='search'
                                            placeholder='Search courses...'
                                            onChange={(e) => { setSearchString(e.target.value) }}
                                            value={searchString}
                                        />
                                    </Grid.Column>
                                </Grid>
                            </Segment>
                            <Segment>
                                <div className='commons-content-pagemenu'>
                                    <div className='commons-content-pagemenu-left'>
                                        <span>Displaying </span>
                                        <Dropdown
                                            className='commons-content-pagemenu-dropdown'
                                            selection
                                            options={catalogItemsPerPageOptions}
                                            onChange={(_e, { value }) => {
                                                history.push({
                                                    pathname: location.pathname,
                                                    search: updateParams(location.search, 'items', value)
                                                });
                                            }}
                                            value={itemsPerPage}
                                        />
                                        <span> items per page of <strong>{adaptCourses.length}</strong> results, sorted by name.</span>
                                    </div>
                                    <div className='commons-content-pagemenu-right'>
                                        <Dropdown
                                            placeholder='Display mode...'
                                            floating
                                            selection
                                            button
                                            className='float-right'
                                            options={catalogDisplayOptions}
                                            onChange={(_e, { value }) => {
                                                history.push({
                                                    pathname: location.pathname,
                                                    search: updateParams(location.search, 'mode', value)
                                                });
                                            }}
                                            value={displayChoice}
                                        />
                                        <Pagination
                                            activePage={activePage}
                                            totalPages={totalPages}
                                            firstItem={null}
                                            lastItem={null}
                                            onPageChange={(_e, data) => {
                                                dispatch({
                                                    type: 'SET_ADAPT_PAGE',
                                                    payload: data.activePage
                                                });
                                            }}
                                        />
                                    </div>
                                </div>
                            </Segment>
                        </Breakpoint>
                        <Breakpoint name='mobileOrTablet'>
                            <Segment textAlign='center'>
                                <p>Courses listed here are part of the LibreTexts Adaptive Learning Assessment System, <a href='https://adapt.libretexts.org' target='_blank' rel='noopener noreferrer'>ADAPT</a>.</p>
                            </Segment>
                            <Segment>
                                <Input
                                    fluid
                                    icon='search'
                                    placeholder='Search courses...'
                                    onChange={(e) => { setSearchString(e.target.value) }}
                                    value={searchString}
                                />
                            </Segment>
                            <Segment>
                                <Grid>
                                    <Grid.Row columns={1}>
                                        <Grid.Column>
                                            <div className='center-flex flex-wrap'>
                                                <span>Displaying </span>
                                                <Dropdown
                                                    className='commons-content-pagemenu-dropdown'
                                                    selection
                                                    options={catalogItemsPerPageOptions}
                                                    onChange={(_e, { value }) => {
                                                        history.push({
                                                            pathname: location.pathname,
                                                            search: updateParams(location.search, 'items', value)
                                                        });
                                                    }}
                                                    value={itemsPerPage}
                                                />
                                                <span> items per page of <strong>{adaptCourses.length}</strong> results.</span>
                                            </div>
                                        </Grid.Column>
                                    </Grid.Row>
                                    <Grid.Row columns={2}>
                                        <Grid.Column>
                                            <Dropdown
                                                placeholder='Display mode...'
                                                floating
                                                selection
                                                button
                                                className='float-right'
                                                options={catalogDisplayOptions}
                                                onChange={(_e, { value }) => {
                                                    history.push({
                                                        pathname: location.pathname,
                                                        search: updateParams(location.search, 'mode', value)
                                                    });
                                                }}
                                                value={displayChoice}
                                                fluid
                                            />
                                        </Grid.Column>
                                        <Grid.Column>
                                            <Pagination
                                                activePage={activePage}
                                                totalPages={totalPages}
                                                firstItem={null}
                                                lastItem={null}
                                                onPageChange={(_e, data) => {
                                                    dispatch({
                                                        type: 'SET_ADAPT_PAGE',
                                                        payload: data.activePage
                                                    });
                                                }}
                                                className='float-right'
                                            />
                                        </Grid.Column>
                                    </Grid.Row>
                                </Grid>
                            </Segment>
                        </Breakpoint>
                        {(displayChoice === 'visual')
                            ? (
                                <Segment className='commons-content' loading={!loadedCourses}>
                                    <VisualMode />
                                </Segment>
                            )
                            : (
                                <Segment className='commons-content commons-content-itemized' loading={!loadedCourses}>
                                    <ItemizedMode />
                                </Segment>
                            )
                        }
                    </Segment.Group>
                    <Modal
                        open={showCourseModal}
                        onClose={closeCourseViewModal}
                    >
                        <Modal.Header>{courseModalTitle}</Modal.Header>
                        <Modal.Content scrolling>
                            <Header size='small' dividing>Description</Header>
                            <p>{courseModalDescrip}</p>
                            <Header size='small' dividing>Assignments</Header>
                            <Segment
                                basic
                                loading={!courseModalLoaded}
                                padded={!courseModalLoaded}
                            >
                                {(courseModalLoaded && courseModalAsgmts.length > 0) &&
                                    <List bulleted>
                                        {courseModalAsgmts.map((item, idx) => {
                                            return (
                                                <List.Item key={idx}>{item.name}</List.Item>
                                            )
                                        })}
                                    </List>
                                }
                                {(courseModalLoaded && courseModalAsgmts.length === 0) &&
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

export default CommonsADAPTCatalog;
