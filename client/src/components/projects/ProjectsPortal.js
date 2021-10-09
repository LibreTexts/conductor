import './Projects.css';

import {
  Grid,
  Header,
  Menu,
  Input,
  Segment,
  Divider,
  Message,
  Icon,
  Button,
  Table,
  Loader,
  Dropdown,
  Pagination
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import queryString from 'query-string';

import { itemsPerPageOptions } from '../util/PaginationOptions.js';
import { getClassificationText } from '../util/ProjectOptions.js';
import useGlobalError from '../error/ErrorHooks.js';

const ProjectsPortal = (props) => {

    // Global Error Handling
    const { handleGlobalError } = useGlobalError();

    // UI
    const [loadedProjects, setLoadedProjects] = useState(true);
    const [searchString, setSearchString] = useState('');
    const [sortChoice, setSortChoice] = useState('title');


    const [projectCreated, setProjectCreated] = useState(false);
    const [projectDeleted, setProjectDeleted] = useState(false);

    // Projects Data
    const [projects, setProjects] = useState([]);
    const [displayProjects, setDisplayProjects] = useState([]);

    useEffect(() => {
        date.plugin(ordinal);
        getUserProjects();
    }, []);

    useEffect(() => {
        document.title = "LibreTexts Conductor | Projects";
        const queryValues = queryString.parse(props.location.search);
        if (queryValues.projectCreated === "true") {
            setProjectCreated(true);
        }
        if (queryValues.projectDeleted === "true") {
            setProjectDeleted(true);
        }
    }, [props.location.search]);


    /**
     * Track changes to the number of projects loaded
     * and the selected itemsPerPage and update the
     * set of projects to display.
     */
     /*
    useEffect(() => {
        setTotalPages(Math.ceil(displayProjects.length/itemsPerPage));
        setPageProjects(displayProjects.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage));
    }, [itemsPerPage, displayProjects, activePage]);
    */


    /**
     * Filter and sort projects according to
     * user's choices, then update the list.
     */
    useEffect(() => {
        filterAndSortProjs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projects, searchString, sortChoice]);


    /**
     * Filter and sort projects according to
     * current filters and sort choice.
     */
    const filterAndSortProjs = () => {
        setLoadedProjects(false);
        let filtered = projects.filter((proj) => {
            var include = true;
            var descripString = String(proj.title).toLowerCase();
            if (searchString !== '' && String(descripString).indexOf(String(searchString).toLowerCase()) === -1) {
                include = false;
            }
            if (include) {
                return proj;
            } else {
                return false;
            }
        });
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
            setDisplayProjects(sorted);
        }
        setLoadedProjects(true);
    };



    const getUserProjects = () => {
        setLoadedProjects(false);
        axios.get('/projects/all').then((res) => {
            if (!res.data.err) {
                if (res.data.projects && Array.isArray(res.data.projects)) {
                    setProjects(res.data.projects);
                    console.log(res.data.projects);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedProjects(false);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedProjects(false);
        });
    };


    return(
        <Grid className='component-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Projects</Header>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column width={16}>
                    {projectCreated &&
                        <Message floating icon success>
                            <Icon name='check' />
                            <Message.Content>
                                <Message.Header>Project successfully created!</Message.Header>
                            </Message.Content>
                        </Message>
                    }
                    {projectDeleted &&
                        <Message floating icon info>
                            <Icon name='delete' />
                            <Message.Content>
                                <Message.Header>Project successfully deleted.</Message.Header>
                            </Message.Content>
                        </Message>
                    }
                    <Menu widths={2}>
                        <Menu.Item as={Link} to='/projects/available' name='availableprojects' icon='folder open' content={<p>Available Projects</p>} />
                        <Menu.Item as={Link} to='/projects/completed' name='completedprojects' icon='check' content={<p>Completed Projects</p>} />
                    </Menu>
                    <Segment.Group>
                        <Segment>
                            <Input
                                icon='search'
                                iconPosition='left'
                                placeholder='Search current projects...'
                                onChange={(e) => { setSearchString(e.target.value) }}
                                value={searchString}
                            />
                            <Button
                                as={Link}
                                to='/projects/create'
                                floated='right'
                                color='green'
                            >
                                <Button.Content>
                                    <Icon name='add' />
                                    Create a Project
                                </Button.Content>
                            </Button>
                        </Segment>
                        <Segment loading={!loadedProjects}>
                            <Table celled>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.HeaderCell><Header sub>Title</Header></Table.HeaderCell>
                                        <Table.HeaderCell><Header sub>Current Progress</Header></Table.HeaderCell>
                                        <Table.HeaderCell><Header sub>Classification</Header></Table.HeaderCell>
                                        <Table.HeaderCell><Header sub>Owner</Header></Table.HeaderCell>
                                        <Table.HeaderCell><Header sub>Last Updated</Header></Table.HeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {(displayProjects.length > 0) &&
                                        displayProjects.map((item, index) => {
                                            const itemDate = new Date(item.updatedAt);
                                            item.updatedDate = date.format(itemDate, 'MMM DDD, YYYY');
                                            item.updatedTime = date.format(itemDate, 'h:mm A');
                                            let projectOwner = 'Unknown User';
                                            if (item.owner?.firstName && item.owner?.lastName) {
                                                projectOwner = item.owner.firstName + ' ' + item.owner.lastName;
                                            }
                                            return (
                                                <Table.Row key={index}>
                                                    <Table.Cell>
                                                        <p><strong><Link to={`/projects/${item.projectID}`}>{item.title}</Link></strong></p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p>{item.currentProgress}%</p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        {(!item.classification || item.classification === '')
                                                            ? <p><em>Unclassified</em></p>
                                                            : <p>{getClassificationText(item.classification)}</p>
                                                        }
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p>{projectOwner}</p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p>{item.updatedDate} at {item.updatedTime}</p>
                                                    </Table.Cell>
                                                </Table.Row>
                                            )
                                        })
                                    }
                                    {(displayProjects.length === 0) &&
                                        <Table.Row>
                                            <Table.Cell colSpan={3}>
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
    );

};

export default ProjectsPortal;
