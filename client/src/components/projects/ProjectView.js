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
  Loader
} from 'semantic-ui-react';
import {
    CircularProgressbar,
    buildStyles
} from 'react-circular-progressbar';
import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import day_of_week from 'date-and-time/plugin/day-of-week';
import axios from 'axios';
import queryString from 'query-string';

import {
    isEmptyString,
    capitalizeFirstLetter,
    normalizeURL,
    truncateString
} from '../util/HelperFunctions.js';

import {
    visibilityOptions
} from '../util/ProjectOptions.js';
import {
    licenseOptions,
    getLicenseText
} from '../util/LicenseOptions.js';

import useGlobalError from '../error/ErrorHooks.js';

const ProjectView = (props) => {

    // Global State and Eror Handling
    const { handleGlobalError } = useGlobalError();

    // UI
    const [loadingData, setLoadingData] = useState(false);
    const [showProjectCreated, setShowProjectCreated] = useState(false);

    // Project Data
    const [project, setProject] = useState({});

    // Change Visibility Modal
    const [showVisModal, setShowVisModal] = useState(false);
    const [projVisibility, setProjVisibility] = useState('');
    const [visModalLoading, setVisModalLoading] = useState(false);

    // Edit Information Modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [editModalLoading, setEditModalLoading] = useState(false);
    const [projTitle, setProjTitle] = useState('');
    //const [projStatus, setProjStatus] = useState('');
    const [projProgress, setProjProgress] = useState(0);
    const [projURL, setProjURL] = useState('');
    const [projTags, setProjTags] = useState([]);
    const [projResAuthor, setProjResAuthor] = useState('');
    const [projResEmail, setProjResEmail] = useState('');
    const [projResLicense, setProjResLicense] = useState('');
    const [projResURL, setProjResURL] = useState('');
    const [projNotes, setProjNotes] = useState('');
    const [projTitleErr, setProjTitleErr] = useState(false);
    const [projProgressErr, setProjProgressErr] = useState(false);
    const [tagOptions, setTagOptions] = useState([]);
    const [loadedTags, setLoadedTags] = useState(false);

    // Manage Collaborators Modal
    const [showCollabsModal, setShowCollabsModal] = useState(false);
    const [collabsUserOptions, setCollabsUserOptions] = useState([]);
    const [collabsUserOptsLoading, setCollabsUserOptsLoading] = useState(false);
    const [collabsUserToAdd, setCollabsUserToAdd] = useState('');
    const [collabsModalLoading, setCollabsModalLoading] = useState(false);

    // Delete Project Modal
    const [showDeleteProjModal, setShowDeleteProjModal] = useState(false);
    const [deleteProjModalLoading, setDeleteProjModalLoading] = useState(false);

    // Complete Project Modal
    const [showCompleteProjModal, setShowCompleteProjModal] = useState(false);
    const [completeProjModalLoading, setCompleteProjModalLoading] = useState(false);

    // New Thread Modal
    const [showNewThreadModal, setShowNewThreadModal] = useState(false);
    const [newThreadTitle, setNewThreadTitle] = useState('');
    const [newThreadLoading, setNewThreadLoading] = useState(false);


    // Delete Thread Modal
    const [showDelThreadModal, setShowDelThreadModal] = useState(false);
    const [delThreadLoading, setDelThreadLoading] = useState(false);


    // Discussion
    const [projectThreads, setProjectThreads] = useState([]);
    const [loadedProjThreads, setLoadedProjThreads] = useState(false);
    const [activeThread, setActiveThread] = useState('');
    const [activeThreadTitle, setActiveThreadTitle] = useState('');
    const [activeThreadMsgs, setActiveThreadMsgs] = useState([]);
    const [loadedThreadMsgs, setLoadedThreadMsgs] = useState(false);
    const [messageCompose, setMessageCompose] = useState('');
    const [messageSending, setMessageSending] = useState(false);


    // Tasks
    const [openTaskDetails, setOpenTaskDetails] = useState([
        true, false, false, false, false
    ]);
    const [projTasks, setProjTasks] = useState([
        {
            open: false,
            id: 1,
            task: {
                name: "Chapter 1"
            }
        },
        {
            open: false,
            id: 2,
            task: {
                name: "Chapter 2"
            }
        },
        {
            open: false,
            id: 3,
            task: {
                name: "Chapter 3"
            }
        },
        {
            open: false,
            id: 4,
            task: {
                name: "Chapter 4"
            }
        },
        {
            open: false,
            id: 5,
            task: {
                name: "Chapter 5"
            }
        }
    ]);


    /**
     * Set page title and load Project information on initial load.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Projects | Project View";
        date.plugin(ordinal);
        date.plugin(day_of_week);
        getProject();
        getDiscussionThreads();
    }, []);


    /**
     * Read URL params and update UI accordingly.
     */
    useEffect(() => {
        const queryValues = queryString.parse(props.location.search);
        if (queryValues.projectCreated === 'true') {
            setShowProjectCreated(true);
        }
    }, [props.location.search]);


    /**
     * Update the page title to the project title when it is available.
     */
    useEffect(() => {
        if (projTitle !== '') {
            document.title = `LibreTexts Conductor | Projects | ${projTitle}`;
        }
    }, [projTitle]);


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


    /**
     * Opens the Change Visibility Modal and sets fields
     * to their current respective values.
     */
    const openVisModal = () => {
        if (project.visibility) {
            setProjVisibility(project.visibility);
        }
        setVisModalLoading(false);
        setShowVisModal(true);
    };


    /**
     * Closes the Change Visibility Modal and resets
     * fields to their default values.
     */
    const closeVisModal = () => {
        setShowVisModal(false);
        setProjVisibility('private');
        setVisModalLoading(false);
    };


    /**
     * Submits the project visibility change (if any) to
     * the server via PUT request, then closes the Change
     * Visibility Modal and re-syncs Project information.
     */
    const submitVisChange = () => {
        var visChange = true;
        if ((project.visibility) && (project.visibility === projVisibility)) visChange = false;
        if (visChange) {
            setVisModalLoading(true);
            axios.put('/project/visibility', {
                projectID: props.match.params.id,
                visibility: projVisibility
            }).then((res) => {
                if (!res.data.err) {
                    closeVisModal();
                    getProject();
                } else {
                    handleGlobalError(res.data.errMsg);
                }
            }).catch((err) => {
                handleGlobalError(err);
                setVisModalLoading(false);
            });
        } else {
            closeVisModal();
        }
    };


    /**
     * Opens the Edit Information Modal and retrieves existing tags,
     * then sets fields to their current respective values.
     */
    const openEditInfoModal = () => {
        setEditModalLoading(true);
        getTags();
        if (project.title) setProjTitle(project.title);
        if (project.hasOwnProperty('currentProgress')) setProjProgress(project.currentProgress);
        if (project.projectURL) setProjURL(project.projectURL);
        if (project.tags) setProjTags(project.tags);
        if (project.author) setProjResAuthor(project.author);
        if (project.authorEmail) setProjResEmail(project.authorEmail);
        if (project.license) setProjResLicense(project.license);
        if (project.resourceURL) setProjResURL(project.resourceURL);
        if (project.notes) setProjNotes(project.notes);
        setEditModalLoading(false);
        setShowEditModal(true);
    };


    /**
     * Closes the Edit Information Modal and resets all
     * fields to their default values.
     */
    const closeEditInfoModal = () => {
        setShowEditModal(false);
        setEditModalLoading(false);
        setProjTitle('');
        setProjProgress(0);
        setProjURL('');
        setProjTags([]);
        setProjResAuthor('');
        setProjResEmail('');
        setProjResLicense('');
        setProjResURL('');
        setProjNotes('');
    };


    /**
     * Load existing Project Tags from the server
     * via GET request, then sort, format, and save
     * them to state for use in the Dropdown.
     */
    const getTags = () => {
        axios.get('/projects/tags/org').then((res) => {
            if (!res.data.err) {
                if (res.data.tags && Array.isArray(res.data.tags)) {
                    res.data.tags.sort((tagA, tagB) => {
                        var aNorm = String(tagA.title).toLowerCase();
                        var bNorm = String(tagB.title).toLowerCase();
                        if (aNorm < bNorm) return -1;
                        if (aNorm > bNorm) return 1;
                        return 0;
                    })
                    const newTagOptions = res.data.tags.map((tagItem) => {
                        return { text: tagItem.title, value: tagItem.title };
                    });
                    setTagOptions(newTagOptions);
                    setLoadedTags(true);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
        }).catch((err) => {
            handleGlobalError(err);
        });
    };


    /**
     * Resets all Edit Information form error states.
     */
    const resetEditInfoFormErrors = () => {
        setProjTitleErr(false);
        setProjProgressErr(false);
    };


    /**
     * Validates the Edit Project Information form.
     * @returns {boolean} true if all fields are valid, false otherwise
     */
    const validateEditInfoForm = () => {
        var validForm = true;
        if (isEmptyString(projTitle)) {
            validForm = false;
            setProjTitleErr(true);
        }
        if ((projProgress < 0) || (projProgress > 100)) {
            validForm = false;
            setProjProgressErr(true);
        }
        return validForm;
    };


    /**
     * Ensure the form data is valid, then submit the
     * data to the server via POST request. Re-syncs
     * Project information on success.
     */
    const submitEditInfoForm = () => {
        resetEditInfoFormErrors();
        if (validateEditInfoForm()) {
            setEditModalLoading(true);
            var projData = {
                projectID: props.match.params.id
            };
            if (project.tags) {
                var newTags = false;
                var originalPlainTags = [];
                if (project.tags) originalPlainTags = project.tags;
                // check if there are any new tags
                projTags.forEach((tag) => {
                    if (!originalPlainTags.includes(tag)) newTags = true;
                });
                // new tags are present or all tags were removed
                if (newTags || (originalPlainTags.length > 0 && projTags.length === 0)) projData.tags = projTags;
            } else {
                projData.tags = projTags;
            }
            if ((project.title && project.title !== projTitle) || !project.title) {
                projData.title = projTitle;
            }
            if ((project.hasOwnProperty('currentProgress') && project.currentProgress !== projProgress) || !project.hasOwnProperty('currentProgress')) {
                projData.progress = projProgress;
            }
            if ((project.projectURL && project.projectURL !== projURL) || !project.projectURL) {
                projData.projectURL = projURL;
            }
            if ((project.author && project.author !== projResAuthor) || !project.author) {
                projData.author = projResAuthor;
            }
            if ((project.authorEmail && project.authorEmail !== projResEmail) || !project.authorEmail) {
                projData.authorEmail = projResEmail;
            }
            if ((project.license && project.license !== projResLicense) || !project.license) {
                projData.license = projResLicense;
            }
            if ((project.resourceURL && project.resourceURL !== projResURL) || !project.resourceURL) {
                projData.resourceURL = projResURL;
            }
            if ((project.notes && project.notes !== projProgress) || !project.notes) {
                projData.notes = projNotes;
            }
            if (Object.keys(projData).length > 1) {
                axios.put('/project', projData).then((res) => {
                    if (!res.data.err) {
                        closeEditInfoModal();
                        getProject();
                    } else {
                        handleGlobalError(res.data.errMsg);
                        setEditModalLoading(false);
                    }
                }).catch((err) => {
                    handleGlobalError(err);
                    setEditModalLoading(false);
                });
            } else {
                // no changes to save
                closeEditInfoModal();
            }
        }
    };


    /**
     * Retrieves a list of users that can be added as collaborators to the
     * project, then processes and sets them in state.
     */
    const getCollabsUserOptions = () => {
        setCollabsUserOptsLoading(true);
        axios.get('/project/collabs/addable', {
            params: {
                projectID: props.match.params.id
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.users && Array.isArray(res.data.users)) {
                    var newOptions = [
                        { key: 'empty', text: 'Clear...', value: '' }
                    ];
                    res.data.users.forEach((item) => {
                        newOptions.push({
                            key: item.uuid,
                            text: `${item.firstName} ${item.lastName}`,
                            value: item.uuid,
                            image: {
                                avatar: true,
                                src: item.avatar
                            }
                        });
                    });
                    setCollabsUserOptions(newOptions);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setCollabsUserOptsLoading(false);
        }).catch((err) => {
            handleGlobalError(err);
            setCollabsUserOptsLoading(false);
        });
    };


    /**
     * Submits a PUT request to the server to add the user
     * in state (collabsUserToAdd) to the project's collaborators list,
     * then refreshes the project data and Addable Collaborators options.
     */
    const submitAddCollaborator = () => {
        if (!isEmptyString(collabsUserToAdd)) {
            setCollabsModalLoading(true);
            axios.put('/project/collabs/add', {
                projectID: props.match.params.id,
                uuid: collabsUserToAdd
            }).then((res) => {
                if (!res.data.err) {
                    setCollabsModalLoading(false);
                    getCollabsUserOptions();
                    getProject();
                } else {
                    handleGlobalError(res.data.errMsg);
                }
                setCollabsModalLoading(false);
            }).catch((err) => {
                handleGlobalError(err);
                setCollabsModalLoading(false);
            });
        }
    };


    /**
     * Submits a PUT request to the server to remove the specified user
     * from the project's collaborators list, then refreshes the
     * project data and Addable Collaborators options.
     * @param  {string} collabUUID  - the uuid of the user to remove
     */
    const submitRemoveCollaborator = (collabUUID) => {
        if (!isEmptyString(collabUUID)) {
            setCollabsModalLoading(true);
            axios.put('/project/collabs/remove', {
                projectID: props.match.params.id,
                uuid: collabUUID
            }).then((res) => {
                if (!res.data.err) {
                    setCollabsModalLoading(false);
                    getCollabsUserOptions();
                    getProject();
                } else {
                    handleGlobalError(res.data.errMsg);
                }
                setCollabsModalLoading(false);
            }).catch((err) => {
                handleGlobalError(err);
                setCollabsModalLoading(false);
            });
        }
    };


    /**
     * Opens the Manage Collaborators Modal and sets the fields to their
     * default values, then triggers the function to retrieve the list of
     * Addable Collaborators.
     */
    const openCollabsModal = () => {
        setCollabsModalLoading(false);
        setCollabsUserOptions([]);
        setCollabsUserToAdd('');
        getCollabsUserOptions();
        setShowCollabsModal(true);
    };


    /**
     * Closes the Manage Collaborators Modal and resets the fields
     * to their default values.
     */
    const closeCollabsModal = () => {
        setShowCollabsModal(false);
        setCollabsUserOptions([]);
        setCollabsUserToAdd('');
        setCollabsUserOptsLoading(false);
        setCollabsModalLoading(false);
    };


    /**
     * Submits a DELETE request to the server to delete the project,
     * then redirects to the Projects dashboard on success.
     */
    const submitDeleteProject = () => {
        setDeleteProjModalLoading(true);
        axios.delete('/project', {
            data: {
                projectID: props.match.params.id
            }
        }).then((res) => {
            setDeleteProjModalLoading(false);
            if (!res.data.err) {
                props.history.push('/projects?projectDeleted=true');
            } else {
                handleGlobalError(res.data.errMsg);
            }
        }).catch((err) => {
            handleGlobalError(err);
            setDeleteProjModalLoading(false);
        });
    };


    /**
     * Submits a PUT request to the server to mark the project as completed,
     * then closes the Complete Project modal and re-syncs the Project data.
     */
    const submitMarkCompleted = () => {
        setCompleteProjModalLoading(true);
        axios.put('/project/complete', {
            projectID: props.match.params.id
        }).then((res) => {
            if (!res.data.err) {
                getProject();
                setCompleteProjModalLoading(false);
                setShowCompleteProjModal(false);
            } else {
                handleGlobalError(res.data.errMsg);
                setCompleteProjModalLoading(false);
            }
        }).catch((err) => {
            handleGlobalError(err);
            setCompleteProjModalLoading(false);
        });
    };


    const getDiscussionThreads = () => {
        setLoadedProjThreads(false);
        axios.get('/project/threads', {
            params: {
                projectID: props.match.params.id
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.threads && Array.isArray(res.data.threads)) {
                    setProjectThreads(res.data.threads);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedProjThreads(true);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedProjThreads(true);
        });
    };


    const getThreadMessages = () => {
        setLoadedThreadMsgs(false);
        axios.get('/project/thread/messages', {
            params: {
                threadID: activeThread
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.messages && Array.isArray(res.data.messages)) {
                    setActiveThreadMsgs(res.data.messages);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedThreadMsgs(true);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedThreadMsgs(true);
        });
    };


    useEffect(() => {
        if (!isEmptyString(activeThread)) {
            getThreadMessages();
        }
    }, [activeThread]);


    const sendMessage = () => {
        if (!isEmptyString(messageCompose)) {
            setMessageSending(true);
            axios.post('/project/thread/message', {
                threadID: activeThread,
                message: messageCompose
            }).then((res) => {
                if (!res.data.err) {
                    getThreadMessages();
                    getDiscussionThreads();
                    setMessageCompose('');
                } else {
                    handleGlobalError(res.data.errMsg);
                }
                setMessageSending(false);
            }).catch((err) => {
                handleGlobalError(err);
                setMessageSending(false);
            });
        }
    };


    const activateThread = (thread) => {
        setActiveThread(thread.threadID);
        setActiveThreadTitle(thread.title);
    };


    const submitNewThread = () => {
        if (!isEmptyString(newThreadTitle)) {
            setNewThreadLoading(true);
            axios.post('/project/thread', {
                projectID: props.match.params.id,
                title: newThreadTitle
            }).then((res) => {
                if (!res.data.err) {
                    getDiscussionThreads();
                    closeNewThreadModal();
                } else {
                    handleGlobalError(res.data.errMsg);
                    setNewThreadLoading(false);
                }
            }).catch((err) => {
                handleGlobalError(err);
                setNewThreadLoading(false);
            });
        }
    };

    const openNewThreadModal = () => {
        setNewThreadLoading(false);
        setNewThreadTitle('');
        setShowNewThreadModal(true);
    };

    const closeNewThreadModal = () => {
        setShowNewThreadModal(false);
        setNewThreadLoading(false);
        setNewThreadTitle('');
    };


    const submitDeleteThread = () => {
        if (!isEmptyString(activeThread)) {
            setDelThreadLoading(true);
            axios.delete('/project/thread', {
                data: {
                    threadID: activeThread
                }
            }).then((res) => {
                if (!res.data.err) {
                    setActiveThread('');
                    setActiveThreadTitle('');
                    setActiveThreadMsgs([]);
                    setLoadedThreadMsgs(false);
                    getDiscussionThreads();
                    closeDelThreadModal();
                } else {
                    setDelThreadLoading(true);
                    handleGlobalError(res.data.errMsg);
                }
            }).catch((err) => {
                handleGlobalError(err);
                setDelThreadLoading(false);
            });
        }
    }


    const openDelThreadModal = () => {
        setDelThreadLoading(false);
        setShowDelThreadModal(true);
    };

    const closeDelThreadModal = () => {
        setShowDelThreadModal(false);
        setDelThreadLoading(false);
    };


    const toggleTaskDetail = (id) => {
        const updatedTasks = projTasks.map((item) => {
            if (id === item.id) {
                return {
                    ...item,
                    open: !item.open
                }
            } else return item;
        });
        setProjTasks(updatedTasks);
    };


    const expandCollapseAllTasks = () => {
        let updatedTasks = [];
        const foundOpen = projTasks.find((item) => {
            return (item.open === true);
        });
        if (foundOpen !== undefined) { // one is open, close them all
            updatedTasks = projTasks.map((item) => {
                return {
                    ...item,
                    open: false
                }
            });
        } else { // all are closed, open them all
            updatedTasks = projTasks.map((item) => {
                return {
                    ...item,
                    open: true
                }
            });
        }
        setProjTasks(updatedTasks);
    };


    // Rendering Helper Booleans
    let hasResourceInfo = project.author || project.license || project.resourceURL;
    let hasNotes = project.notes && !isEmptyString(project.notes);
    let hasCollabs = project.collaborators && Array.isArray(project.collaborators) && project.collaborators.length > 0;


    return(
        <Grid className='component-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Project: <em>{project.title || 'Loading...'}</em></Header>
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
                                <Breadcrumb.Section active>
                                    {project.title || 'Loading...'}
                                </Breadcrumb.Section>
                            </Breadcrumb>
                            <div className='float-right'>
                                <p className='muted-text'>ID: {project.projectID || 'Loading...'}</p>
                            </div>
                        </Segment>
                        <Segment loading={loadingData}>
                            <Grid padded='horizontally' relaxed>
                                {showProjectCreated &&
                                    <Grid.Row>
                                        <Grid.Column width={16}>
                                            <Message floating icon success>
                                                <Icon name='check' />
                                                <Message.Content>
                                                    <Message.Header>Project successfully created!</Message.Header>
                                                </Message.Content>
                                            </Message>
                                        </Grid.Column>
                                    </Grid.Row>
                                }
                                <Grid.Row>
                                    <Grid.Column>
                                        <Button.Group fluid widths={4}>
                                            <Button
                                                color='blue'
                                                loading={editModalLoading}
                                                onClick={openEditInfoModal}
                                            >
                                                <Icon name='edit' />
                                                Edit Information
                                            </Button>
                                            <Button
                                                color='violet'
                                                onClick={openCollabsModal}
                                            >
                                                <Icon name='users' />
                                                Manage Collaborators
                                            </Button>
                                            <Button
                                                color='teal'
                                                onClick={openVisModal}
                                            >
                                                <Icon name='eye' />
                                                Change Visibility
                                            </Button>
                                            <Button
                                                color='green'
                                                onClick={() => setShowCompleteProjModal(true)}
                                            >
                                                <Icon name='check' />
                                                Complete Project
                                            </Button>
                                        </Button.Group>
                                    </Grid.Column>
                                </Grid.Row>
                                <Grid.Row>
                                    <Grid.Column>
                                        <Header as='h2' dividing>Project Information</Header>
                                        <Grid>
                                            <Grid.Row>
                                                <Grid.Column width={3}>
                                                    <CircularProgressbar
                                                        value={project.currentProgress || 0}
                                                        text={`${project.currentProgress || 0}%`}
                                                        strokeWidth={5}
                                                        styles={buildStyles({
                                                            pathColor: '#127BC4',
                                                            textColor: '#127BC4'
                                                        })}
                                                    />
                                                </Grid.Column>
                                                <Grid.Column width={13}>
                                                    <Grid>
                                                        <Grid.Row>
                                                            <Grid.Column width={4}>
                                                                <Header as='span' sub>Status: </Header>
                                                                <span>{project.status ? capitalizeFirstLetter(project.status) : 'Loading...'}</span>
                                                            </Grid.Column>
                                                            <Grid.Column width={4}>
                                                                <Header as='span' sub>Visibility: </Header>
                                                                <span>{project.visibility ? capitalizeFirstLetter(project.visibility) : 'Loading...'}</span>
                                                            </Grid.Column>
                                                            {(project.projectURL && !isEmptyString(project.projectURL)) &&
                                                                <Grid.Column width={8}>
                                                                    <Header as='span' sub>URL: </Header>
                                                                    <a href={normalizeURL(project.projectURL)} target='_blank' rel='noopener noreferrer'>{project.projectURL}</a>
                                                                </Grid.Column>
                                                            }
                                                        </Grid.Row>
                                                        <Grid.Row>
                                                            {(project.owner && project.owner.firstName && project.owner.lastName) &&
                                                                <Grid.Column width={4}>
                                                                    <Header as='span' sub>Project Owner: </Header>
                                                                    <span>{project.owner.firstName} {project.owner.lastName}</span>
                                                                </Grid.Column>
                                                            }
                                                            {(project.tags && Array.isArray(project.tags) && project.tags.length > 0) &&
                                                                <Grid.Column width={12}>
                                                                    <Header as='span' sub>Tags: </Header>
                                                                    <Label.Group color='blue' className='inlineblock-display ml-1p'>
                                                                        {project.tags.map((tag, idx) => {
                                                                            return (
                                                                                <Label key={idx}>{tag}</Label>
                                                                            )
                                                                        })}
                                                                    </Label.Group>
                                                                </Grid.Column>
                                                            }
                                                        </Grid.Row>
                                                    </Grid>
                                                    {hasResourceInfo &&
                                                        <Header as='h3' dividing>Resource</Header>
                                                    }
                                                    {hasResourceInfo &&
                                                        <div>
                                                            {(project.author && !isEmptyString(project.author)) &&
                                                                <div className='mb-1p'>
                                                                    <Header as='span' sub>Author: </Header>
                                                                    <span>{project.author}</span>
                                                                </div>
                                                            }
                                                            {(project.authorEmail && !isEmptyString(project.authorEmail)) &&
                                                                <div className='mt-1p mb-1p'>
                                                                    <Header as='span' sub>Author Email: </Header>
                                                                    <a href={`mailto:${project.authorEmail}`} target='_blank' rel='noopener noreferrer'>{project.authorEmail}</a>
                                                                </div>
                                                            }
                                                            {(project.license && !isEmptyString(project.license)) &&
                                                                <div className='mt-1p mb-1p'>
                                                                    <Header as='span' sub>License: </Header>
                                                                    <span>{getLicenseText(project.license)}</span>
                                                                </div>
                                                            }
                                                            {(project.resourceURL && !isEmptyString(project.resourceURL)) &&
                                                                <div className='mt-1p'>
                                                                    <Header as='span' sub>URL: </Header>
                                                                    <a href={normalizeURL(project.resourceURL)} target='_blank' rel='noopener noreferrer'>{project.resourceURL}</a>
                                                                </div>
                                                            }
                                                        </div>
                                                    }
                                                    {hasNotes &&
                                                        <Header as='h3' dividing>Notes</Header>
                                                    }
                                                    {hasNotes &&
                                                        <p>{project.notes}</p>
                                                    }
                                                </Grid.Column>
                                            </Grid.Row>
                                        </Grid>
                                    </Grid.Column>
                                </Grid.Row>
                                <Grid.Row>
                                    <Grid.Column>
                                        <Header as='h2' dividing>Discussion</Header>
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
                                                                    onClick={openNewThreadModal}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className='flex-col-div' id='project-threads-list-container'>
                                                            {(loadedProjThreads && projectThreads.length > 0) &&
                                                                projectThreads.map((item, idx) => {
                                                                    return (
                                                                        <div className='project-threads-list-item' key={item.threadID} onClick={() => activateThread(item)}>
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
                                                                    onClick={openDelThreadModal}
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
                                                                action={{
                                                                    color: 'blue',
                                                                    icon: 'send',
                                                                    content: 'Send',
                                                                    disabled: ((activeThread === '') || (messageCompose === '')),
                                                                    loading: messageSending,
                                                                    onClick: sendMessage
                                                                }}
                                                                fluid
                                                                onChange={(e) => setMessageCompose(e.target.value)}
                                                                value={messageCompose}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Segment>
                                    </Grid.Column>
                                </Grid.Row>
                                <Grid.Row>
                                    <Grid.Column>
                                        <Header as='h2' dividing>Tasks</Header>
                                        <Segment.Group size='large' raised className='mb-4p'>
                                            <Segment>
                                                <div className='flex-row-div'>
                                                    <div className='left-flex'>
                                                        <Input
                                                            icon='search'
                                                            placeholder='Search tasks...'
                                                            iconPosition='left'
                                                        />
                                                    </div>
                                                    <div className='right-flex'>
                                                        <Button.Group>
                                                            <Button
                                                                color='orange'
                                                                onClick={expandCollapseAllTasks}
                                                            >
                                                                <Icon name='arrows alternate vertical' />
                                                                Expand/Collapse All
                                                            </Button>
                                                            <Button
                                                                color='olive'
                                                            >
                                                                <Icon name='add circle' />
                                                                Batch Add
                                                            </Button>
                                                            <Button
                                                                color='green'
                                                            >
                                                                <Icon name='add' />
                                                                Add Task
                                                            </Button>
                                                        </Button.Group>

                                                    </div>
                                                </div>
                                            </Segment>
                                            <Segment>
                                                <List divided verticalAlign='middle'>
                                                    {projTasks.map((item, idx) => {
                                                        return (
                                                            <List.Item key={item.id}>
                                                                <div className='flex-col-div'>
                                                                    <div className='flex-row-div'>
                                                                        <div className='left-flex'>
                                                                            <Icon
                                                                                name={item.open ? 'chevron down' : 'chevron right'}
                                                                                className='pointer-hover'
                                                                                onClick={() => toggleTaskDetail(item.id)}
                                                                                />
                                                                                <p className='project-task-title'>{item.task.name} {(idx===0) && <Icon name='check' color='green' />}</p>
                                                                        </div>
                                                                      <div className='right-flex'>
                                                                          <Button icon='search' color='blue'></Button>
                                                                      </div>
                                                                    </div>
                                                                    <div className={item.open ? 'project-task-detail' : 'project-task-detail hidden'}>
                                                                        <List divided verticalAlign='middle'>
                                                                            <List.Item className='project-task-subtask'>
                                                                                <div className='flex-row-div'>
                                                                                    <div className='left-flex'>
                                                                                        <Icon
                                                                                            name='circle outline'
                                                                                            />
                                                                                            <p className='project-task-title'>Subtask 1</p>
                                                                                    </div>
                                                                                  <div className='right-flex'>
                                                                                      <Button icon='search' color='blue'></Button>
                                                                                  </div>
                                                                                </div>
                                                                            </List.Item>
                                                                            <List.Item className='project-task-subtask'>
                                                                                <div className='flex-row-div'>
                                                                                    <div className='left-flex'>
                                                                                        <Icon
                                                                                            name='circle outline'
                                                                                            />
                                                                                            <p className='project-task-title'>Subtask 2</p>
                                                                                    </div>
                                                                                  <div className='right-flex'>
                                                                                      <Button icon='search' color='blue'></Button>
                                                                                  </div>
                                                                                </div>
                                                                            </List.Item>
                                                                        </List>
                                                                    </div>
                                                                </div>
                                                            </List.Item>
                                                        )
                                                    })}
                                                </List>
                                            </Segment>
                                        </Segment.Group>
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Segment>
                    </Segment.Group>
                    {/* Edit Project Information Modal */}
                    <Modal
                        open={showEditModal}
                        closeOnDimmerClick={false}
                        size='large'
                    >
                        <Modal.Header>Edit Project Information</Modal.Header>
                        <Modal.Content>
                            <Form noValidate>
                                <Header as='h3'>Project Overview</Header>
                                <Form.Field
                                    required
                                    error={projTitleErr}
                                >
                                    <label>Project Title</label>
                                    <Form.Input
                                        type='text'
                                        placeholder='Enter the project title...'
                                        onChange={(e) => setProjTitle(e.target.value)}
                                        value={projTitle}
                                    />
                                </Form.Field>
                                <Form.Field
                                    error={projProgressErr}
                                >
                                    <label>Current Progress</label>
                                    <Form.Input
                                        name='currentProgress'
                                        type='number'
                                        placeholder='Enter current estimated progress...'
                                        min='0'
                                        max='100'
                                        onChange={(e) => setProjProgress(e.target.value)}
                                        value={projProgress}
                                    />
                                </Form.Field>
                                <Form.Field>
                                    <label>Project URL <span className='muted-text'>(if applicable)</span></label>
                                    <Form.Input
                                        name='projectURL'
                                        type='url'
                                        placeholder='Enter project URL...'
                                        onChange={(e) => setProjURL(e.target.value)}
                                        value={projURL}
                                    />
                                </Form.Field>
                                <Form.Dropdown
                                    label='Project Tags'
                                    placeholder='Search tags...'
                                    multiple
                                    search
                                    selection
                                    allowAdditions
                                    options={tagOptions}
                                    loading={!loadedTags}
                                    disabled={!loadedTags}
                                    onChange={(_e, { value }) => setProjTags(value)}
                                    onAddItem={(_e, { value }) => setTagOptions([{ text: value, value }, ...tagOptions])}
                                    renderLabel={(tag) => ({
                                        color: 'blue',
                                        content: tag.text
                                    })}
                                    value={projTags}
                                />
                                <Divider />
                                <Header as='h3'>Resource Information</Header>
                                <p><em>Use this section if your project pertains to a particular resource or tool.</em></p>
                                <Form.Group widths='equal'>
                                    <Form.Field>
                                        <label>Author</label>
                                        <Form.Input
                                            name='resourceAuthor'
                                            type='text'
                                            placeholder='Enter resource author name...'
                                            onChange={(e) => setProjResAuthor(e.target.value)}
                                            value={projResAuthor}
                                        />
                                    </Form.Field>
                                    <Form.Field>
                                        <label>Author's Email</label>
                                        <Form.Input
                                            name='resourceEmail'
                                            type='email'
                                            placeholder="Enter resource author's email..."
                                            onChange={(e) => setProjResEmail(e.target.value)}
                                            value={projResEmail}
                                        />
                                    </Form.Field>
                                </Form.Group>
                                <Form.Group widths='equal'>
                                    <Form.Select
                                        fluid
                                        label='License'
                                        placeholder='License...'
                                        options={licenseOptions}
                                        onChange={(_e, { value }) => setProjResLicense(value)}
                                        value={projResLicense}
                                    />
                                    <Form.Field>
                                        <label>Original URL</label>
                                        <Form.Input
                                            name='resourceURL'
                                            type='url'
                                            placeholder='Enter resource URL...'
                                            onChange={(e) => setProjResURL(e.target.value)}
                                            value={projResURL}
                                        />
                                    </Form.Field>
                                </Form.Group>
                                <Divider />
                                <Header as='h3'>Additional Information</Header>
                                <Form.Field>
                                    <label>Notes</label>
                                    <Form.TextArea
                                        name='notes'
                                        onChange={(e) => setProjNotes(e.target.value)}
                                        value={projNotes}
                                        placeholder='Enter additional notes here...'
                                    />
                                </Form.Field>
                            </Form>
                            <Accordion className='mt-2p' panels={[{
                                key: 'danger',
                                title: {
                                    content: <span className='color-semanticred'><strong>Danger Zone</strong></span>
                                },
                                content: {
                                    content: (
                                        <div>
                                            <p className='color-semanticred'>Use caution with the options in this area!</p>
                                            <Button
                                                color='red'
                                                fluid
                                                onClick={() => setShowDeleteProjModal(true)}
                                            >
                                                <Icon name='trash alternate' />
                                                Delete Project
                                            </Button>
                                        </div>
                                    )
                                }
                            }]} />
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeEditInfoModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                icon
                                labelPosition='left'
                                color='green'
                                loading={editModalLoading}
                                onClick={submitEditInfoForm}
                            >
                                <Icon name='save' />
                                Save Changes
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Manage Collaborators Modal */}
                    <Modal
                        open={showCollabsModal}
                        onClose={closeCollabsModal}
                        size='large'
                    >
                        <Modal.Header>Manage Project Collaborators</Modal.Header>
                        <Modal.Content scrolling>
                            <Form noValidate>
                                <Form.Select
                                    search
                                    label='Add Collaborator'
                                    placeholder='Choose...'
                                    options={collabsUserOptions}
                                    onChange={(_e, { value }) => {
                                        setCollabsUserToAdd(value);
                                    }}
                                    value={collabsUserToAdd}
                                    loading={collabsUserOptsLoading}
                                    disabled={collabsUserOptsLoading}
                                />
                                <Button
                                    fluid
                                    disabled={isEmptyString(collabsUserToAdd)}
                                    color='green'
                                    loading={collabsModalLoading}
                                    onClick={submitAddCollaborator}
                                >
                                    <Icon name='add user' />
                                    Add Collaborator
                                </Button>
                            </Form>
                            <Divider />
                            {(hasCollabs) &&
                                <List divided verticalAlign='middle'>
                                    {project.collaborators.map((item, idx) => {
                                        return (
                                            <List.Item key={idx}>
                                                <List.Content floated='right'>
                                                    <Button
                                                        color='red'
                                                        onClick={() => submitRemoveCollaborator(item.uuid)}
                                                    >
                                                        Remove
                                                    </Button>
                                                </List.Content>
                                                <Image avatar src={item.avatar} />
                                                <List.Content>{item.firstName} { item.lastName}</List.Content>
                                            </List.Item>
                                        )
                                    })}
                                </List>
                            }
                            {(!hasCollabs) &&
                                <p className='text-center'><em>No collaborators added.</em></p>
                            }
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                color='blue'
                                loading={collabsModalLoading}
                                onClick={closeCollabsModal}
                            >
                                Done
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Change Visibility Modal */}
                    <Modal
                        open={showVisModal}
                        onClose={closeVisModal}
                    >
                        <Modal.Header>Change Project Visibility</Modal.Header>
                        <Modal.Content>
                            <Form noValidate>
                                <Form.Select
                                    fluid
                                    label={<label>Visibility <span className='muted-text'>(defaults to Private)</span></label>}
                                    selection
                                    options={visibilityOptions}
                                    value={projVisibility}
                                    onChange={(_e, { value }) => setProjVisibility(value)}
                                />
                            </Form>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeVisModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                icon
                                labelPosition='left'
                                color='green'
                                loading={visModalLoading}
                                onClick={submitVisChange}
                            >
                                <Icon name='save' />
                                Save
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Confirm Delete Modal */}
                    <Modal
                        open={showDeleteProjModal}
                        closeOnDimmerClick={false}
                    >
                        <Modal.Header>Confirm Project Deletion</Modal.Header>
                        <Modal.Content>
                            <p>Are you sure you want to delete this project? <strong>This cannot be undone.</strong></p>
                            <Button
                                color='red'
                                fluid
                                loading={deleteProjModalLoading}
                                onClick={submitDeleteProject}
                            >
                                <Icon name='trash alternate' />
                                Delete Project
                            </Button>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={() => setShowDeleteProjModal(false)}
                            >
                                Cancel
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Complete Project Modal */}
                    <Modal
                        open={showCompleteProjModal}
                        onClose={() => setShowCompleteProjModal(false)}
                    >
                        <Modal.Header>Complete Project</Modal.Header>
                        <Modal.Content>
                            <p className='text-center'>Are you sure you want to mark this project as completed?</p>
                            {(project.hasOwnProperty('currentProgress') && project.currentProgress < 100) &&
                                <p className='text-center'><em>This project has not reached 100% progress yet.</em></p>
                            }
                            <Button
                                color='green'
                                loading={completeProjModalLoading}
                                onClick={submitMarkCompleted}
                                fluid
                            >
                                <Icon name='check circle' />
                                Mark Completed
                            </Button>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={() => setShowCompleteProjModal(false)}
                            >
                                Cancel
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* New Discussion Thread Modal */}
                    <Modal
                        open={showNewThreadModal}
                        onClose={closeNewThreadModal}
                    >
                        <Modal.Header>Create a Thread</Modal.Header>
                        <Modal.Content>
                            <Form noValidate>
                                <Form.Field>
                                    <label>Thread Title</label>
                                    <Input
                                        type='text'
                                        icon='comments'
                                        iconPosition='left'
                                        placeholder='Enter thread title or topic...'
                                        onChange={(e) => setNewThreadTitle(e.target.value)}
                                        value={newThreadTitle}
                                    />
                                </Form.Field>
                            </Form>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeNewThreadModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                color='green'
                                loading={newThreadLoading}
                                onClick={submitNewThread}
                            >
                                <Icon name='add' />
                                Create Thread
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Delete Discussion Thread Modal */}
                    <Modal
                        open={showDelThreadModal}
                        onClose={closeDelThreadModal}
                    >
                        <Modal.Header>Delete Thread</Modal.Header>
                        <Modal.Content>
                            <p>Are you sure you want to delete the <strong>{activeThreadTitle}</strong> thread?</p>
                            <p><em>This will delete all messages within the thread.</em></p>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeDelThreadModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                color='red'
                                loading={delThreadLoading}
                                onClick={submitDeleteThread}
                            >
                                <Icon name='trash' />
                                Delete Thread
                            </Button>
                        </Modal.Actions>
                    </Modal>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    );

};

export default ProjectView;
