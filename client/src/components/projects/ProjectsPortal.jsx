import './Projects.css';

import {
  Grid,
  Header,
  Menu,
  Input,
  Segment,
  Message,
  Icon,
  Button,
  Table,
  Loader
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useHistory } from 'react-router-dom';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import CreateProject from './CreateProject';

import { itemsPerPageOptions } from '../util/PaginationOptions.js';
import {
    getClassificationText,
    getVisibilityText
} from '../util/ProjectHelpers.js';
import { truncateString } from '../util/HelperFunctions.js';
import useGlobalError from '../error/ErrorHooks.js';

const ProjectsPortal = (props) => {

    // Global State and Error Handling
    const { handleGlobalError } = useGlobalError();
    const history = useHistory();
    const location = useLocation();

    // UI
    const [loadedProjects, setLoadedProjects] = useState(false);
    const [searchString, setSearchString] = useState('');
    const [sortChoice, setSortChoice] = useState('title');
    const [projectCreated, setProjectCreated] = useState(false);
    const [projectDeleted, setProjectDeleted] = useState(false);

    // Projects Data
    const [projects, setProjects] = useState([]);
    const [displayProjects, setDisplayProjects] = useState([]);

    // Create Project
    const [showCreateProject, setShowCreateProject] = useState(false);

    useEffect(() => {
      if (location.pathname.includes('create')) {
        setShowCreateProject(true);
      } else {
        setShowCreateProject(false);
      }
    }, [location, setShowCreateProject]);


    /**
     * Retrieve user's projects from the server and save them to state.
     */
    const getUserProjects = useCallback(() => {
        axios.get('/projects/all').then((res) => {
            if (!res.data.err) {
                if (res.data.projects && Array.isArray(res.data.projects)) {
                    setProjects(res.data.projects);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedProjects(true);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedProjects(true);
        });
    }, [setProjects, setLoadedProjects, handleGlobalError]);


    /**
     * Initialize plugins and UI state, then get user's projects.
     */
    useEffect(() => {
        date.plugin(ordinal);
        document.title = "LibreTexts Conductor | Projects";
        if (typeof (props.location?.search) !== 'undefined') {
            let urlParams = new URLSearchParams(props.location.search);
            let createdFlag = urlParams.get('projectCreated');
            let deletedFlag = urlParams.get('projectDeleted');
            if (createdFlag === 'true') setProjectCreated(true);
            if (deletedFlag === 'true') setProjectDeleted(true);
        }
        getUserProjects();
    }, [props.location, getUserProjects, setProjectCreated, setProjectDeleted]);


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
     * current filters and sort choice.
     */
    useEffect(() => {
        let filtered = projects.filter((proj) => {
            let descripString = String(proj.title).toLowerCase();
            if (searchString !== '' && String(descripString).indexOf(String(searchString).toLowerCase()) === -1) {
                // doesn't match search string, don't include
                return false;
            }
            return proj;
        });
        if (sortChoice === 'title') {
            const sorted = [...filtered].sort((a, b) => {
                let normalA = String(a.title).toLowerCase().replace(/[^A-Za-z]+/g, "");
                let normalB = String(b.title).toLowerCase().replace(/[^A-Za-z]+/g, "");
                if (normalA < normalB) return -1;
                if (normalA > normalB) return 1;
                return 0;
            });
            setDisplayProjects(sorted);
        }
    }, [projects, sortChoice, searchString, setDisplayProjects]);

    /**
     * Opens the Create Project tool.
     */
    function handleOpenCreateProject() {
      history.push('/projects/create');
    }

    /**
     * Closes the Create Project tool.
     */
    function handleCloseCreateProject() {
      history.push('/projects');
    }

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
                    <Menu widths={3}>
                        <Menu.Item as={Link} to='/projects/available' name='availableprojects' icon='folder open' content={<p>Available Projects</p>} />
                        <Menu.Item as={Link} to='/projects/completed' name='completedprojects' icon='check' content={<p>Completed Projects</p>} />
                        <Menu.Item as={Link} to='/projects/flagged' name='flaggedprojects' icon='attention' content={<p>Flagged Projects</p>} />
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
                            <Loader
                                active={!loadedProjects}
                                className='ml-2p'
                                inline
                            />
                            <Button
                                floated='right'
                                color='green'
                                onClick={handleOpenCreateProject}
                            >
                                <Button.Content>
                                    <Icon name='add' />
                                    Create a Project
                                </Button.Content>
                            </Button>
                        </Segment>
                        <Segment>
                            <Table celled>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.HeaderCell width={6}><Header sub>Title</Header></Table.HeaderCell>
                                        <Table.HeaderCell width={2}><Header sub>Progress (C/PR/A11Y)</Header></Table.HeaderCell>
                                        <Table.HeaderCell width={2}><Header sub>Classification</Header></Table.HeaderCell>
                                        <Table.HeaderCell width={2}><Header sub>Visibility</Header></Table.HeaderCell>
                                        <Table.HeaderCell width={2}><Header sub>Lead</Header></Table.HeaderCell>
                                        <Table.HeaderCell width={2}><Header sub>Last Updated</Header></Table.HeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {(displayProjects.length > 0) &&
                                        displayProjects.map((item, index) => {
                                            const itemDate = new Date(item.updatedAt);
                                            item.updatedDate = date.format(itemDate, 'MM/DD/YY');
                                            item.updatedTime = date.format(itemDate, 'h:mm A');
                                            let projectLead = 'Unknown';
                                            if (item.leads && Array.isArray(item.leads)) {
                                                item.leads.forEach((lead, leadIdx) => {
                                                    if (lead.firstName && lead.lastName) {
                                                        if (leadIdx > 0) projectLead += `, ${lead.firstName} ${lead.lastName}`;
                                                        else if (leadIdx === 0) projectLead = `${lead.firstName} ${lead.lastName}`;
                                                    }
                                                });
                                            }
                                            if (!item.hasOwnProperty('peerProgress')) item.peerProgress = 0;
                                            if (!item.hasOwnProperty('a11yProgress')) item.a11yProgress = 0;
                                            return (
                                                <Table.Row key={index}>
                                                    <Table.Cell>
                                                        <p><strong><Link to={`/projects/${item.projectID}`}>{truncateString(item.title, 100)}</Link></strong></p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <div className='flex-row-div projectprotal-progress-row'>
                                                            <div className='projectportal-progress-col'>
                                                                <span>{item.currentProgress}%</span>
                                                            </div>
                                                            <div className='projectportal-progresssep-col'>
                                                                <span className='projectportal-progresssep'>/</span>
                                                            </div>
                                                            <div className='projectportal-progress-col'>
                                                                <span>{item.peerProgress}%</span>
                                                            </div>
                                                            <div className='projectportal-progresssep-col'>
                                                                <span className='projectportal-progresssep'>/</span>
                                                            </div>
                                                            <div className='projectportal-progress-col'>
                                                                <span>{item.a11yProgress}%</span>
                                                            </div>
                                                        </div>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        {(typeof(item.classification) === 'string' && item.classification !== '')
                                                            ? <p>{getClassificationText(item.classification)}</p>
                                                            : <p><em>Unclassified</em></p>
                                                        }
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        {(typeof(item.visibility) === 'string' && item.visibility !== '')
                                                            ? <p>{getVisibilityText(item.visibility)}</p>
                                                            : <p><em>Unknown</em></p>
                                                        }
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p>{truncateString(projectLead, 50)}</p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p>{item.updatedDate} at {item.updatedTime}</p>
                                                    </Table.Cell>
                                                </Table.Row>
                                            )
                                        })
                                    }
                                    {(loadedProjects && displayProjects.length === 0) &&
                                        <Table.Row>
                                            <Table.Cell colSpan={6}>
                                                <p className='text-center'><em>No results found.</em></p>
                                            </Table.Cell>
                                        </Table.Row>
                                    }
                                </Table.Body>
                            </Table>
                        </Segment>
                    </Segment.Group>
                    <CreateProject show={showCreateProject} onClose={handleCloseCreateProject} />
                </Grid.Column>
            </Grid.Row>
        </Grid>
    );

};

export default ProjectsPortal;
