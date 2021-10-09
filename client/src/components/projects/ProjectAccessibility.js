import './Projects.css'
import 'react-circular-progressbar/dist/styles.css';

import {
  Grid,
  Header,
  Segment,
  Divider,
  Message,
  Icon,
  Button,
  Form,
  Breadcrumb,
  Modal,
  Label,
  List,
  Image,
  Accordion,
  Comment,
  Input,
  Loader,
  Table,
  Radio,
  Popup,
  Checkbox
} from 'semantic-ui-react';
import {
    CircularProgressbar,
    buildStyles
} from 'react-circular-progressbar';
import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import day_of_week from 'date-and-time/plugin/day-of-week';
import axios from 'axios';
import queryString from 'query-string';

import { MentionsInput, Mention } from 'react-mentions'

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

    const [accessScore, setAccessScore] = useState(90);
    const [sections, setSections] = useState([]);


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

    const addSection = () => {
        if (!isEmptyString(addName)) {
            setAddNameErr(false);
            setSections([...sections, { name: addName }]);
            closeAddModal();
        } else {
            setAddNameErr(true);
        }
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
                                                    <p className='text-center muted-text mt-4r'><em>No threads yet.</em></p>
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
                                                    <Button
                                                        icon='trash'
                                                        color='red'
                                                        disabled={activeThread === ''}
                                                        onClick={() => {}}
                                                    />
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
                                                    <p className='text-center muted-text mt-4r'><em>No messages yet.</em></p>
                                                }
                                                {(!loadedThreadMsgs && activeThread !== '') &&
                                                    <Loader active inline='centered' className='mt-4r' />
                                                }
                                                {(activeThread === '' && activeThreadMsgs.length === 0) &&
                                                    <p className='text-center muted-text mt-4r'><em>No thread selected.</em></p>
                                                }
                                            </div>
                                            <div id='project-messages-reply-container'>
                                                <Input
                                                    placeholder='Send a message...'
                                                    onChange={(e) => setMessageCompose(e.target.value)}
                                                    value={messageCompose}
                                                    action={{
                                                        color: 'blue',
                                                        icon: 'send',
                                                        content: 'Send',
                                                        disabled: ((activeThread === '') || (messageCompose === '')),
                                                        loading: messageSending,
                                                        onClick: () => {}
                                                    }}
                                                    fluid
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
                                        <Table.HeaderCell rowSpan={3} colSpan={1} id='access-add-cell'>
                                            <Button
                                                color='green'
                                                icon
                                                fluid
                                                onClick={openAddModal}
                                            >
                                                <Icon name='add' />
                                            </Button>
                                        </Table.HeaderCell>
                                    </Table.Row>
                                    <Table.Row>
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
                                            <span>Are the tables labelled?</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>No tables are embedded as images</span>
                                        </Table.HeaderCell>
                                        {/* LISTS */}
                                        <Table.HeaderCell>
                                            <span>Are ordered lists properly labeled?</span>
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Are unordered lists prrroperly labelled?</span>
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
                                    {(sections.length > 0 ) &&
                                        sections.map((item, idx) => {
                                            return (
                                                <Table.Row verticalAlign='middle' key={idx}>
                                                    <Table.Cell>
                                                        <strong>{item.name}</strong>
                                                    </Table.Cell>
                                                    {/* NAV */}
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    {/* IMAGES */}
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    {/* LINKS */}
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    {/* CONTRAST */}
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    {/* TEXT */}
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    {/* HEADINGS */}
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    {/* FORMS */}
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    {/* TABLES */}
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    {/* LISTS */}
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    {/* DOCUMENTS */}
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    {/* MULTIMEDIA */}
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    {/* DIV */}
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    {/* SENSORY */}
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    {/* TIMING */}
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                    {/* CODE */}
                                                    <Table.Cell className='access-table-cell' textAlign='center'>
                                                        <Checkbox toggle />
                                                    </Table.Cell>
                                                </Table.Row>
                                            )
                                        })
                                    }
                                    {(sections.length === 0) &&
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
