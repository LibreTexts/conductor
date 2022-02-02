import './Projects.css'
import 'react-circular-progressbar/dist/styles.css';

import {
  Grid,
  Header,
  Segment,
  Icon,
  Button,
  Form,
  Breadcrumb,
  Modal,
  Comment,
  Input,
  Loader,
  Table,
  Popup,
  Checkbox
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import day_of_week from 'date-and-time/plugin/day-of-week';
import axios from 'axios';
import queryString from 'query-string';

import ConductorMessagingUI from '../util/ConductorMessagingUI';
import { MentionsInput, Mention } from 'react-mentions';

import {
    isEmptyString,
} from '../util/HelperFunctions.js';
import {
    checkCanViewProjectDetails,
    checkProjectAdminPermission,
    checkProjectMemberPermission
} from '../util/ProjectHelpers.js';

import useGlobalError from '../error/ErrorHooks.js';

const ProjectAccessibility = (props) => {

    // Global State and Eror Handling
    const { handleGlobalError } = useGlobalError();
    const user = useSelector((state) => state.user);

    // UI
    const [loadingData, setLoadingData] = useState(false);
    const [showDiscussion, setShowDiscussion] = useState(false);

    // Project Data
    const [project, setProject] = useState({});
    const [reviewSections, setReviewSections] = useState([]);

    const [accessScore, setAccessScore] = useState(90);

    // Project Permissions
    const [canViewDetails, setCanViewDetails] = useState(false);

    // Add Section Modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [addName, setAddName] = useState('');
    const [addNameErr, setAddNameErr] = useState(false);

    // Sync TOC Modal
    const [showSyncTOCModal, setShowSyncTOCModal] = useState(false);
    const [syncTOCLoading, setSyncTOCLoading] = useState(false);

    /**
     * Set page title and load Project information on initial load.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Projects | Project View | Accessibility";
        date.plugin(ordinal);
        date.plugin(day_of_week);
        getProject();
        if (localStorage.getItem('conductor_show_a11ydiscussion') !== null) {
            if (localStorage.getItem('conductor_show_a11ydiscussion') === 'true') {
                setShowDiscussion(true);
            }
        }
    }, []);


    /**
     * Read URL params and update UI accordingly.
     */
    useEffect(() => {
        const queryValues = queryString.parse(props.location.search);
    }, [props.location.search]);


    /**
     * Update the page title to the project title when it is available.
     */
    useEffect(() => {
        if (project.title && project.title !== '') {
            document.title = `LibreTexts Conductor | Projects | ${project.title} | Accessibility`;
        }
    }, [project]);


    /*
     * Update state with user's permissions within the project when
     * their identity and the project data is available.
     */
    useEffect(() => {
        if (typeof(user.uuid) === 'string' && user.uuid !== '' && Object.keys(project).length > 0) {
            let adminPermissions = checkProjectAdminPermission(project, user);
            if (adminPermissions) {
                setCanViewDetails(true);
            } else if (checkProjectMemberPermission(project, user)) {
                setCanViewDetails(true);
            } else {
                setCanViewDetails(checkCanViewProjectDetails(project, user));
            }
        }
    }, [project, user, setCanViewDetails]);


    /*
     * Get Project's restricted details when the permission changes.
     */
    useEffect(() => {
        if (canViewDetails) {
            getReviewSections();
        }
    }, [canViewDetails]);


    /**
     * Retrieves the Project information via GET request
     * to the server and saves it to state.
     */
    const getProject = () => {
        setLoadingData(true);
        axios.get('/project', {
            params: {
                projectID: props.match.params.id
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.project) {
                    setProject(res.data.project);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadingData(false);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadingData(false);
        });
    };


    const getReviewSections = () => {
        setLoadingData(true);
        axios.get('/project/accessibility/sections', {
            params: {
                projectID: props.match.params.id
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.a11yReview) {
                    setReviewSections(res.data.a11yReview);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadingData(false);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadingData(false);
        });
    };

    const addSection = () => {
        if (!isEmptyString(addName) && addName.length < 150) {
            setAddNameErr(false);
            setLoadingData(true);
            axios.post('/project/accessibility/section', {
                projectID: props.match.params.id,
                sectionTitle: addName
            }).then((res) => {
                if (!res.data.err) {
                    getReviewSections();
                    closeAddModal();
                } else {
                    handleGlobalError(res.data.errMsg);
                }
                setLoadingData(false);
            }).catch((err) => {
                handleGlobalError(err);
                setLoadingData(false);
            });
            closeAddModal();
        } else {
            setAddNameErr(true);
        }
    };


    const updateSectionItem = (sectionID, itemName, newValue) => {
        axios.put('/project/accessibility/section/item', {
            projectID: props.match.params.id,
            sectionID: sectionID,
            itemName: itemName,
            newResponse: newValue
        }).then((res) => {
            if (!res.data.err) {
                let updatedSections = reviewSections.map((item) => {
                    if (item._id === sectionID) {
                        item[itemName] = newValue;
                        return item;
                    } else {
                        return item;
                    }
                });
                setReviewSections(updatedSections);
            } else {
                handleGlobalError(res.data.errMsg);
            }
        }).catch((err) => {
            handleGlobalError(err);
        });
    };

    const openAddModal = () => {
        setAddName('');
        setAddNameErr(false);
        setShowAddModal(true);
    };

    const closeAddModal = () => {
        setShowAddModal(false);
        setAddName('');
        setAddNameErr(false);
    };

    const handleChangeDiscussionVis = () => {
        setShowDiscussion(!showDiscussion);
        localStorage.setItem('conductor_show_a11ydiscussion', !showDiscussion);
    };

    const openSyncTOCModal = () => {
        setShowSyncTOCModal(true);
        setSyncTOCLoading(false);
    };

    const closeSyncTOCModal = () => {
        setShowSyncTOCModal(false);
        setSyncTOCLoading(false);
    };

    const syncTOC = (merge) => {
        setSyncTOCLoading(true);
        let data = {
            projectID: props.match.params.id
        };
        if (merge !== null && merge === true) {
            data.merge = true;
        }
        axios.put('/project/accessibility/importsections', data).then((res) => {
            if (!res.data.err) {
                closeSyncTOCModal();
                getReviewSections();
            } else {
                handleGlobalError(res.data.errMsg);
                setSyncTOCLoading(false);
            }
        }).catch((err) => {
            handleGlobalError(err);
            setSyncTOCLoading(false);
        });
    };

    return(
        <Grid className='component-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Accessibility: <em>{project.title || 'Loading...'}</em></Header>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Segment.Group>
                        <Segment>
                            <Breadcrumb>
                                <Breadcrumb.Section as={Link} to='/projects'>
                                    Projects
                                </Breadcrumb.Section>
                                <Breadcrumb.Divider icon='right chevron' />
                                <Breadcrumb.Section as={Link} to={`/projects/${project.projectID}`}>
                                    {project.title || 'Loading...'}
                                </Breadcrumb.Section>
                                <Breadcrumb.Divider icon='right chevron' />
                                <Breadcrumb.Section active>
                                    Accessibility
                                </Breadcrumb.Section>
                            </Breadcrumb>
                        </Segment>

                        <Segment loading={loadingData}>
                            <Grid>
                                <Grid.Row>
                                    {(canViewDetails && showDiscussion) &&
                                        <Grid.Column>
                                            <Header as='h2' dividing className='mt-1p'>
                                                Accessibility Discussion
                                                <Button
                                                    compact
                                                    floated='right'
                                                    onClick={handleChangeDiscussionVis}
                                                >
                                                    Hide
                                                </Button>
                                            </Header>
                                            <Segment
                                                size='large'
                                                raised
                                                className='project-discussion-segment mb-4p'
                                            >
                                                <ConductorMessagingUI
                                                    projectID={props.match.params.id}
                                                    user={user}
                                                    kind='a11y'
                                                />
                                            </Segment>
                                        </Grid.Column>
                                    }
                                    {(canViewDetails && !showDiscussion) &&
                                        <Grid.Column>
                                            <Segment
                                                raised
                                                clearing
                                            >
                                                <Header as='h2' className='project-hiddensection-heading'>Accessibility Discussion</Header>
                                                <Button
                                                    floated='right'
                                                    onClick={handleChangeDiscussionVis}
                                                >
                                                    Show
                                                </Button>
                                            </Segment>
                                        </Grid.Column>
                                    }
                                    {!canViewDetails &&
                                        <Grid.Column>
                                            <Header as='h2' dividing>Accessibility Discussion</Header>
                                            <Segment
                                                size='large'
                                                raised
                                                className='mb-2p'
                                            >
                                                <p><em>You don't have permission to view this project's Accessibility Discussion yet.</em></p>
                                            </Segment>
                                        </Grid.Column>
                                    }
                                </Grid.Row>
                                <Grid.Row>
                                    {canViewDetails &&
                                        <Grid.Column>
                                            <Header as='h2' dividing className='mt-1p'>Accessibility Compliance Review Matrix</Header>
                                            <Segment className='flex-row-div mt-1p'>
                                                <div className='left-flex'>
                                                    <p id='project-accessibility-score-header'>
                                                        Accessibility Score: <span className='project-yellow-score'>N/A</span>
                                                            {/*<span className={accessScore > 50 ? (accessScore > 75 ? 'project-green-score' : 'project-yellow-score') : 'project-red-score'}>{accessScore}%</span>*/}
                                                    </p>
                                                </div>
                                                <div className='right-flex'>
                                                    {(!isEmptyString(project.projectURL)
                                                        && !isEmptyString(project.libreLibrary)
                                                        && !isEmptyString(project.libreCoverID)
                                                        ) ? (
                                                            <Button
                                                                color='blue'
                                                                onClick={openSyncTOCModal}
                                                            >
                                                                <Icon name='sync' />
                                                                Sync TOC from LibreTexts
                                                            </Button>
                                                        ) : (
                                                            <Popup
                                                                content="Save your project's libretexts.org URL in Edit Properties to use this feature."
                                                                trigger={
                                                                    <Button
                                                                        color='blue'
                                                                        disabled
                                                                    >
                                                                        <Icon name='sync' />
                                                                        Sync TOC from LibreTexts
                                                                    </Button>
                                                                }
                                                            />
                                                        )
                                                    }
                                                </div>
                                            </Segment>
                                            <div className='access-table-outer'>
                                                <div className='access-table-inner'>
                                                    <Table celled structured className='mt-1p' id='access-table'>
                                                        <Table.Header>
                                                            <Table.Row>
                                                                <Table.HeaderCell rowSpan={2} id='access-add-cell'>
                                                                    <Button
                                                                        color='green'
                                                                        icon
                                                                        onClick={openAddModal}
                                                                        id='access-add-section-btn'
                                                                    >
                                                                        <Icon name='add' />
                                                                    </Button>
                                                                </Table.HeaderCell>
                                                                <Table.HeaderCell colSpan={1} textAlign='center'>Navigation</Table.HeaderCell>
                                                                <Table.HeaderCell colSpan={3} textAlign='center'>Images</Table.HeaderCell>
                                                                <Table.HeaderCell colSpan={3} textAlign='center'>Links</Table.HeaderCell>
                                                                <Table.HeaderCell colSpan={3} textAlign='center'>Contrast</Table.HeaderCell>
                                                                <Table.HeaderCell colSpan={5} textAlign='center'>Text</Table.HeaderCell>
                                                                <Table.HeaderCell colSpan={2} textAlign='center'>Headings</Table.HeaderCell>
                                                                <Table.HeaderCell colSpan={2} textAlign='center'>Forms</Table.HeaderCell>
                                                                <Table.HeaderCell colSpan={3} textAlign='center'>Tables</Table.HeaderCell>
                                                                <Table.HeaderCell colSpan={2} textAlign='center'>Lists</Table.HeaderCell>
                                                                <Table.HeaderCell colSpan={2} textAlign='center'>Documents</Table.HeaderCell>
                                                                <Table.HeaderCell colSpan={4} textAlign='center'>Multimedia</Table.HeaderCell>
                                                                <Table.HeaderCell colSpan={1} textAlign='center'>DIV</Table.HeaderCell>
                                                                <Table.HeaderCell colSpan={1} textAlign='center'>Sensory Characteristics</Table.HeaderCell>
                                                                <Table.HeaderCell colSpan={1} textAlign='center'>Timing</Table.HeaderCell>
                                                                <Table.HeaderCell colSpan={1} textAlign='center'>Computer Code</Table.HeaderCell>
                                                            </Table.Row>
                                                            <Table.Row>
                                                                {/* NAV */}
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Can you use the keyboard to access all content displayed?</span>
                                                                </Table.HeaderCell>
                                                                {/* IMAGES */}
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Do all images have meaningful alt text?</span>
                                                                </Table.HeaderCell>
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>For images not requiring alt text, is it marked as decorative?</span>
                                                                </Table.HeaderCell>
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Is all alt text under 150 characters? (Consider a caption instead)</span>
                                                                </Table.HeaderCell>
                                                                {/* LINKS */}
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Removed all empty links?</span>
                                                                </Table.HeaderCell>
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Removed all Suspicious Link Text?</span>
                                                                </Table.HeaderCell>
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Are URLs outside of LibreTexts labelled properly? (third party URL destination)</span>
                                                                </Table.HeaderCell>
                                                                {/* CONTRAST */}
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Is text contrast 4.5:1 for text 18pt and smaller?</span>
                                                                </Table.HeaderCell>
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Is text contrast 3:1 for text over 18pt?</span>
                                                                </Table.HeaderCell>
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Do graphical links/buttons have 3:1 contrast ratio?</span>
                                                                </Table.HeaderCell>
                                                                {/* TEXT */}
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Is all text larger than 10pt?</span>
                                                                </Table.HeaderCell>
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Alter text size? Keep line height at least 1.5 times the font size.</span>
                                                                </Table.HeaderCell>
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Alter text size? Spacing following paragraphs is 2x the font size.</span>
                                                                </Table.HeaderCell>
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Alter text size? Letter spacing is 0.12 times the font size.</span>
                                                                </Table.HeaderCell>
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Alter text size? Word spacing is 0.16 times the font size.</span>
                                                                </Table.HeaderCell>
                                                                {/* Headings */}
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>There are no empty headings</span>
                                                                </Table.HeaderCell>
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Heading Outline</span>
                                                                </Table.HeaderCell>
                                                                {/* FORMS */}
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Do form fields have a label?</span>
                                                                </Table.HeaderCell>
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Can you navigate questions and answered radio buttons?</span>
                                                                </Table.HeaderCell>
                                                                {/* TABLES */}
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Do tables have column and row headers?</span>
                                                                </Table.HeaderCell>
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Are the tables labeled?</span>
                                                                </Table.HeaderCell>
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>No tables are embedded as images</span>
                                                                </Table.HeaderCell>
                                                                {/* LISTS */}
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Are ordered lists properly labeled?</span>
                                                                </Table.HeaderCell>
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Are unordered lists properly labeled?</span>
                                                                </Table.HeaderCell>
                                                                {/* DOCUMENTS */}
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Does document link make sense and followed up with (FILETYPE)?</span>
                                                                </Table.HeaderCell>
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Is the document accessible?</span>
                                                                </Table.HeaderCell>
                                                                {/* MULTIMEDIA */}
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Does the video have captions?</span>
                                                                </Table.HeaderCell>
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Can you navigate the video player controls?</span>
                                                                </Table.HeaderCell>
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>If no transcript, does the audio have a transcript?</span>
                                                                </Table.HeaderCell>
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Does the video have audio descriptions or a media alternative if necessary?</span>
                                                                </Table.HeaderCell>
                                                                {/* DIVS */}
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>All DIV boxes are converted to SECTION LANDSCAPE</span>
                                                                </Table.HeaderCell>
                                                                {/* SENSORY */}
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Instructions provided for interactive content do not rely solely on shape, color, size, visual location, orientation, or sound</span>
                                                                </Table.HeaderCell>
                                                                {/* TIMING */}
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Time limits meet criteria
                                                                        <Popup trigger={<Icon name='info circle' />}>
                                                                            <Popup.Content>
                                                                                <p>If time limits have been set, at least one of the following is true: </p>
                                                                                <ul>
                                                                                    <li>Ability to turn off</li>
                                                                                    <li>Ability to adjust</li>
                                                                                    <li>Ability to extend</li>
                                                                                    <li>Real-time exceptions (e.g. - auctions)</li>
                                                                                    <li>Essential exception (i.e. - extending time would invalidate activity)</li>
                                                                                    <li>20 hour exception (i.e. - time limit is longer than 20 hours)</li>
                                                                                </ul>
                                                                            </Popup.Content>
                                                                        </Popup>
                                                                    </span>
                                                                </Table.HeaderCell>
                                                                {/* CODE */}
                                                                <Table.HeaderCell>
                                                                    <span className='access-table-sectiondescription'>Inserting code for review? Ensure that characters and spaces are included as alt text for screenreaders.</span>
                                                                </Table.HeaderCell>
                                                            </Table.Row>
                                                        </Table.Header>
                                                        <Table.Body id='access-table-body'>
                                                            {(reviewSections.length > 0 ) &&
                                                                reviewSections.map((item) => {
                                                                    return (
                                                                        <Table.Row verticalAlign='middle' key={item._id}>
                                                                            <Table.Cell>
                                                                                {!isEmptyString(item.sectionURL) ? (
                                                                                    <a href={item.sectionURL} target='_blank' rel='noopener noreferrer'><strong>{item.sectionTitle}</strong></a>
                                                                                ) : (
                                                                                    <span><strong>{item.sectionTitle}</strong></span>
                                                                                )}
                                                                            </Table.Cell>
                                                                            {/* NAV */}
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.navKeyboard} onChange={(_e, data) => { updateSectionItem(item._id, 'navKeyboard', data.checked) }} />
                                                                            </Table.Cell>
                                                                            {/* IMAGES */}
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.imgAltText} onChange={(_e, data) => { updateSectionItem(item._id, 'imgAltText', data.checked) }} />
                                                                            </Table.Cell>
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.imgDecorative} onChange={(_e, data) => { updateSectionItem(item._id, 'imgDecorative', data.checked) }} />
                                                                            </Table.Cell>
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.imgShortAlt} onChange={(_e, data) => { updateSectionItem(item._id, 'imgShortAlt', data.checked) }} />
                                                                            </Table.Cell>
                                                                            {/* LINKS */}
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.linkNoneEmpty} onChange={(_e, data) => { updateSectionItem(item._id, 'linkNoneEmpty', data.checked) }} />
                                                                            </Table.Cell>
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.linkSuspicious} onChange={(_e, data) => { updateSectionItem(item._id, 'linkSuspicious', data.checked) }} />
                                                                            </Table.Cell>
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.linkExtLabeled} onChange={(_e, data) => { updateSectionItem(item._id, 'linkExtLabeled', data.checked) }} />
                                                                            </Table.Cell>
                                                                            {/* CONTRAST */}
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.contrastSmall} onChange={(_e, data) => { updateSectionItem(item._id, 'contrastSmall', data.checked) }} />
                                                                            </Table.Cell>
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.contrastLarge} onChange={(_e, data) => { updateSectionItem(item._id, 'contrastLarge', data.checked) }} />
                                                                            </Table.Cell>
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.contrastButtons} onChange={(_e, data) => { updateSectionItem(item._id, 'contrastButtons', data.checked) }} />
                                                                            </Table.Cell>
                                                                            {/* TEXT */}
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.textSize} onChange={(_e, data) => { updateSectionItem(item._id, 'textSize', data.checked) }} />
                                                                            </Table.Cell>
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.textLineHeight} onChange={(_e, data) => { updateSectionItem(item._id, 'textLineHeight', data.checked) }} />
                                                                            </Table.Cell>
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.textParSpacing} onChange={(_e, data) => { updateSectionItem(item._id, 'textParSpacing', data.checked) }} />
                                                                            </Table.Cell>
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.textLetterSpacing} onChange={(_e, data) => { updateSectionItem(item._id, 'textLetterSpacing', data.checked) }} />
                                                                            </Table.Cell>
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.textWordSpacing} onChange={(_e, data) => { updateSectionItem(item._id, 'textWordSpacing', data.checked) }} />
                                                                            </Table.Cell>
                                                                            {/* HEADINGS */}
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.headingNoneEmpty} onChange={(_e, data) => { updateSectionItem(item._id, 'headingNoneEmpty', data.checked) }} />
                                                                            </Table.Cell>
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.headingOutline} onChange={(_e, data) => { updateSectionItem(item._id, 'headingOutline', data.checked) }} />
                                                                            </Table.Cell>
                                                                            {/* FORMS */}
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.formFieldLabels} onChange={(_e, data) => { updateSectionItem(item._id, 'formFieldLabels', data.checked) }} />
                                                                            </Table.Cell>
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.formNavRadio} onChange={(_e, data) => { updateSectionItem(item._id, 'formNavRadio', data.checked) }} />
                                                                            </Table.Cell>
                                                                            {/* TABLES */}
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.tableHeaders} onChange={(_e, data) => { updateSectionItem(item._id, 'tableHeaders', data.checked) }} />
                                                                            </Table.Cell>
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.tableLabel} onChange={(_e, data) => { updateSectionItem(item._id, 'tableLabel', data.checked) }} />
                                                                            </Table.Cell>
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.tableNotImage} onChange={(_e, data) => { updateSectionItem(item._id, 'tableNotImage', data.checked) }} />
                                                                            </Table.Cell>
                                                                            {/* LISTS */}
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.listOlLabel} onChange={(_e, data) => { updateSectionItem(item._id, 'listOlLabel', data.checked) }} />
                                                                            </Table.Cell>
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.listUlLabel} onChange={(_e, data) => { updateSectionItem(item._id, 'listUlLabel', data.checked) }} />
                                                                            </Table.Cell>
                                                                            {/* DOCUMENTS */}
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.docLinkFile} onChange={(_e, data) => { updateSectionItem(item._id, 'docLinkFile', data.checked) }} />
                                                                            </Table.Cell>
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.docAccess} onChange={(_e, data) => { updateSectionItem(item._id, 'docAccess', data.checked) }} />
                                                                            </Table.Cell>
                                                                            {/* MULTIMEDIA */}
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.multiCaption} onChange={(_e, data) => { updateSectionItem(item._id, 'multiCaption', data.checked) }} />
                                                                            </Table.Cell>
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.multiNavControls} onChange={(_e, data) => { updateSectionItem(item._id, 'multiNavControls', data.checked) }} />
                                                                            </Table.Cell>
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.multiAudioTrans} onChange={(_e, data) => { updateSectionItem(item._id, 'multiAudioTrans', data.checked) }} />
                                                                            </Table.Cell>
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.multiAudioDescrip} onChange={(_e, data) => { updateSectionItem(item._id, 'multiAudioDescrip', data.checked) }} />
                                                                            </Table.Cell>
                                                                            {/* DIV */}
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.divSection} onChange={(_e, data) => { updateSectionItem(item._id, 'divSection', data.checked) }} />
                                                                            </Table.Cell>
                                                                            {/* SENSORY */}
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.senseInstruction} onChange={(_e, data) => { updateSectionItem(item._id, 'senseInstruction', data.checked) }} />
                                                                            </Table.Cell>
                                                                            {/* TIMING */}
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.timingCriteria} onChange={(_e, data) => { updateSectionItem(item._id, 'timingCriteria', data.checked) }} />
                                                                            </Table.Cell>
                                                                            {/* CODE */}
                                                                            <Table.Cell className='access-table-cell' textAlign='center'>
                                                                                <Checkbox toggle checked={item.codeAltText} onChange={(_e, data) => { updateSectionItem(item._id, 'codeAltText', data.checked) }} />
                                                                            </Table.Cell>
                                                                        </Table.Row>
                                                                    )
                                                                })
                                                            }
                                                            {(reviewSections.length === 0) &&
                                                                <Table.Row>
                                                                    <Table.Cell></Table.Cell>
                                                                    <Table.Cell colSpan={33}>
                                                                        <span><em>No sections added yet.</em></span>
                                                                    </Table.Cell>
                                                                </Table.Row>
                                                            }
                                                        </Table.Body>
                                                    </Table>
                                                </div>
                                            </div>
                                        </Grid.Column>
                                    }
                                    {!canViewDetails &&
                                        <Grid.Column>
                                            <Header as='h2' dividing>Accessibility Compliance Review Matrix</Header>
                                            <Segment
                                                size='large'
                                                raised
                                                className='mb-2p'
                                            >
                                                <p><em>You don't have permission to view this project's Accessibility Compliance Review Matrix yet.</em></p>
                                            </Segment>
                                        </Grid.Column>
                                    }
                                </Grid.Row>
                            </Grid>
                        </Segment>
                    </Segment.Group>
                    {/* Add Section Modal */}
                    <Modal
                        open={showAddModal}
                        onClose={closeAddModal}
                    >
                        <Modal.Header>Add Section</Modal.Header>
                        <Modal.Content>
                            <Form>
                                <Form.Field error={addNameErr}>
                                    <label>New Section Name</label>
                                    <input
                                        placeholder='New section name...'
                                        value={addName}
                                        onChange={(e) => setAddName(e.target.value)}
                                    />
                                </Form.Field>
                            </Form>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeAddModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                color='green'
                                onClick={addSection}
                            >
                                <Icon name='add' />
                                Add
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Sync TOC Modal */}
                    <Modal
                        open={showSyncTOCModal}
                        onClose={closeSyncTOCModal}
                    >
                        <Modal.Header>Sync Table of Contents</Modal.Header>
                        <Modal.Content>
                            <p><strong>Import Mode:</strong> Imports your LibreText's table of contents and <strong><em>overwrites</em></strong> all existing entries in the Accessibility Compliance Review Matrix.</p>
                            <p><strong>Import & Merge Mode:</strong> Imports your LibreText's table of contents and attempts to merge existing entries with new entries in the TOC. <strong><em>Section/page names are case- and character-sensitive. Unmatchable names may be overwritten.</em></strong></p>
                            <Button.Group fluid>
                                <Button
                                    color='blue'
                                    loading={syncTOCLoading}
                                    onClick={() => syncTOC(false)}
                                >
                                    <Icon name='sync' />
                                    Sync using Import Mode
                                </Button>
                                <Button
                                    color='purple'
                                    loading={syncTOCLoading}
                                    onClick={() => syncTOC(true)}
                                >
                                    <Icon name='sync' />
                                    Sync using Import & Merge Mode
                                </Button>
                            </Button.Group>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeSyncTOCModal}
                            >
                                Cancel
                            </Button>
                        </Modal.Actions>
                    </Modal>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    );

};

export default ProjectAccessibility;
