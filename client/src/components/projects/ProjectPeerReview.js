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

import ConductorTextArea from '../util/ConductorTextArea';
import ConductorMessagingUI from '../util/ConductorMessagingUI';
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

const ProjectPeerReview = (props) => {

    // Global State and Eror Handling
    const { handleGlobalError } = useGlobalError();
    const user = useSelector((state) => state.user);

    // UI
    const [loadingData, setLoadingData] = useState(false);
    const [showDiscussion, setShowDiscussion] = useState(false);

    // Project Data
    const [project, setProject] = useState({});

    // Project Permissions
    const [canViewDetails, setCanViewDetails] = useState(false);


    /**
     * Set page title and load Project information on initial load.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Projects | Project View | Peer Review";
        date.plugin(ordinal);
        date.plugin(day_of_week);
        getProject();
        if (localStorage.getItem('conductor_show_peerdiscussion') !== null) {
            if (localStorage.getItem('conductor_show_peerdiscussion') === 'true') {
                setShowDiscussion(true);
            }
        }
    }, []);

    /*
     * Get Project's restricted details when the permission changes.
     */
    /*
    useEffect(() => {
        if (canViewDetails) {
        }
    }, [canViewDetails]);
    */

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
            document.title = `LibreTexts Conductor | Projects | ${project.title} | Peer Review`;
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

    const handleChangeDiscussionVis = () => {
        setShowDiscussion(!showDiscussion);
        localStorage.setItem('conductor_show_peerdiscussion', !showDiscussion);
    };


    const LikertScale = ({ idx }) => {
        return (
            <div className='likert-row'>
                <div className='likert-option'>
                    <input
                        type='radio'
                        name={`likert-${idx}`}
                        value='strongly_agree'
                        id={`likert-${idx}-1`}
                    />
                    <label htmlFor={`likert-${idx}-1`}>Strongly Agree</label>
                </div>
                <div className='likert-option'>
                    <input
                        type='radio'
                        name={`likert-${idx}`}
                        value='agree'
                        id={`likert-${idx}-2`}
                    />
                    <label htmlFor={`likert-${idx}-2`}>Agree</label>
                </div>
                <div className='likert-option'>
                    <input
                        type='radio'
                        name={`likert-${idx}`}
                        value='neutral'
                        id={`likert-${idx}-3`}
                    />
                    <label htmlFor={`likert-${idx}-3`}>Neutral</label>
                </div>
                <div className='likert-option'>
                    <input
                        type='radio'
                        name={`likert-${idx}`}
                        value='disagree'
                        id={`likert-${idx}-4`}
                    />
                    <label htmlFor={`likert-${idx}-4`}>Disagree</label>
                </div>
                <div className='likert-option'>
                    <input
                        type='radio'
                        name={`likert-${idx}`}
                        value='strongly_disagree'
                        id={`likert-${idx}-5`}
                    />
                    <label htmlFor={`likert-${idx}-5`}>Strongly Disagree</label>
                </div>
            </div>
        )
    };


    const qualityQuestions = [
        'This resource is clear and concise.',
        'This resource provides a complete demonstration of the concept.',
        'This resource demonstrates a core concept grounded in the discipline.',
        'This resource is current and relevant.',
        'This resource is supported by appropriate research',
        'This resource is self-contained (can be used without requiring an assignment or context).',
        'This resource provides accurate information.',
        'This resource is flexible (can be used in several situations).',
        'This resource includes an adequate amount of material.',
        'This resource has strong workplace relevance.',
        'This resource integrates the concept well.',
        'Overall, the quality of this resource is very high.'
    ];

    const effectiveQuestions = [
        'This resource identifies learning objectives.',
        'This resource identifies prerequisite knowledge.',
        'This resource reinforces concepts progressively.',
        'This resource builds on prior concepts.',
        'This resource demonstrates relationships between concepts.',
        'This resource is easy to integrate into curriculum assignments.',
        'This resource is very efficient (could learn a lot in a short time).',
        'This resource can be used to measure student learning outcomes.',
        'Overall, this resource is a very effective teaching tool.'
    ];

    const easeQuestions = [
        'This resource is easy to use.',
        'This resource has very clear instructions.',
        'This resource is engaging.',
        'This resource is visually appealing.',
        'This resource is interactive.',
        'This resource is of high design quality.',
        'Overall, the usability of this resource is very high.'
    ];

    return(
        <Grid className='component-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Peer Review: <em>{project.title || 'Loading...'}</em></Header>
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
                                    Peer Review
                                </Breadcrumb.Section>
                            </Breadcrumb>
                        </Segment>
                        <Segment loading={loadingData}>
                            <Grid>
                                <Grid.Row>
                                    {(canViewDetails && showDiscussion) &&
                                        <Grid.Column>
                                            <Header as='h2' dividing className='mt-1p'>
                                                Peer Review Discussion
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
                                                    kind='peerreview'
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
                                                <Header as='h2' className='project-hiddensection-heading'>Peer Review Discussion</Header>
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
                                            <Header as='h2' dividing>Peer Review Discussion</Header>
                                            <Segment
                                                size='large'
                                                raised
                                                className='mb-2p'
                                            >
                                                <p><em>You don't have permission to view this project's Peer Review Discussion yet.</em></p>
                                            </Segment>
                                        </Grid.Column>
                                    }
                                </Grid.Row>
                                <Grid.Row>
                                    {canViewDetails &&
                                        <Grid.Column>
                                            <Header as='h2' dividing className='mt-1p'>Peer Review</Header>
                                            <Segment
                                                size='large'
                                                raised
                                                className='mb-4p'
                                                clearing
                                            >
                                                <p><em>This area is under active development and is enabled for demonstration purposes only. Changes are not saved to the server.</em></p>
                                                <Form noValidate>
                                                    <Header as='h3' dividing>General Review</Header>
                                                    <Form.Field className='mb-2p'>
                                                        <label className='form-normallabel'>Overview</label>
                                                        <p className='mb-1p'>Describe the general content of this resource and its uses and applications.</p>
                                                        <ConductorTextArea
                                                            placeholder='Describe the general content of this resource and its uses and applications.'
                                                            inputType='notes'
                                                            showSendButton={false}
                                                        />
                                                    </Form.Field>
                                                    <Form.Field className='mb-2p'>
                                                        <label className='form-normallabel'>Major Goals and Curriculum Considerations</label>
                                                        <p className='mb-1p'>Describe the overall goals and objectives for users to reach by completing this resource.</p>
                                                        <ConductorTextArea
                                                            placeholder='Describe the overall goals and objectives for users to reach by completing this resource.'
                                                            inputType='notes'
                                                            showSendButton={false}
                                                        />
                                                    </Form.Field>
                                                    <Form.Field className='mb-2p'>
                                                        <label className='form-normallabel'>Target Audience</label>
                                                        <p className='mb-1p'>Describe the target audience for this resource.</p>
                                                        <ConductorTextArea
                                                            placeholder='Describe the target audience for this resource.'
                                                            inputType='notes'
                                                            showSendButton={false}
                                                        />
                                                    </Form.Field>
                                                    <Form.Field className='mb-4p'>
                                                        <label className='form-normallabel'>Prerequisites</label>
                                                        <p className='mb-1p'>Describe prerequisite knowledge or skills for a user to complete this resource.</p>
                                                        <ConductorTextArea
                                                            placeholder='Describe prerequisite knowledge or skills for a user to complete this resource.'
                                                            inputType='notes'
                                                            showSendButton={false}
                                                        />
                                                    </Form.Field>
                                                    <Header as='h3' dividing className='project-peerreview-subheader'>Content Evaluation</Header>
                                                    <Header as='h4'>Content Quality</Header>
                                                        {qualityQuestions.map((item, idx) => {
                                                            return (
                                                                <Form.Field className='mt-2p mb-2p' key={`likert-field-${idx}`}>
                                                                    <label className='mb-05p'>{item}</label>
                                                                    <LikertScale
                                                                        idx={`quality-${idx}`}
                                                                    />
                                                                </Form.Field>
                                                            )
                                                        })}
                                                    <Divider />
                                                    <Header as='h4' className='project-peerreview-subheader'>Content Effectiveness</Header>
                                                        {effectiveQuestions.map((item, idx) => {
                                                            return (
                                                                <Form.Field className='mt-2p mb-2p' key={`likert-field-${idx}`}>
                                                                    <label className='mb-05p'>{item}</label>
                                                                    <LikertScale
                                                                        idx={`effective-${idx}`}
                                                                    />
                                                                </Form.Field>
                                                            )
                                                        })}
                                                    <Divider />
                                                    <Header as='h4' className='project-peerreview-subheader'>Ease of Use</Header>
                                                        {easeQuestions.map((item, idx) => {
                                                            return (
                                                                <Form.Field className='mt-2p mb-2p' key={`likert-field-${idx}`}>
                                                                    <label className='mb-05p'>{item}</label>
                                                                    <LikertScale
                                                                        idx={`ease-${idx}`}
                                                                    />
                                                                </Form.Field>
                                                            )
                                                        })}
                                                    <Header as='h3' dividing>Other Remarks</Header>
                                                    <Form.Field className='mb-2p'>
                                                        <label className='form-normallabel'>Additional Comments</label>
                                                        <ConductorTextArea
                                                            placeholder='Leave additional comments here...'
                                                            inputType='comments'
                                                            showSendButton={false}
                                                        />
                                                    </Form.Field>
                                                    <Button
                                                        color='green'
                                                        disabled
                                                        className='float-right mt-2p'
                                                    >
                                                        <Icon name='save' />
                                                        Save Review
                                                    </Button>
                                                </Form>
                                            </Segment>
                                        </Grid.Column>
                                    }
                                    {!canViewDetails &&
                                        <Grid.Column>
                                            <Header as='h2' dividing>Peer Review</Header>
                                            <Segment
                                                size='large'
                                                raised
                                                className='mb-2p'
                                            >
                                                <p><em>You don't have permission to view this project's Peer Review yet.</em></p>
                                            </Segment>
                                        </Grid.Column>
                                    }
                                </Grid.Row>
                            </Grid>
                        </Segment>
                    </Segment.Group>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    );

};

export default ProjectPeerReview;
