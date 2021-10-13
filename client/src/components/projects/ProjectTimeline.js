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
  Menu,
  Card
} from 'semantic-ui-react';
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

const ProjectTimeline = (props) => {

    // Global State and Eror Handling
    const { handleGlobalError } = useGlobalError();
    const user = useSelector((state) => state.user);

    // UI
    const [loadingData, setLoadingData] = useState(false);

    // Project Data
    const [project, setProject] = useState({});

    // Project Permissions
    const [canViewDetails, setCanViewDetails] = useState(false);

    // Roadmap
    const [showRoadmap, setShowRoadmap] = useState(false);
    const [roadmapRequiresRemix, setRoadmapRequiresRemix] = useState(null);
    const [currentRoadmapStep, setCurrentRoadmapStep] = useState('');
    const [showConfirmPublish, setShowConfirmPublish] = useState(false);

    /**
     * Set page title and load Project information on initial load.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Projects | Project View | Timeline";
        date.plugin(ordinal);
        date.plugin(day_of_week);
        getProject();
        if (localStorage.getItem('conductor_show_roadmap') !== null) {
            if (localStorage.getItem('conductor_show_roadmap') === 'true') {
                setShowRoadmap(true);
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
            document.title = `LibreTexts Conductor | Projects | ${project.title} | Timeline`;
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
                    console.log(res.data.project);
                    if (res.data.project.hasOwnProperty('rdmpReqRemix') && typeof(res.data.project.rdmpReqRemix) === 'boolean') {
                        setRoadmapRequiresRemix(res.data.project.rdmpReqRemix);
                    }
                    if (res.data.project.hasOwnProperty('rdmpCurrentStep') && typeof(res.data.project.rdmpCurrentStep) === 'string') {
                        setCurrentRoadmapStep(res.data.project.rdmpCurrentStep);
                    }
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


    /**
     * Update state and send update to the server when the Roadmap's
     * 'Requires Remixing' question answer changes.
     * @param {Boolean} newValue  - the new question response
     */
    const updateRoadmapRequiresRemix = (newValue) => {
        if (typeof(newValue) === 'boolean') {
            setRoadmapRequiresRemix(newValue);
            let projData = {
                projectID: props.match.params.id
            };
            if ((project.hasOwnProperty('rdmpReqRemix') && project.rdmpReqRemix !== newValue) || !project.hasOwnProperty('rdmpReqRemix')) {
                projData.rdmpReqRemix = newValue;
            }
            if (Object.keys(projData).length > 1) {
                // changes to save
                axios.put('/project', projData).then((res) => {
                    if (!res.data.err) {
                        getProject();
                    } else {
                        handleGlobalError(res.data.errMsg);
                    }
                }).catch((err) => {
                    handleGlobalError(err);
                });
            }
        }
    };


    /**
     * Update state and send update to the server when the Roadmap's
     * current step changes.
     * @param {String} newValue  - the new roadmap step name
     */
    const updateRoadmapStep = (newValue) => {
        if (typeof(newValue) === 'string') {
            setCurrentRoadmapStep(newValue);
            let projData = {
                projectID: props.match.params.id
            };
            if ((project.hasOwnProperty('rdmpCurrentStep') && project.rdmpCurrentStep !== newValue) || !project.hasOwnProperty('rdmpCurrentStep')) {
                projData.rdmpCurrentStep = newValue;
            }
            if (Object.keys(projData).length > 1) {
                // changes to save
                axios.put('/project', projData).then((res) => {
                    if (!res.data.err) {
                        getProject();
                    } else {
                        handleGlobalError(res.data.errMsg);
                    }
                }).catch((err) => {
                    handleGlobalError(err);
                });
            }
        }
    };

    const handleChangeRoadmapVis = () => {
        setShowRoadmap(!showRoadmap);
        localStorage.setItem('conductor_show_roadmap', !showRoadmap);
    };


    const submitPublishRequest = () => {
        axios.post('/project/publishing', {
            projectID: props.match.params.id
        }).then((res) => {
            if (!res.data.err) {
                setShowConfirmPublish(false);
            } else {
                handleGlobalError(res.data.errMsg);
            }
        }).catch((err) => {
            handleGlobalError(err);
        });
    };

    return(
        <Grid className='component-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Timeline: <em>{project.title || 'Loading...'}</em></Header>
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
                                    Timeline
                                </Breadcrumb.Section>
                            </Breadcrumb>
                        </Segment>
                        <Segment>
                            <Grid>
                                <Grid.Row>
                                    {(canViewDetails && showRoadmap) &&
                                        <Grid.Column>
                                            <Header as='h2' dividing>
                                                Construction Roadmap
                                                <Button
                                                    compact
                                                    floated='right'
                                                    onClick={handleChangeRoadmapVis}
                                                >
                                                    Hide
                                                </Button>
                                            </Header>
                                            <Segment
                                                id='project-roadmap-segment'
                                                size='large'
                                                raised
                                                className='mb-2p'
                                            >
                                                <div id='project-roadmap-container'>
                                                    <div className='project-roadmap-step-container'>
                                                        <Card
                                                            header={
                                                                <span className='header'>
                                                                    Step 1: <em>Vision</em>
                                                                    <Radio
                                                                        className='float-right'
                                                                        checked={currentRoadmapStep === '1'}
                                                                        onChange={() => updateRoadmapStep('1')}
                                                                    />
                                                                </span>
                                                            }
                                                            description='Construct a Vision of your Book'
                                                            className='project-roadmap-card'
                                                            extra={
                                                                <a
                                                                    target='_blank'
                                                                    href='https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/02%3A_A_Framework_for_Designing_Online_Texts'
                                                                    rel='noopener noreferrer'
                                                                >
                                                                    <Icon name='external' />
                                                                    Designing Online Texts
                                                                </a>
                                                            }
                                                        />
                                                    </div>
                                                    <div className='project-roadmap-step-container'>
                                                        <div className='project-roadmap-arrow-container'>
                                                            <Icon name='arrow right' size='large' fitted />
                                                        </div>
                                                        <Card
                                                            header={
                                                                <span className='header'>
                                                                    Step 2: <em>Accounts</em>
                                                                    <Radio
                                                                        className='float-right'
                                                                        checked={currentRoadmapStep === '2'}
                                                                        onChange={() => updateRoadmapStep('2')}
                                                                    />
                                                                </span>
                                                            }
                                                            description='Obtain proper LibreTexts accounts'
                                                            className='project-roadmap-card'
                                                            extra={
                                                                <a
                                                                    target='blank'
                                                                    href='https://register.libretexts.org/'
                                                                    rel='noopener noreferrer'
                                                                >
                                                                    <Icon name='external' />
                                                                    Register at LibreTexts
                                                                </a>
                                                            }
                                                        />
                                                    </div>
                                                    <div className='project-roadmap-step-container'>
                                                        <div className='project-roadmap-arrow-container'>
                                                            <Icon name='arrow right' size='large' fitted />
                                                        </div>
                                                        <Card
                                                            header={
                                                                <span className='header'>
                                                                    Step 3: <em>Training</em>
                                                                    <Radio
                                                                        className='float-right'
                                                                        checked={currentRoadmapStep === '3'}
                                                                        onChange={() => updateRoadmapStep('3')}
                                                                    />
                                                                </span>
                                                            }
                                                            description='Review Remixing and Editing Fundamentals'
                                                            extra={
                                                                <a
                                                                    target='blank'
                                                                    href='https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/03%3A_Basic_Editing'
                                                                    rel='noopener noreferrer'
                                                                >
                                                                    <Icon name='external' />
                                                                    Basic Editing
                                                                </a>
                                                            }
                                                            className='project-roadmap-card'
                                                        />
                                                    </div>
                                                    <div className='project-roadmap-step-container'>
                                                        <div className='project-roadmap-arrow-container'>
                                                            <Icon name='arrow right' size='large' fitted />
                                                        </div>
                                                        <Card
                                                            header={
                                                                <span className='header'>
                                                                    Step 4
                                                                    <Radio
                                                                        className='float-right'
                                                                        checked={currentRoadmapStep === '4'}
                                                                        onChange={() => updateRoadmapStep('4')}
                                                                    />
                                                                </span>
                                                            }
                                                            description={
                                                                <div>
                                                                    <p>Does your Vision require remixing of existing content?</p>
                                                                    <Button.Group widths={2}>
                                                                        <Button
                                                                            basic={(roadmapRequiresRemix === null) || (roadmapRequiresRemix === false)}
                                                                            color='blue'
                                                                            onClick={() => updateRoadmapRequiresRemix(true)}
                                                                        >
                                                                            Yes
                                                                        </Button>
                                                                        <Button
                                                                            basic={(roadmapRequiresRemix === null) || (roadmapRequiresRemix === true)}
                                                                            color='green'
                                                                            onClick={() => updateRoadmapRequiresRemix(false)}
                                                                        >
                                                                            No
                                                                        </Button>
                                                                    </Button.Group>
                                                                </div>
                                                            }
                                                            extra={
                                                                <a
                                                                    target='blank'
                                                                    href='https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/07%3A_Remixing_Existing_Content'
                                                                    rel='noopener noreferrer'
                                                                >
                                                                    <Icon name='external' />
                                                                    Remixing Existing Content
                                                                </a>
                                                            }
                                                            className='project-roadmap-card'
                                                        />
                                                    </div>
                                                    {(roadmapRequiresRemix === true || roadmapRequiresRemix === null) &&
                                                        <div className={(roadmapRequiresRemix === true) ? 'project-roadmap-step-container' : 'project-roadmap-step-container project-roadmap-step-disabled'}>
                                                            <div className='project-roadmap-arrow-container'>
                                                                <Icon name='arrow right' size='large' fitted />
                                                            </div>
                                                            <Card
                                                                header={
                                                                    <span className='header'>
                                                                        Step 5a: <em>Scan</em>
                                                                        <Radio
                                                                            className='float-right'
                                                                            checked={currentRoadmapStep === '5a'}
                                                                            onChange={() => updateRoadmapStep('5a')}
                                                                        />
                                                                    </span>
                                                                }
                                                                description='Review & evaluate existing content on LibreTexts and identify gaps'
                                                                className='project-roadmap-card'
                                                            />
                                                        </div>
                                                    }
                                                    {(roadmapRequiresRemix === true || roadmapRequiresRemix === null) &&
                                                        <div className={(roadmapRequiresRemix === true) ? 'project-roadmap-step-container' : 'project-roadmap-step-container project-roadmap-step-disabled'}>
                                                            <div className='project-roadmap-arrow-container'>
                                                                <Icon name='arrow right' size='large' fitted />
                                                            </div>
                                                            <Card
                                                                header={
                                                                    <span className='header'>
                                                                        Step 5b: <em>Mapping</em>
                                                                        <Radio
                                                                            className='float-right'
                                                                            checked={currentRoadmapStep === '5b'}
                                                                            onChange={() => updateRoadmapStep('5b')}
                                                                        />
                                                                    </span>
                                                                }
                                                                description='Build a Remixing Map'
                                                                centered
                                                                className='project-roadmap-card'
                                                                extra={
                                                                    <a
                                                                        target='blank'
                                                                        href='https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/07%3A_Remixing_Existing_Content/7.02%3A_Building_Remixing_Maps'
                                                                        rel='noopener noreferrer'
                                                                    >
                                                                        <Icon name='external' />
                                                                        Building Remixing Maps
                                                                    </a>
                                                                }
                                                            />
                                                        </div>
                                                    }
                                                    {(roadmapRequiresRemix === true || roadmapRequiresRemix === null) &&
                                                        <div className={(roadmapRequiresRemix === true) ? 'project-roadmap-step-container' : 'project-roadmap-step-container project-roadmap-step-disabled'}>
                                                            <div className='project-roadmap-arrow-container'>
                                                                <Icon name='arrow right' size='large' fitted />
                                                            </div>
                                                            <Card
                                                                header={
                                                                    <span className='header'>
                                                                        Step 5c: <em>Remixing</em>
                                                                        <Radio
                                                                            className='float-right'
                                                                            checked={currentRoadmapStep === '5c'}
                                                                            onChange={() => updateRoadmapStep('5c')}
                                                                        />
                                                                    </span>
                                                                }
                                                                description='Build Remix using Map & Remixer (blank pages for gaps) in your sandbox'
                                                                centered
                                                                className='project-roadmap-card'
                                                                extra={
                                                                    <a
                                                                        target='blank'
                                                                        href='https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/07%3A_Remixing_Existing_Content/7.03%3A_How_to_Make_a_LibreTexts_Remix'
                                                                        rel='noopener noreferrer'
                                                                    >
                                                                        <Icon name='external' />
                                                                        Remixer Tutorial
                                                                    </a>
                                                                }
                                                            />
                                                        </div>
                                                    }
                                                    {(roadmapRequiresRemix === false || roadmapRequiresRemix === null) &&
                                                        <div className={(roadmapRequiresRemix === false) ? 'project-roadmap-step-container' : 'project-roadmap-step-container project-roadmap-step-disabled'}>
                                                            <div className='project-roadmap-arrow-container'>
                                                                <Icon name='arrow right' size='large' fitted />
                                                            </div>
                                                            <Card
                                                                header={
                                                                    <span className='header'>
                                                                        Step 6: <em>Skeleton</em>
                                                                        <Radio
                                                                            className='float-right'
                                                                            checked={currentRoadmapStep === '6'}
                                                                            onChange={() => updateRoadmapStep('6')}
                                                                        />
                                                                    </span>
                                                                }
                                                                description='Build initial empty text skeleton (i.e. empty pages) using the Remixer in your sandbox'
                                                                className='project-roadmap-card'
                                                                extra={
                                                                    <a
                                                                        target='blank'
                                                                        href='https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/07%3A_Remixing_Existing_Content/7.03%3A_How_to_Make_a_LibreTexts_Remix'
                                                                        rel='noopener noreferrer'
                                                                    >
                                                                        <Icon name='external' />
                                                                        Remixer Tutorial
                                                                    </a>
                                                                }
                                                            />
                                                        </div>
                                                    }
                                                    <div className='project-roadmap-step-container'>
                                                        <div className='project-roadmap-arrow-container'>
                                                            <Icon name='arrow right' size='large' fitted />
                                                        </div>
                                                        <Card
                                                            header={
                                                                <span className='header'>
                                                                    Step 7: <em>Constructing</em>
                                                                    <Radio
                                                                        className='float-right'
                                                                        checked={currentRoadmapStep === '7'}
                                                                        onChange={() => updateRoadmapStep('7')}
                                                                    />
                                                                </span>
                                                            }
                                                            description='Fill in gaps with pre-existing OER content or construct content directly.'
                                                            centered
                                                            className='project-roadmap-card'
                                                            extra={
                                                                <a
                                                                    target='blank'
                                                                    href='https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/03%3A_Basic_Editing'
                                                                    rel='noopener noreferrer'
                                                                >
                                                                    <Icon name='external' />
                                                                    Basic Editing
                                                                </a>
                                                            }
                                                        />
                                                    </div>
                                                    <div className='project-roadmap-step-container'>
                                                        <div className='project-roadmap-arrow-container'>
                                                            <Icon name='arrow right' size='large' fitted />
                                                        </div>
                                                        <Card
                                                            header={
                                                                <span className='header'>
                                                                    Step 8: <em>Editing</em>
                                                                    <Radio
                                                                        className='float-right'
                                                                        checked={currentRoadmapStep === '8'}
                                                                        onChange={() => updateRoadmapStep('8')}
                                                                    />
                                                                </span>
                                                            }
                                                            description='Edit pages to fit faculty/class needs (may require forking of remixed content)'
                                                            centered
                                                            className='project-roadmap-card'
                                                        />
                                                    </div>
                                                    <div className='project-roadmap-step-container'>
                                                        <div className='project-roadmap-arrow-container'>
                                                            <Icon name='arrow right' size='large' fitted />
                                                        </div>
                                                        <Card
                                                            header={
                                                                <span className='header'>
                                                                    Step 9: <em>Advanced</em>
                                                                    <Radio
                                                                        className='float-right'
                                                                        checked={currentRoadmapStep === '9'}
                                                                        onChange={() => updateRoadmapStep('9')}
                                                                    />
                                                                </span>
                                                            }
                                                            description='Work up advanced features (autograded assessments, visualizations, simulations, interactive graphs, etc.)'
                                                            centered
                                                            meta='Optional'
                                                            className='project-roadmap-card'
                                                            extra={
                                                                <a
                                                                    target='blank'
                                                                    href='https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/04%3A_Advanced_Editing'
                                                                    rel='noopener noreferrer'
                                                                >
                                                                    <Icon name='external' />
                                                                    Advanced Editing
                                                                </a>
                                                            }
                                                        />
                                                    </div>
                                                    <div className='project-roadmap-step-container'>
                                                        <div className='project-roadmap-arrow-container'>
                                                            <Icon name='arrow right' size='large' fitted />
                                                        </div>
                                                        <Card
                                                            header={
                                                                <span className='header'>
                                                                    Step 10: <em>Accessibility</em>
                                                                    <Radio
                                                                        className='float-right'
                                                                        checked={currentRoadmapStep === '10'}
                                                                        onChange={() => updateRoadmapStep('10')}
                                                                    />
                                                                </span>
                                                            }
                                                            description='Request a preliminary accessibility check (Bradbot or A11Y bot)'
                                                            centered
                                                            className='project-roadmap-card'
                                                        />
                                                    </div>
                                                    <div className='project-roadmap-step-container'>
                                                        <div className='project-roadmap-arrow-container'>
                                                            <Icon name='arrow right' size='large' fitted />
                                                        </div>
                                                        <Card
                                                            header={
                                                                <span className='header'>
                                                                    Step 11: <em>Publishing</em>
                                                                    <Radio
                                                                        className='float-right'
                                                                        checked={currentRoadmapStep === '11'}
                                                                        onChange={() => updateRoadmapStep('11')}
                                                                    />
                                                                </span>
                                                            }
                                                            description="Request 'publishing' of text: external review of organization, remixer check, Bradbot check, move text into campus bookshelf, compile for PDF/LMS/bookstore export."
                                                            centered
                                                            className='project-roadmap-card'
                                                            extra={
                                                                <Button
                                                                    color='blue'
                                                                    onClick={() => setShowConfirmPublish(true)}
                                                                    fluid
                                                                >
                                                                    Publish Text
                                                                </Button>
                                                            }
                                                        />
                                                    </div>
                                                    <div className='project-roadmap-step-container'>
                                                        <div className='project-roadmap-arrow-container'>
                                                            <Icon name='arrow right' size='large' fitted />
                                                        </div>
                                                        <Card
                                                            header={
                                                                <span className='header'>
                                                                    Step 12: <em>Curating</em>
                                                                    <Radio
                                                                        className='float-right'
                                                                        checked={currentRoadmapStep === '12'}
                                                                        onChange={() => updateRoadmapStep('12')}
                                                                    />
                                                                </span>
                                                            }
                                                            description='Curate text (edit, polish, and hone) in campus bookshelf'
                                                            centered
                                                            className='project-roadmap-card'
                                                        />
                                                    </div>
                                                </div>
                                            </Segment>
                                        </Grid.Column>
                                    }
                                    {(canViewDetails && !showRoadmap) &&
                                        <Grid.Column>
                                            <Segment
                                                raised
                                                clearing
                                            >
                                                <Header as='h2' id='project-roadmap-heading'>Construction Roadmap</Header>
                                                <Button
                                                    floated='right'
                                                    onClick={handleChangeRoadmapVis}
                                                >
                                                    Show
                                                </Button>
                                            </Segment>
                                        </Grid.Column>
                                    }
                                    {!canViewDetails &&
                                        <Grid.Column>
                                            <Header as='h2' dividing>Construction Roadmap</Header>
                                            <Segment
                                                size='large'
                                                raised
                                                className='mb-2p'
                                            >
                                                <p><em>You don't have permission to view this project's Construction Roadmap yet.</em></p>
                                            </Segment>
                                        </Grid.Column>
                                    }
                                </Grid.Row>
                                <Grid.Row>
                                    <Grid.Column>
                                        <Header as='h2' dividing className='mt-1p'>Timeline</Header>
                                        <Menu widths={2}>
                                            <Menu.Item name='ganttview' icon='exchange' content={<p>Gantt View</p>} />
                                            <Menu.Item name='calendarview' icon='calendar alternate outline' content={<p>Calendar View</p>} />
                                        </Menu>
                                        <p><em>Coming soon!</em></p>
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Segment>
                    </Segment.Group>
                    <Modal
                        open={showConfirmPublish}
                        onClose={() => setShowConfirmPublish(false) }
                    >
                        <Modal.Header>Confirm Publish Request</Modal.Header>
                        <Modal.Content>
                            Are you sure you want to request publishing? This will send a request to the LibreTexts team.
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={() => setShowConfirmPublish(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                color='blue'
                                onClick={submitPublishRequest}
                            >
                                Confirm
                            </Button>
                        </Modal.Actions>
                    </Modal>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    );

};

export default ProjectTimeline;
