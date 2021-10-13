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

import ConductorTextArea from '../util/ConductorTextArea';
import { MentionsInput, Mention } from 'react-mentions';

import {
    isEmptyString,
    capitalizeFirstLetter,
    normalizeURL,
    truncateString
} from '../util/HelperFunctions.js';

import {
    visibilityOptions,
    editStatusOptions
} from '../util/ProjectOptions.js';
import {
    licenseOptions,
    getLicenseText
} from '../util/LicenseOptions.js';

import useGlobalError from '../error/ErrorHooks.js';

const ProjectAccessibility = (props) => {

    // Global State and Eror Handling
    const { handleGlobalError } = useGlobalError();
    const user = useSelector((state) => state.user);

    // UI
    const [loadingData, setLoadingData] = useState(false);

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



    // Discussion
    const [projectThreads, setProjectThreads] = useState([]);
    const [loadedProjThreads, setLoadedProjThreads] = useState(true);
    const [activeThread, setActiveThread] = useState('');
    const [activeThreadTitle, setActiveThreadTitle] = useState('');
    const [activeThreadMsgs, setActiveThreadMsgs] = useState([]);
    const [loadedThreadMsgs, setLoadedThreadMsgs] = useState(false);
    const [messageCompose, setMessageCompose] = useState('');
    const [messageSending, setMessageSending] = useState(false);


    /**
     * Set page title and load Project information on initial load.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Projects | Project View | Accessibility";
        date.plugin(ordinal);
        date.plugin(day_of_week);
        getProject();
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
     * Update the user's permission to view Project restricted details when
     * their identity and the project data is available.
     */
    useEffect(() => {
        if (user.uuid && user.uuid !== '') {
            if (project.owner?.uuid === user.uuid || project.owner === user.uuid) {
                setCanViewDetails(true);
            } else {
                if (project.hasOwnProperty('collaborators') && Array.isArray(project.collaborators)) {
                    let foundCollab = project.collaborators.find((item) => {
                        if (typeof(item) === 'string') {
                            return item === user.uuid;
                        } else if (typeof(item) === 'object') {
                            return item.uuid === user.uuid;
                        }
                        return false;
                    });
                    if (foundCollab !== undefined) setCanViewDetails(true);
                }
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
                    console.log(res.data.a11yReview);
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
                            <Header as='h2' dividing className='mt-1p'>Accessibility Discussion</Header>
                            <Segment
                                id='project-discussion-segment'
                                size='large'
                                raised
                                className='mb-2p'
                            >
                                <div id='project-discussion-container'>
                                    <div id='project-discussion-threads'>
                                        <div className='flex-col-div' id='project-threads-container'>
                                            <div className='flex-row-div' id='project-threads-header-container'>
                                                <div className='left-flex'>
                                                    <Header as='h3'>Threads</Header>
                                                </div>
                                                <div className='right-flex'>
                                                    <Button
                                                        circular
                                                        icon='trash'
                                                        color='red'
                                                        disabled={activeThread === ''}
                                                        onClick={() => {}}
                                                        className='mr-2p'
                                                    />
                                                    <Button
                                                        circular
                                                        icon='plus'
                                                        color='olive'
                                                        onClick={() => {}}
                                                    />
                                                </div>
                                            </div>
                                            <div className='flex-col-div' id='project-threads-list-container'>
                                                {(loadedProjThreads && projectThreads.length > 0) &&
                                                    projectThreads.map((item, idx) => {
                                                        return (
                                                            <div className='project-threads-list-item' key={item.threadID} onClick={() => {}}>
                                                                <p className={activeThread === item.threadID ? 'project-threads-list-title active' : 'project-threads-list-title'}>
                                                                    {item.title}
                                                                </p>
                                                                <p className='project-threads-list-descrip'>
                                                                    {(item.lastMessage && item.lastMessage.hasOwnProperty('body'))
                                                                        ? (
                                                                            <span>
                                                                                {item.lastMessage.author?.firstName} {item.lastMessage.author?.lastName}: {truncateString(item.lastMessage.body, 50)}
                                                                            </span>
                                                                        )
                                                                        : (<span><em>No messages yet.</em></span>)
                                                                    }
                                                                </p>
                                                            </div>
                                                        )
                                                    })
                                                }
                                                {(loadedProjThreads && projectThreads.length === 0) &&
                                                    <p className='text-center muted-text mt-4r'><em>No threads yet. Create one above!</em></p>
                                                }
                                                {(!loadedProjThreads) &&
                                                    <Loader active inline='centered' className='mt-4r' />
                                                }
                                            </div>
                                        </div>
                                    </div>
                                    <div id='project-discussion-messages'>
                                        <div className='flex-col-div' id='project-messages-container'>
                                            <div className='flex-row-div' id='project-messages-header-container'>
                                                <div className='left-flex'>
                                                    <Header as='h3'>
                                                        {(activeThreadTitle !== '')
                                                            ? <em>{activeThreadTitle}</em>
                                                            : <span>Messages</span>
                                                        }
                                                    </Header>
                                                </div>
                                                <div className='right-flex' id='project-messages-header-options'>
                                                </div>
                                            </div>
                                            <div id='project-messages-chat-container'>
                                                {(loadedThreadMsgs && activeThreadMsgs.length > 0) &&
                                                    <Comment.Group id='project-messages-chat-list'>
                                                        {activeThreadMsgs.map((item, idx) => {
                                                            const today = new Date();
                                                            const itemDate = new Date(item.createdAt);
                                                            if (today.getDate() === itemDate.getDate()) { // today
                                                                item.date = 'Today';
                                                            } else if ((today.getDate() - itemDate.getDate()) >= 7) { // a week ago
                                                                item.date = date.format(itemDate, 'MMM DDD, YYYY')
                                                            } else { // this week
                                                                item.date = date.format(itemDate, 'dddd');
                                                            }
                                                            item.time = date.format(itemDate, 'h:mm A');
                                                            return (
                                                                <Comment className='project-messages-message' key={item.messageID}>
                                                                  <Comment.Avatar src={item.author?.avatar || '/mini_logo.png'} />
                                                                  <Comment.Content>
                                                                    <Comment.Author as='span'>{item.author?.firstName} {item.author?.lastName}</Comment.Author>
                                                                    <Comment.Metadata>
                                                                      <div>{item.date} at {item.time}</div>
                                                                    </Comment.Metadata>
                                                                    <Comment.Text>{item.body}</Comment.Text>
                                                                  </Comment.Content>
                                                                </Comment>
                                                            )
                                                        })}
                                                    </Comment.Group>
                                                }
                                                {(loadedThreadMsgs && activeThreadMsgs.length === 0) &&
                                                    <p className='text-center muted-text mt-4r'><em>No messages yet. Send one below!</em></p>
                                                }
                                                {(!loadedThreadMsgs && activeThread !== '') &&
                                                    <Loader active inline='centered' className='mt-4r' />
                                                }
                                                {(activeThread === '' && activeThreadMsgs.length === 0) &&
                                                    <p className='text-center muted-text mt-4r'><em>No thread selected. Select one from the list on the left or create one using the + button!</em></p>
                                                }
                                            </div>
                                            <div id='project-messages-reply-container'>
                                                <ConductorTextArea
                                                    placeholder='Send a message...'
                                                    textValue={messageCompose}
                                                    onTextChange={(value) => setMessageCompose(value)}
                                                    disableSend={(activeThread === '') || (messageCompose === '')}
                                                    sendLoading={messageSending}
                                                    onSendClick={() => {}}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Segment>
                            <Header as='h2' dividing className='mt-1p'>Accessibility Review Matrix</Header>
                            <Segment className='mt-1p'>
                                <p id='project-accessibility-score-header'>
                                    Accessibility Score: <span className='project-yellow-score'>N/A</span>
                                        {/*<span className={accessScore > 50 ? (accessScore > 75 ? 'project-green-score' : 'project-yellow-score') : 'project-red-score'}>{accessScore}%</span>*/}
                                </p>
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
                                                fluid
                                                onClick={openAddModal}
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
                                            <span>Can you use the keyboard to access all content displayed?</span>
                                        </Table.HeaderCell>
                                        {/* IMAGES */}
                                        <Table.HeaderCell>
                                            <span>Do all images have meaningful alt text?</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>For images not requiring alt text, is it marked as decorative?</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Is all alt text under 150 characters? (Consider a caption instead)</span>
                                        </Table.HeaderCell>
                                        {/* LINKS */}
                                        <Table.HeaderCell>
                                            <span>Removed all empty links?</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Removed all Suspicious Link Text?</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Are URLs outside of LibreTexts labelled properly? (third party URL destination)</span>
                                        </Table.HeaderCell>
                                        {/* CONTRAST */}
                                        <Table.HeaderCell>
                                            <span>Is text contrast 4.5:1 for text 18pt and smaller?</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Is text contrast 3:1 for text over 18pt?</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Do graphical links/buttons have 3:1 contrast ratio?</span>
                                        </Table.HeaderCell>
                                        {/* TEXT */}
                                        <Table.HeaderCell>
                                            <span>Is all text larger than 10pt?</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Alter text size? Keep line height at least 1.5 times the font size.</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Alter text size? Spacing following paragraphs is 2x the font size.</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Alter text size? Letter spacing is 0.12 times the font size.</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Alter text size? Word spacing is 0.16 times the font size.</span>
                                        </Table.HeaderCell>
                                        {/* Headings */}
                                        <Table.HeaderCell>
                                            <span>There are no empty headings</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Heading Outline</span>
                                        </Table.HeaderCell>
                                        {/* FORMS */}
                                        <Table.HeaderCell>
                                            <span>Do form fields have a label?</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Can you navigate questions and answered radio buttons?</span>
                                        </Table.HeaderCell>
                                        {/* TABLES */}
                                        <Table.HeaderCell>
                                            <span>Do tables have column and row headers?</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Are the tables labeled?</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>No tables are embedded as images</span>
                                        </Table.HeaderCell>
                                        {/* LISTS */}
                                        <Table.HeaderCell>
                                            <span>Are ordered lists properly labeled?</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Are unordered lists properly labeled?</span>
                                        </Table.HeaderCell>
                                        {/* DOCUMENTS */}
                                        <Table.HeaderCell>
                                            <span>Does document link make sense and followed up with (FILETYPE)?</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Is the document accessible?</span>
                                        </Table.HeaderCell>
                                        {/* MULTIMEDIA */}
                                        <Table.HeaderCell>
                                            <span>Does the video have captions?</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Can you navigate the video player controls?</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>If no transcript, does the audio have a transcript?</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Does the video have audio descriptions or a media alternative if necessary?</span>
                                        </Table.HeaderCell>
                                        {/* DIVS */}
                                        <Table.HeaderCell>
                                            <span>All DIV boxes are converted to SECTION LANDSCAPE</span>
                                        </Table.HeaderCell>
                                        {/* SENSORY */}
                                        <Table.HeaderCell>
                                            <span>Instructions provided for interactive content do not rely solely on shape, color, size, visual location, orientation, or sound</span>
                                        </Table.HeaderCell>
                                        {/* TIMING */}
                                        <Table.HeaderCell>
                                            <span>Time limits meet criteria
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
                                            <span>Inserting code for review? Ensure that characters and spaces are included as alt text for screenreaders.</span>
                                        </Table.HeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body id='access-table-body'>
                                    {(reviewSections.length > 0 ) &&
                                        reviewSections.map((item) => {
                                            return (
                                                <Table.Row verticalAlign='middle' key={item._id}>
                                                    <Table.Cell>
                                                        <span><strong>{item.sectionTitle}</strong></span>
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
                        </Segment>
                    </Segment.Group>
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
                </Grid.Column>
            </Grid.Row>
        </Grid>
    );

};

export default ProjectAccessibility;
