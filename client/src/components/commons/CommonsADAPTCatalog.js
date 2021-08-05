import './Commons.css';

import { Grid, Dropdown, Segment, Input, Pagination, Card, Popup } from 'semantic-ui-react';
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

    // Data
    const [adaptCourses, setAdaptCourses] = useState([]);
    const [pageCourses, setPageCourses] = useState([]);

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
                        <Segment className='commons-content' loading={!loadedCourses}>
                            {(pageCourses.length > 0) &&
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
                            }
                            {(pageCourses.length === 0) &&
                                <p className='text-center'><em>No courses available right now.</em></p>
                            }
                        </Segment>
                    </Segment.Group>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )
}

export default CommonsADAPTCatalog;
