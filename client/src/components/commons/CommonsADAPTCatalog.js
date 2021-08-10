import './Commons.css';

import {
    Grid,
    Dropdown,
    Segment,
    Input,
    Pagination,
    Card,
    Popup,
    Table,
    Header
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import axios from 'axios';

import useGlobalError from '../error/ErrorHooks.js';
import { itemsPerPageOptions } from '../util/PaginationOptions.js';

const CommonsADAPTCatalog = (_props) => {

    const { setError } = useGlobalError();

    // UI
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [activePage, setActivePage] = useState(1);
    const [loadedCourses, setLoadedCourses] = useState(false);
    const [searchString, setSearchString] = useState('');
    const [displayChoice, setDisplayChoice] = useState('visual');

    // Data
    const [origCourses, setOrigCourses] = useState([]);
    const [adaptCourses, setAdaptCourses] = useState([]);
    const [pageCourses, setPageCourses] = useState([]);

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
            setError(err);
        });
    };

    useEffect(getADAPTCourses, [setError]);

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

    const truncateString = (str, len) => {
        if (str.length > len) {
            let subString = str.substring(0, len);
            return subString + "...";
        } else {
            return str;
        }
    };

    const VisualMode = () => {
        if (pageCourses.length > 0) {
            return (
                <Card.Group itemsPerRow={5}>
                    {pageCourses.map((item, index) => {
                        return (
                            <Popup key={index} content='More ADAPT integration is coming soon!' position='top center' trigger={
                                <Card
                                    key={index}
                                >
                                    <Card.Content>
                                        <Card.Header>{item.name}</Card.Header>
                                        <Card.Description>
                                            {item.description}
                                        </Card.Description>
                                    </Card.Content>
                                </Card>
                            } />
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
                                        <p><strong>{item.name}</strong></p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <p><em>{truncateString(item.description, 250)}</em></p>
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
                                        onChange={(e, { value }) => { setDisplayChoice(value) }}
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
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )
}

export default CommonsADAPTCatalog;
