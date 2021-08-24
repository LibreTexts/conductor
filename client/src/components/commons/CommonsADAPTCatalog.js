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
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';

import Breakpoint from '../util/Breakpoints.js';
import useGlobalError from '../error/ErrorHooks.js';
import { itemsPerPageOptions } from '../util/PaginationOptions.js';
import { truncateString } from '../util/HelperFunctions.js';

const CommonsADAPTCatalog = (_props) => {

    const dispatch = useDispatch();
    const { handleGlobalError } = useGlobalError();

    // UI
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [activePage, setActivePage] = useState(1);
    const [loadedCourses, setLoadedCourses] = useState(false);
    const [searchString, setSearchString] = useState('');
    const displayChoice = useSelector((state) => state.filters.adaptCatalog.mode);

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

    const displayOptions = [
        { key: 'visual', text: 'Visual Mode', value: 'visual' },
        { key: 'itemized', text: 'Itemized Mode', value: 'itemized' }
    ];

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

    const closeCourseViewModal = () => {
        setShowCourseModal(false);
        setCourseModalTitle('');
        setCourseModalDescrip('');
        setCourseModalAsgmts([]);
    };

    useEffect(getADAPTCourses, []);

    useEffect(() => {
        setTotalPages(Math.ceil(adaptCourses.length/itemsPerPage));
        setPageCourses(adaptCourses.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage));
    }, [itemsPerPage, adaptCourses, activePage]);

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
                setActivePage(1);
            }
        } else {
            setAdaptCourses(origCourses);
        }
    }, [searchString, origCourses, activePage]);

    const VisualMode = () => {
        if (pageCourses.length > 0) {
            return (
                <Card.Group itemsPerRow={5} stackable>
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
        if (pageCourses.length > 0) {
            return (
                <Table celled>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell width={6}><Header sub>Name</Header></Table.HeaderCell>
                            <Table.HeaderCell width={10}><Header sub>Description</Header></Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {pageCourses.map((item, index) => {
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
                        })}
                    </Table.Body>
                </Table>
            )
        } else {
            return (
                <p className='text-center'><em>No results found.</em></p>
            )
        }
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
                                            options={itemsPerPageOptions}
                                            onChange={(_e, { value }) => { setItemsPerPage(value) }}
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
                                            options={displayOptions}
                                            onChange={(_e, { value }) => {
                                                dispatch({
                                                    type: 'SET_ADAPT_MODE',
                                                    payload: value
                                                });
                                            }}
                                            value={displayChoice}
                                        />
                                        <Pagination
                                            activePage={activePage}
                                            totalPages={totalPages}
                                            firstItem={null}
                                            lastItem={null}
                                            onPageChange={(_e, data) => { setActivePage(data.activePage) }}
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
                                                    options={itemsPerPageOptions}
                                                    onChange={(_e, { value }) => { setItemsPerPage(value) }}
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
                                                options={displayOptions}
                                                onChange={(_e, { value }) => {
                                                    dispatch({
                                                        type: 'SET_ADAPT_MODE',
                                                        payload: value
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
                                                onPageChange={(_e, data) => { setActivePage(data.activePage) }}
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
                            <Button onClick={closeCourseViewModal}>Close</Button>
                        </Modal.Actions>
                    </Modal>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )
}

export default CommonsADAPTCatalog;
