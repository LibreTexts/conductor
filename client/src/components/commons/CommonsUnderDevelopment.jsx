import './Commons.css';
import '../projects/Projects.css';

import {
    Grid,
    Dropdown,
    Segment,
    Input,
    Card,
    Table,
    Header,
    Button,
    Icon,
    Popup
} from 'semantic-ui-react';
import React, { useEffect, useState, useCallback } from 'react';
import { Link, useLocation, useHistory } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';

import Breakpoint from '../util/Breakpoints.jsx';
import ConductorPagination from '../util/ConductorPagination.jsx';
import useGlobalError from '../error/ErrorHooks.js';
import { catalogDisplayOptions } from '../util/CatalogOptions.js';
import { catalogItemsPerPageOptions } from '../util/PaginationOptions.js';
import {
    getClassificationText,
    getClassificationDescription
} from '../util/ProjectHelpers.js';

const CommonsUnderDevelopment = (_props) => {

    // Global State and Location/History
    const dispatch = useDispatch();
    const location = useLocation();
    const history = useHistory();
    const user = useSelector((state) => state.user);
    const { handleGlobalError } = useGlobalError();

    // UI
    const descriptionText = 'Projects listed here are under active development by the LibreTexts team and/or community for inclusion in LibreTexts platforms.';
    const getInvolvedText = (
        <span> <Link to='/register'>Sign up</Link> for a Conductor account or <Link to='/login'>login</Link> to get involved with LibreTexts OER projects and the community!</span>
    );
    const displayModeParam = 'mode';
    const itemsPerPageParam = 'items';
    const itemsPerPage = useSelector((state) => state.filters.underDev.itemsPerPage);
    const activePage = useSelector((state) => state.filters.underDev.activePage);
    const displayChoice = useSelector((state) => state.filters.underDev.mode);
    const [totalPages, setTotalPages] = useState(1);
    const [loadedProjects, setLoadedProjects] = useState(false);
    const [searchString, setSearchString] = useState('');

    // Data
    const [origProjects, setOrigProjects] = useState([]);
    const [allProjects, setAllProjects] = useState([]);
    const [displayProjects, setDisplayProjects] = useState([]);

    /**
     * Initialization.
     */
    useEffect(() => {
        document.title = "LibreCommons | Projects Under Development"
    }, []);

    /**
     * Process a Project and ensure all necessary fields for UI presentation are set.
     * @param {object} project - The Project data object to process.
     * @returns {object} The processed, UI-ready Project data object.
     */
    const processProject = (project) => {
        let currentProgress = 0;
        let peerProgress = 0;
        let a11yProgress = 0;
        if (typeof (project.currentProgress) === 'number') currentProgress = project.currentProgress;
        if (typeof (project.peerProgress) === 'number') peerProgress = project.peerProgress;
        if (typeof (project.a11yProgress) === 'number') a11yProgress = project.a11yProgress;
        return {
            ...project,
            currentProgress,
            peerProgress,
            a11yProgress
        }
    };


    /**
     * Retrieve projects under development from the server.
     */
    const loadProjects = useCallback(() => {
        setLoadedProjects(false);
        axios.get('/projects/underdevelopment').then((res) => {
            if (!res.data.err) {
                if (Array.isArray(res.data.projects)) {
                    const processed = res.data.projects.map((item) => processProject(item));
                    setOrigProjects(processed);
                    setAllProjects(processed);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedProjects(true);
        }).catch((err) => {
            setLoadedProjects(true);
            handleGlobalError(err);
        });
    }, [setLoadedProjects, handleGlobalError]);

    /**
     * Subscribe to changes in the URL search string and update state accordingly.
     */
    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);
        const displayParam = urlParams.get(displayModeParam) || 'visual';
        const itemsParam = urlParams.get(itemsPerPageParam) || 12;
        dispatch({
            type: 'SET_UNDERDEV_MODE',
            payload: displayParam
        });
        if (!isNaN(parseInt(itemsParam))) {
            dispatch({
                type: 'SET_UNDERDEV_ITEMS',
                payload: parseInt(itemsParam)
            });
        }
        loadProjects();
    }, [location.search, dispatch, loadProjects]);

    /**
     * Subscribe to changes in the Projects pagination options and update UI/state accordingly.
     */
    useEffect(() => {
        const newPageCount = Math.ceil(allProjects.length / itemsPerPage)
        setTotalPages(newPageCount);
        setDisplayProjects(allProjects.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage));
        if (activePage > newPageCount) {
            dispatch({
                type: 'SET_UNDERDEV_PAGE',
                payload: 1
            });
        }
    }, [allProjects, itemsPerPage, activePage, setTotalPages, setDisplayProjects, dispatch]);

    /**
     * Track changes to the UI search query and update the UI with relevant results.
     */
    useEffect(() => {
        if (searchString !== '') {
            const filtered = origProjects.filter((project) => {
                const descripString = String(project.title).toLowerCase();
                if (descripString.indexOf(String(searchString).toLowerCase()) > -1) {
                    return project;
                }
                return false;
            }).map((project) => processProject(project));
            setAllProjects(filtered);
            if (activePage !== 1) {
                dispatch({
                    type: 'SET_UNDERDEV_PAGE',
                    payload: 1
                });
            }
        } else {
            setAllProjects(origProjects);
        }
    }, [searchString, origProjects, activePage, setAllProjects, dispatch]);

    /**
     * Update the URL search query with a new value after a filter or sort option change.
     * @param {string} name - The internal filter or sort option name.
     * @param {string} newValue - The new value of the search parameter to set.
     */
    const handleFilterSortChange = (name, newValue) => {
        let urlParams = new URLSearchParams(location.search);
        switch (name) {
            case 'displayMode':
                urlParams.set(displayModeParam, newValue);
                break;
            case 'displayItems':
                urlParams.set(itemsPerPageParam, newValue);
                break;
            default:
                break;
        }
        history.push({ search: urlParams.toString() });
    };

    const VisualMode = () => {
        if (displayProjects.length > 0) {
            return (
                <Card.Group itemsPerRow={4} stackable>
                    {displayProjects.map((item, idx) => {
                        let cardProps = {};
                        if (user.isAuthenticated) {
                            cardProps = {
                                as: Link,
                                to: `/projects/${item.projectID}?src=underdevelopment`,
                                target: '_blank',
                                rel: 'noopener noreferrer'
                            };
                        }
                        return (
                            <Card key={`underdev-project-card-${idx}`} {...cardProps}>
                                <Card.Content>
                                    <Card.Header as='h3' className='commons-under-dev-card-header'>
                                        {item.title}
                                    </Card.Header>
                                    <Card.Meta>
                                        <span>
                                            <Popup
                                                trigger={(
                                                    <span>{item.currentProgress}% / </span>
                                                )}
                                                position='bottom center'
                                                content={<p className='text-center'>Overall Progress</p>}
                                            />
                                            <Popup
                                                trigger={(
                                                    <span>{item.peerProgress}% / </span>
                                                )}
                                                position='bottom center'
                                                content={<p className='text-center'>Peer Review Progress</p>}
                                            />
                                            <Popup
                                                trigger={(
                                                    <span>{item.a11yProgress}%</span>
                                                )}
                                                position='bottom center'
                                                content={<p className='text-center'>Accessibility Compliance Progress</p>}
                                            />
                                        </span>
                                    </Card.Meta>
                                    <Card.Description>
                                        <Popup
                                            trigger={(
                                                <span>{getClassificationText(item.classification)}</span>
                                            )}
                                            position='right center'
                                            content={(
                                                <p className='text-center'>{getClassificationDescription(item.classification)}</p>
                                            )}
                                        />
                                    </Card.Description>
                                </Card.Content>
                            </Card>
                        )
                    })}
                </Card.Group>
            )
        } else {
            return (
                <p className='text-center'><em>No projects available right now.</em></p>
            )
        }
    };

    const ItemizedMode = () => {
        return (
            <Table celled title='All Projects Under Development'>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell width={8} scope='col'><Header sub>Title</Header></Table.HeaderCell>
                        <Table.HeaderCell width={4} scope='col'><Header sub>Progress (C/PR/A11Y)</Header></Table.HeaderCell>
                        <Table.HeaderCell width={4} scope='col'><Header sub>Kind</Header></Table.HeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {(displayProjects.length > 0) &&
                        displayProjects.map((item, idx) => {
                            return (
                                <Table.Row key={`underdev-project-row-${idx}`}>
                                    <Table.Cell>
                                        {(user.isAuthenticated) ? (
                                            <p>
                                                <strong>
                                                    <Link
                                                        to={`/projects/${item.projectID}?src=underdevelopment`}
                                                        target='_blank'
                                                        rel='noopener noreferrer'
                                                    >
                                                        {item.title}
                                                    </Link>
                                                </strong>
                                            </p>
                                        ) : (
                                            <p><strong>{item.title}</strong></p>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <span>
                                            <Popup
                                                trigger={(
                                                    <span>{item.currentProgress}% / </span>
                                                )}
                                                position='bottom center'
                                                content={<p className='text-center'>Overall Progress</p>}
                                            />
                                            <Popup
                                                trigger={(
                                                    <span>{item.peerProgress}% / </span>
                                                )}
                                                position='bottom center'
                                                content={<p className='text-center'>Peer Review Progress</p>}
                                            />
                                            <Popup
                                                trigger={(
                                                    <span>{item.a11yProgress}%</span>
                                                )}
                                                position='bottom center'
                                                content={<p className='text-center'>Accessibility Compliance Progress</p>}
                                            />
                                        </span>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Popup
                                            trigger={(
                                                <span>{getClassificationText(item.classification)}</span>
                                            )}
                                            position='bottom center'
                                            content={(
                                                <p className='text-center'>{getClassificationDescription(item.classification)}</p>
                                            )}
                                        />
                                    </Table.Cell>
                                </Table.Row>
                            )
                        })
                    }
                    {(displayProjects.length === 0) &&
                        <Table.Row>
                            <Table.Cell colSpan='3'>
                                <p className='text-center'><em>No projects available right now.</em></p>
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
                            <Breakpoint name='tabletOrDesktop'>
                                <Header as='h2'>Under Development</Header>
                            </Breakpoint>
                            <Breakpoint name='mobile'>
                                <Header as='h2' textAlign='center'>Under Development</Header>
                            </Breakpoint>
                        </Segment>
                        <Segment>
                            <Breakpoint name='desktop'>
                                <Grid>
                                    <Grid.Column width={12} verticalAlign='middle'>
                                        <p>
                                            {descriptionText} {(!user.isAuthenticated) && getInvolvedText}
                                        </p>
                                    </Grid.Column>
                                    <Grid.Column width={4}>
                                        <Input
                                            fluid
                                            icon='search'
                                            placeholder='Search projects...'
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
                                            <p className='text-center'>
                                                {descriptionText} {(!user.isAuthenticated) && getInvolvedText}
                                            </p>
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
                                            onChange={(_e, { value }) => handleFilterSortChange('displayItems', value)}
                                            value={itemsPerPage}
                                            aria-label='Number of results to display per page'
                                        />
                                        <span> items per page of <strong>{allProjects.length}</strong> results, sorted by name.</span>
                                    </div>
                                    <div className='commons-content-pagemenu-center'>
                                        <ConductorPagination
                                            activePage={activePage}
                                            totalPages={totalPages}
                                            firstItem={null}
                                            lastItem={null}
                                            onPageChange={(newActivePage) => {
                                                dispatch({
                                                    type: 'SET_UNDERDEV_PAGE',
                                                    payload: newActivePage
                                                });
                                            }}
                                            size='large'
                                            siblingRange={0}
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
                                            onChange={(_e, { value }) => handleFilterSortChange('displayMode', value)}
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
                                                onChange={(_e, { value }) => handleFilterSortChange('displayMode', value)}
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
                                                    onChange={(_e, { value }) => handleFilterSortChange('displayItems', value)}
                                                    value={itemsPerPage}
                                                    aria-label='Number of results to display per page'
                                                />
                                                <span> items per page of <strong>{allProjects.length}</strong> results.</span>
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
                                                        type: 'SET_UNDERDEV_PAGE',
                                                        payload: newActivePage
                                                    });
                                                }}
                                                size='mini'
                                                siblingRange={0}
                                            />
                                        </Grid.Column>
                                    </Grid.Row>
                                </Grid>
                            </Breakpoint>
                        </Segment>
                        {(displayChoice === 'visual')
                            ? (
                                <Segment className='commons-content' loading={!loadedProjects}>
                                    <VisualMode />
                                </Segment>
                            )
                            : (
                                <Segment className='commons-content commons-content-itemized' loading={!loadedProjects}>
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
                                            onChange={(_e, { value }) => handleFilterSortChange('displayItems', value)}
                                            value={itemsPerPage}
                                            aria-label='Number of results to display per page'
                                        />
                                        <span> items per page of <strong>{allProjects.length}</strong> results, sorted by name.</span>
                                    </div>
                                    <div className='commons-content-pagemenu-right'>
                                        <ConductorPagination
                                            activePage={activePage}
                                            totalPages={totalPages}
                                            firstItem={null}
                                            lastItem={null}
                                            onPageChange={(newActivePage) => {
                                                dispatch({
                                                    type: 'SET_UNDERDEV_PAGE',
                                                    payload: newActivePage
                                                });
                                            }}
                                            size='large'
                                            siblingRange={0}
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
                                                    onChange={(_e, { value }) => handleFilterSortChange('displayItems', value)}
                                                    value={itemsPerPage}
                                                    aria-label='Number of results to display per page'
                                                />
                                                <span> items per page of <strong>{allProjects.length}</strong> results.</span>
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
                                                        type: 'SET_UNDERDEV_PAGE',
                                                        payload: newActivePage
                                                    });
                                                }}
                                                size='mini'
                                                siblingRange={0}
                                            />
                                        </Grid.Column>
                                    </Grid.Row>
                                </Grid>
                            </Breakpoint>
                        </Segment>
                    </Segment.Group>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )
}

export default CommonsUnderDevelopment;
