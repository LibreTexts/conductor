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
    const [openRoadmapStep, setOpenRoadmapStep] = useState('');
    const [openRoadmapStepInfo, setOpenRoadmapStepInfo] = useState({});

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


    const roadmapSteps = [
        {
            key: '1',
            title: 'Step 1',
            name: 'Vision',
            description: (
                <div>
                    <p><strong>Construct a vision of your book.</strong></p>
                    <p>Are you creating a new book from all original content, or looking to edit/adapt/remix existing content into a new OER? Either way, LibreTexts has what you need to get started: an easy to use WYSIWYG interface for editing, personal sandboxes to help keep track of your work, our state of the art Remixer for mixing existing and new content together, and more.</p>
                </div>
            ),
            hasExtra: true,
            linkHref: 'https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/02%3A_A_Framework_for_Designing_Online_Texts',
            linkTitle: 'Designing Online Texts'
        }, {
            key: '2',
            title: 'Step 2',
            name: 'Accounts',
            description: (
                <div>
                    <p><strong>Obtain Proper LibreTexts Accounts.</strong></p>
                    <p>In order to get started with LibreTexts, you first need to create a free instructor account by filling out the form below.</p>
                </div>
            ),
            hasExtra: true,
            linkHref: 'https://register.libretexts.org/',
            linkTitle: 'Register at LibreTexts'
        }, {
            key: '3',
            title: 'Step 3',
            name: 'Training',
            description: (
                <div>
                    <p><strong>Review remixing and editing fundamentals.</strong></p>
                    <p>We have put together a comprehensive construction guide for easy reference as you get started creating your OER on the LibreTexts platform. <a href='https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/07%3A_Remixing_Existing_Content' target='_blank' rel='noopener noreferrer'>Chapter 7</a> of the construction guide covers what you need to know to get started with our Remixer. <a href='https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/03%3A_Basic_Editing' target='_blank' rel='noopener noreferrer'>Chapter 3</a> covers basic editing.</p>
                </div>
            ),
            hasExtra: false,
            linkHref: 'https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/03%3A_Basic_Editing',
            linkTitle: 'Basic Editing'
        }, {
            key: '4',
            title: 'Step 4',
            name: '',
            description: (
                <div>
                    <p>Does your Vision require remixing of existing content?</p>
                </div>
            ),
            hasExtra: true,
            linkHref: 'https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/07%3A_Remixing_Existing_Content',
            linkTitle: 'Remixing Existing Content'
        }, {
            key: '5a',
            title: 'Step 5a',
            name: 'Scan',
            description: (
                <div>
                    <p><strong>Review & evaluate existing content on LibreTexts and identify gaps.</strong></p>
                    <p>LibreTexts is divided into 14 discipline specific libraries of content. In order to determine whether or not OER on your topic already exists you can search within one of these libraries. If you know something exists but cannot find it in LibreTexts, please let us know by filling out one of our <a href='https://harvest.libretexts.org' target='_blank' rel='noopener noreferrer'>Harvest Request</a> forms and we will be happy to import the content for you to use in your project.</p>
                </div>
            ),
            hasExtra: false,
            linkHref: '',
            linkTitle: ''
        }, {
            key: '5b',
            title: 'Step 5b',
            name: 'Mapping',
            description: (
                <div>
                    <p><strong>Build a remixing map.</strong></p>
                    <p>We recommend you begin creating your OER on LibreTexts by creating what we call a remixing map. A remixing map can be created using any software you prefer, but should include all of the existing OER you plan to use in your project as well as the order in which it should be used. You can see a sample remixing map in the construction guide <a href='https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/07%3A_Remixing_Existing_Content/7.02%3A_Building_Remixing_Maps' target='_blank' rel='noopener noreferrer'>here</a>. Building a map before you begin remixing will save you time as you will have all of your resources listed out in order and will be better able to find them quickly in the Remixer.</p>
                </div>
            ),
            hasExtra: false,
            linkHref: 'https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/07%3A_Remixing_Existing_Content/7.02%3A_Building_Remixing_Maps',
            linkTitle: 'Building Remixing Maps'
        }, {
            key: '5c',
            title: 'Step 5c',
            name: 'Remixing',
            description: (
                <div>
                    <p><strong>Build Remix using Map and Remixer (blank pages for gaps) in sandbox.</strong></p>
                    <p>Your remix map will help guide you through selecting your chosen resources within the remixer. The <a href='https://chem.libretexts.org/Under_Construction/Development_Details/OER_Remixer' target='_blank' rel='noopener noreferrer'>Remixer</a> consists of two panels and utilizes an easy drag and drop process to create new OER. Simply select one of the libraries in the Library Panel on the left hand side of the Remixer and navigate to the resource you need in either the Campus Bookshelves, Bookshelves, or Learning Objects section of your chosen library. You can then use the plus signs to expand the list of items as you go. Once you have found what you’re looking for, drag it to the Remix Panel in whatever order you have determined on your remix map. The Remixer will automatically renumber your chapters, sections, and pages as you go. You may insert blank pages as page holders for creating new content by clicking on the plus sign for New Page in the gray menu bar. Once your remix is ready to upload to your sandbox, you can click on the green Save to Server button. You can continue to work on your OER from your sandbox once it has been uploaded from the Remixer. </p>
                </div>
            ),
            hasExtra: true,
            linkHref: 'https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/07%3A_Remixing_Existing_Content/7.03%3A_How_to_Make_a_LibreTexts_Remix',
            linkTitle: 'Remixer Tutorial'
        }, {
            key: '6',
            title: 'Step 6',
            name: 'Skeleton',
            description: (
                <div>
                    <p><strong>Build initial empty text skeleton (i.e. empty pages) using the Remixer in your sandbox.</strong></p>
                    <p>If your vision does not include remixing existing OER to create a new resource, and instead you wish to start building from scratch, you can build an empty text skeleton in the <a href='https://chem.libretexts.org/Under_Construction/Development_Details/OER_Remixer' target='_blank' rel='noopener noreferrer'>Remixer</a> and upload it to your sandbox for easier editing.</p>
                </div>
            ),
            hasExtra: true,
            linkHref: 'https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/07%3A_Remixing_Existing_Content/7.03%3A_How_to_Make_a_LibreTexts_Remix',
            linkTitle: 'Remixer Tutorial'
        }, {
            key: '7',
            title: 'Step 7',
            name: 'Constructing',
            description: (
                <div>
                    <p><strong>Fill in gaps with pre-existing OER content or construct content directly.</strong></p>
                    <p>Once you have saved either your remix or an empty text skeleton to your sandbox, you can begin editing your content by filling in any gaps with either new or existing content.</p>
                </div>
            ),
            hasExtra: true,
            linkHref: 'https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/03%3A_Basic_Editing',
            linkTitle: 'Basic Editing'
        }, {
            key: '8',
            title: 'Step 8',
            name: 'Editing',
            description: (
                <div>
                    <p><strong>Edit pages to fit faculty/class needs (may require forking of remixed content).</strong></p>
                    <p>You can edit any chapter, section, or page in your text by clicking on the Edit button from the black menu bar after you have navigated to the content you wish to edit; this will open the content in an HTML editor where you can add or remove content. You may need to fork content in your remix as you edit. Forking means to make a copy of the original content by severing the connection to the original source; when you form content your copy of the content will no longer be automatically updated when the original source is updated. To fork content click on the blue Y shaped icon next to the title; a pop up will appear asking if you’d like to fork the content. Additional information on forking can be found in <a href='https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/04%3A_Advanced_Editing/4.02%3A_Forking_a_Transcluded_(Reused)_Page' target='_blank' rel='noopener noreferrer'>Chapter 4</a> of the Construction Guide. </p>
                </div>
            ),
            hasExtra: false,
            linkHref: '',
            linkTitle: ''
        }, {
            key: '9',
            title: 'Step 9',
            name: 'Advanced',
            description: (
                <div>
                    <p><strong>Work up advanced features (autograded assessments, visualizations, simulations, interactive graphs, etc.).</strong></p>
                    <p>Additional information on advanced features can be found in <a href='https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/05%3A_Interactive_Elements' target='_blank' rel='noopener noreferrer'>Chapter 5</a> of the Construction Guide.</p>
                </div>
            ),
            hasExtra: false,
            linkHref: 'https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/04%3A_Advanced_Editing',
            linkTitle: 'Advanced Editing',
            optional: true
        }, {
            key: '10',
            title: 'Step 10',
            name: 'Accessibility',
            description: (
                <div>
                    <p><strong>Request a preliminary accessibility check (Bradbot or A11Y bot).</strong></p>
                    <p>LibreTexts has two bots developed specifically to ensure all of our content meets accessibility requirements. Once your text is complete we will run it through our Bradbot and A11Y bot to identify and correct any accessibility compliance issues.</p>
                </div>
            ),
            hasExtra: false,
            linkHref: '',
            linkTitle: ''
        }, {
            key: '11',
            title: 'Step 11',
            name: 'Publishing',
            description: (
                <div>
                    <p><strong>Request 'publishing' of text.</strong></p>
                    <p>Once you deem your text is ready to be published, contact us <a href='mailto:info@libretexts.org' target='_blank' rel='noopener noreferrer'>(info@libretexts.org)</a> or use the button below and we will prepare it for publication on the Campus Bookshelves. Before publishing a text, it goes through an external review of its organization in order to ensure it complies with the standard organization present in all LibreTexts resources. It will also undergo a remixer check, and be checked by our Bradbot accessibility bot to ensure it meets current accessibility standards. Once these steps are complete, the text will be moved to your Campus Bookshelf where it can be compiled for PDF, LMS, or (print) bookstore export.</p>
                </div>
            ),
            hasExtra: false,
            linkHref: '',
            linkTitle: ''
        }, {
            key: '12',
            title: 'Step 12',
            name: 'Curating',
            description: (
                <div>
                    <p><strong>Curate text (edit, polish, and hone) in campus bookshelf.</strong></p>
                    <p>LibreTexts are never considered finished as none of our resources are considered static. Rather, once a text has been published to one of the Campus Bookshelves it can then be curated, or edited, polished, and honed.</p>
                </div>
            ),
            hasExtra: false,
            linkHref: '',
            linkTitle: ''
        }
    ];

    const activateRoadmapStep = (key) => {
        let foundStep = roadmapSteps.find(item => item.key === key);
        if (foundStep !== undefined) {
            setOpenRoadmapStep(foundStep.key);
            setOpenRoadmapStepInfo(foundStep);
        }
    };

    const renderRoadmapStep = (item, idx) => {
        let listClassName = 'project-roadmap-steps-list-item flex-row-div';
        if (['5a', '5b', '5c', '6'].includes(item.key) && roadmapRequiresRemix === null) {
            listClassName = 'project-roadmap-steps-list-item flex-row-div project-roadmap-step-disabled';
        } else {
            if (openRoadmapStep === item.key) {
                listClassName = 'project-roadmap-steps-list-item flex-row-div active';
            }
        }
        return (
            <div
                className={listClassName}
                key={idx}
                onClick={() => activateRoadmapStep(item.key)}
            >
                <div className='project-roadmap-step-list-info'>
                    <Radio
                        checked={currentRoadmapStep === item.key}
                        onChange={() => updateRoadmapStep(item.key)}
                        className='project-roadmap-step-radio'
                    />
                    <p
                        className={(openRoadmapStep === item.key)
                            ? 'project-roadmap-steps-list-title active'
                            : 'project-roadmap-steps-list-title'
                        }
                    >
                        {item.title}
                        {item.name &&
                            <span>: <em>{item.name}</em></span>
                        }
                        {item.optional &&
                            <span className='muted-text small-text'> (optional)</span>
                        }
                    </p>
                </div>
                <div className='right-flex project-roadmap-step-list-icon'>
                    <Icon
                        name='chevron right'
                    />
                </div>
            </div>
        )
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
                                                    <div id='project-roadmap-steps'>
                                                        <div className='flex-col-div' id='project-roadmap-steps-container'>
                                                            <div className='flex-row-div' id='project-roadmap-steps-header-container'>
                                                                <div className='left-flex'>
                                                                    <Header as='h3'>Steps</Header>
                                                                </div>
                                                            </div>
                                                            <div className='flex-col-div' id='project-roadmap-steps-list-container'>
                                                                {(roadmapRequiresRemix === true) &&
                                                                    roadmapSteps.filter(item => item.key !== '6').map(renderRoadmapStep)
                                                                }
                                                                {(roadmapRequiresRemix === false) &&
                                                                    roadmapSteps.filter(item => item.key !== '5a' && item.key !== '5b' && item.key !== '5c').map(renderRoadmapStep)
                                                                }
                                                                {(roadmapRequiresRemix === null) &&
                                                                    roadmapSteps.map(renderRoadmapStep)
                                                                }
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div id='project-roadmap-stepdetail'>
                                                        <div className='flex-col-div' id='project-roadmap-stepdetail-container'>
                                                            <div className='flex-row-div' id='project-roadmap-stepdetail-header-container'>
                                                                <Header as='h3'>
                                                                    {openRoadmapStepInfo.key
                                                                        ? ((openRoadmapStepInfo.name)
                                                                            ? <span>Step {openRoadmapStepInfo.key}: <em>{openRoadmapStepInfo.name}</em></span>
                                                                            : <span>Step {openRoadmapStepInfo.key}</span>
                                                                        )
                                                                        : <em>Step Detail</em>
                                                                    }
                                                                </Header>
                                                            </div>
                                                            <div id='project-roadmap-stepdetail-info-container'>
                                                                {openRoadmapStepInfo.key &&
                                                                    openRoadmapStepInfo.description
                                                                }
                                                                {openRoadmapStepInfo.hasExtra &&
                                                                    <a
                                                                        className='project-roadmap-steps-link'
                                                                        href={openRoadmapStepInfo.linkHref}
                                                                        target='_blank'
                                                                        rel='noopener noreferrer'
                                                                    >
                                                                        <Icon name='external' />
                                                                        {openRoadmapStepInfo.linkTitle}
                                                                    </a>
                                                                }
                                                                {(openRoadmapStepInfo.key === '4') &&
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
                                                                }
                                                                {openRoadmapStepInfo.key === '11' &&
                                                                    <Button
                                                                        color='blue'
                                                                        onClick={() => setShowConfirmPublish(true)}
                                                                        fluid
                                                                        className='mt-2p'
                                                                    >
                                                                        Publish Text
                                                                    </Button>
                                                                }
                                                                {!openRoadmapStepInfo.key &&
                                                                    <p className='text-center muted-text mt-4r'><em>Select a step from the list on the left.</em></p>
                                                                }
                                                            </div>
                                                        </div>
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


/**
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
**/
