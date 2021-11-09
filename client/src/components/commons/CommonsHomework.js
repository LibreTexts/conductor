import './Commons.css';

import {
    Grid,
    Dropdown,
    Segment,
    Input,
    Card,
    Table,
    Header,
    Button,
    Modal,
    List,
    Icon
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import { useLocation, useHistory } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import queryString from 'query-string';

import Breakpoint from '../util/Breakpoints.js';
import ConductorPagination from '../util/ConductorPagination.js';
import useGlobalError from '../error/ErrorHooks.js';
import { catalogDisplayOptions } from '../util/CatalogOptions.js';
import { catalogItemsPerPageOptions } from '../util/PaginationOptions.js';
import {
    truncateString,
    updateParams
} from '../util/HelperFunctions.js';

const CommonsHomework = (_props) => {

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
    const [courseModalID, setCourseModalID] = useState('');
    const [courseModalTitle, setCourseModalTitle] = useState('');
    const [courseModalDescrip, setCourseModalDescrip] = useState('');
    const [courseModalAsgmts, setCourseModalAsgmts] = useState([]);
    const [courseModalOpenCourse, setCourseModalOpenCourse] = useState(false);

    /**
     * Retrieve ADAPT Commons courses from the server
     * via GET request.
     */
    const getADAPTCourses = () => {
        setLoadedCourses(false);
        axios.get('/commons/homework/adapt').then((res) => {
            if (!res.data.err) {
                if (res.data.courses && Array.isArray(res.data.courses)) {
                    setAdaptCourses(res.data.courses);
                    setOrigCourses(res.data.courses);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedCourses(true);
        }).catch((err) => {
            handleGlobalError(err);
        });
    };

    /**
     * Open the Course View modal and populate
     * information for the given @courseID
     */
    const openCourseViewModal = (courseID) => {
        var course = adaptCourses.find((element) => {
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

    /**
     * Run getADAPTCourses() on page load.
     */
    useEffect(() => {
        document.title = "LibreCommons | Homework Resources"
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
                const descripString = String(course.title + " " + course.description).toLowerCase();
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
                                    <Card.Header as='h3' className='commons-content-card-header'>{item.title}</Card.Header>
                                    <Card.Description>
                                        {truncateString(item.description, 250)}
                                    </Card.Description>
                                </Card.Content>
                                <Card.Content extra>
                                    <Button
                                        color='blue'
                                        fluid
                                        onClick={() => { openCourseViewModal(item.hwID) }}
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
            <Table celled title='All Homework'>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell width={6} scope='col'><Header sub>Name</Header></Table.HeaderCell>
                        <Table.HeaderCell width={10} scope='col'><Header sub>Description</Header></Table.HeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {(pageCourses.length > 0) &&
                        pageCourses.map((item, index) => {
                            return (
                                <Table.Row key={index}>
                                    <Table.Cell>
                                        <p
                                            onClick={() => { return openCourseViewModal(item.hwID); }}
                                            className='text-link'
                                            tabIndex={0}
                                        >
                                            <strong>{item.title}</strong>
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
                        <Segment>
                            <Breakpoint name='desktop'>
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
                            </Breakpoint>
                            <Breakpoint name='mobileOrTablet'>
                                <Grid>
                                    <Grid.Row columns={1}>
                                        <Grid.Column>
                                            <p className='text-center'>Courses listed here are part of the LibreTexts Adaptive Learning Assessment System, <a href='https://adapt.libretexts.org' target='_blank' rel='noopener noreferrer'>ADAPT</a>.</p>
                                        </Grid.Column>
                                    </Grid.Row>
                                    <Grid.Row columns={1}>
                                        <Grid.Column>
                                            <Input
                                                fluid
                                                icon='search'
                                                placeholder='Search courses...'
                                                onChange={(e) => { setSearchString(e.target.value) }}
                                                value={searchString}
                                            />
                                        </Grid.Column>
                                    </Grid.Row>
                                </Grid>
                            </Breakpoint>
                        </Segment>
                        <Segment>
                            <Breakpoint name='desktop'>
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
                                            aria-label='Number of results to display per page'
                                        />
                                        <span> items per page of <strong>{adaptCourses.length}</strong> results, sorted by name.</span>
                                    </div>
                                    <div className='commons-content-pagemenu-center'>
                                        <ConductorPagination
                                            activePage={activePage}
                                            totalPages={totalPages}
                                            firstItem={null}
                                            lastItem={null}
                                            onPageChange={(newActivePage) => {
                                                dispatch({
                                                    type: 'SET_ADAPT_PAGE',
                                                    payload: newActivePage
                                                });
                                            }}
                                        />
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
                                            aria-label='Set results display mode'
                                        />
                                    </div>
                                </div>
                            </Breakpoint>
                            <Breakpoint name='mobileOrTablet'>
                                <Grid>
                                    <Grid.Row columns={1}>
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
                                                aria-label='Set results display mode'
                                            />
                                        </Grid.Column>
                                    </Grid.Row>
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
                                                    aria-label='Number of results to display per page'
                                                />
                                                <span> items per page of <strong>{adaptCourses.length}</strong> results.</span>
                                            </div>
                                        </Grid.Column>
                                    </Grid.Row>
                                    <Grid.Row columns={1}>
                                        <Grid.Column className='commons-pagination-mobile-container'>
                                            <ConductorPagination
                                                activePage={activePage}
                                                totalPages={totalPages}
                                                firstItem={null}
                                                lastItem={null}
                                                onPageChange={(newActivePage) => {
                                                    dispatch({
                                                        type: 'SET_ADAPT_PAGE',
                                                        payload: newActivePage
                                                    });
                                                }}
                                            />
                                        </Grid.Column>
                                    </Grid.Row>
                                </Grid>
                            </Breakpoint>
                        </Segment>
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
                        <Segment>
                            <Breakpoint name='desktop'>
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
                                            aria-label='Number of results to display per page'
                                        />
                                        <span> items per page of <strong>{adaptCourses.length}</strong> results, sorted by name.</span>
                                    </div>
                                    <div className='commons-content-pagemenu-right'>
                                        <ConductorPagination
                                            activePage={activePage}
                                            totalPages={totalPages}
                                            firstItem={null}
                                            lastItem={null}
                                            onPageChange={(newActivePage) => {
                                                dispatch({
                                                    type: 'SET_ADAPT_PAGE',
                                                    payload: newActivePage
                                                });
                                            }}
                                        />
                                    </div>
                                </div>
                            </Breakpoint>
                            <Breakpoint name='mobileOrTablet'>
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
                                                    aria-label='Number of results to display per page'
                                                />
                                                <span> items per page of <strong>{adaptCourses.length}</strong> results.</span>
                                            </div>
                                        </Grid.Column>
                                    </Grid.Row>
                                    <Grid.Row columns={1}>
                                        <Grid.Column className='commons-pagination-mobile-container'>
                                            <ConductorPagination
                                                activePage={activePage}
                                                totalPages={totalPages}
                                                firstItem={null}
                                                lastItem={null}
                                                onPageChange={(newActivePage) => {
                                                    dispatch({
                                                        type: 'SET_ADAPT_PAGE',
                                                        payload: newActivePage
                                                    });
                                                }}
                                            />
                                        </Grid.Column>
                                    </Grid.Row>
                                </Grid>
                            </Breakpoint>
                        </Segment>
                    </Segment.Group>
                    <Modal
                        open={showCourseModal}
                        onClose={closeCourseViewModal}
                    >
                        <Modal.Header as='h2'>{courseModalTitle}</Modal.Header>
                        <Modal.Content scrolling tabIndex={0}>
                            <Header size='small' dividing as='h3'>Description</Header>
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
                            <Header size='small' dividing as='h3'>Assignments</Header>
                            <Segment
                                basic
                            >
                                {(courseModalAsgmts.length > 0) &&
                                    <List bulleted>
                                        {courseModalAsgmts.map((item, idx) => {
                                            return (
                                                <List.Item
                                                    key={idx}
                                                    className='item'
                                                    content={
                                                        <span className='ml-05p'>{item.title}</span>
                                                    }
                                                />
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

export default CommonsHomework;
