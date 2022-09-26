import './Projects.css'
import '../peerreview/PeerReview.css';
import 'react-circular-progressbar/dist/styles.css';

import {
    Grid,
    Header,
    Segment,
    Icon,
    Button,
    Breadcrumb,
    List,
    Dropdown,
    Popup,
    Modal,
    Divider,
    Form,
    Message,
    Loader
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import day_of_week from 'date-and-time/plugin/day-of-week';
import axios from 'axios';

import useGlobalError from '../error/ErrorHooks.js';
import {
    checkCanViewProjectDetails,
    checkProjectAdminPermission,
    checkProjectMemberPermission,
    getPeerReviewAuthorText
} from '../util/ProjectHelpers.js';

import Messaging from '../Messaging';
import PeerReview from '../peerreview/PeerReview.jsx';
import PeerReviewView from '../peerreview/PeerReviewView.jsx';

const ProjectPeerReview = (props) => {

    // Global State and Eror Handling
    const { handleGlobalError } = useGlobalError();
    const user = useSelector((state) => state.user);

    // UI
    const [loadingData, setLoadingData] = useState(false);
    const [showDiscussion, setShowDiscussion] = useState(false);
    const [reviewSort, setReviewSort] = useState('author');
    const [prShow, setPRShow] = useState(false);

    // Project Data
    const [project, setProject] = useState({});
    const [peerReviews, setPeerReviews] = useState([]);
    const [displayReviews, setDisplayReviews] = useState([]);
    const [reviewAverage, setReviewAverage] = useState(0);
    const [prSettingsSaved, setPRSettingsSaved] = useState(false);

    // Project Permissions
    const [canViewDetails, setCanViewDetails] = useState(false);
    const [userProjectMember, setUserProjectMember] = useState(false);

    // View Review Modal
    const [prViewShow, setPRViewShow] = useState(false);
    const [prViewData, setPRViewData] = useState({});

    // Peer Review Settings
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [settingsAllowAnon, setSettingsAllowAnon] = useState(true);
    const [settingsPreferred, setSettingsPreferred] = useState('');
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [settingsRubrics, setSettingsRubrics] = useState([]);
    const [settingsRubricsLoading, setSettingsRubricsLoading] = useState(false);
    const [settingsShowPreview, setSettingsShowPreview] = useState(false);
    const [settingsPreviewID, setSettingsPreviewID] = useState('');
    const [settingsUnsaved, setSettingsUnsaved] = useState(false);

    // Invite Reviewer Modal
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteIncludeURL, setInviteIncludeURL] = useState(true);
    const [inviteSending, setInviteSending] = useState(false);
    const [inviteSent, setInviteSent] = useState(false);
    const [inviteCopied, setInviteCopied] = useState(false);
    const [inviteEmailErr, setInviteEmailErr] = useState(false);

    // Delete Review Modal
    const [showDelModal, setShowDelModal] = useState(false);
    const [delReviewID, setDelReviewID] = useState('');
    const [delAuthor, setDelAuthor] = useState('');
    const [delLoading, setDelLoading] = useState(false);


    /**
     * Retrieves the Project information via GET request
     * to the server and saves it to state.
     */
    const getProject = useCallback(() => {
        if (typeof (props.match.params.id) === 'string' && props.match.params.id.length > 0) {
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
        }
    }, [props.match, setProject, setLoadingData, handleGlobalError]);


    /**
     * Retrieves the Project's Peer Reviews from the server and enters them into state.
     */
    const getReviews = useCallback(() => {
        setLoadingData(true);
        axios.get('/peerreviews', {
            params: {
                projectID: props.match.params.id
            }
        }).then((res) => {
            if (!res.data.err) {
                if (Array.isArray(res.data.reviews)) {
                    setPeerReviews(res.data.reviews);
                }
                if (typeof (res.data.averageRating) === 'number') {
                    setReviewAverage(res.data.averageRating);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadingData(false);
        }).catch((err) => {
            setLoadingData(false);
            handleGlobalError(err);
        });
    }, [props.match, setPeerReviews, setReviewAverage, setLoadingData, handleGlobalError]);


    /**
     * Set page title and get Project information on initial load.
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
    }, [getProject, setShowDiscussion]);


    /*
     * Get Project's restricted details when the permission changes.
     */
    useEffect(() => {
        if (canViewDetails) {
            getReviews();
        }
    }, [canViewDetails, getReviews]);


    /**
     * Update the page title to the project title when it is available.
     */
    useEffect(() => {
        if (project.title && project.title !== '') {
            document.title = `LibreTexts Conductor | Projects | ${project.title} | Peer Review`;
        }
    }, [project]);

    /*
     * Update state with user's permissions within the project when
     * their identity and the project data is available.
     */
    useEffect(() => {
        if (typeof (user.uuid) === 'string' && user.uuid !== '' && Object.keys(project).length > 0) {
            let adminPermissions = checkProjectAdminPermission(project, user);
            if (adminPermissions) {
                setUserProjectMember(true);
                setCanViewDetails(true);
            } else if (checkProjectMemberPermission(project, user)) {
                setUserProjectMember(true);
                setCanViewDetails(true);
            } else {
                setCanViewDetails(checkCanViewProjectDetails(project, user));
            }
        }
    }, [project, user, setUserProjectMember, setCanViewDetails]);


    /**
     * Sorts the list of reviews and updates state whenever the sort choice or project's reviews change.
     */
    useEffect(() => {
        if (Array.isArray(peerReviews) && reviewSort.length > 0) {
            const sorted = [...peerReviews].sort((a, b) => {
                let aKey = null;
                let bKey = null;
                if (reviewSort === 'author' && typeof (a.author) === 'string' && typeof (b.author) === 'string') {
                    aKey = a.author.toLowerCase().replace(/[^A-Za-z]+/g, "");
                    bKey = b.author.toLowerCase().replace(/[^A-Za-z]+/g, "");
                } else { // data
                    aKey = new Date(a.createdAt);
                    bKey = new Date(b.createdAt);
                }
                if (aKey < bKey) return -1;
                if (aKey > bKey) return 1;
                return 0;
            });
            setDisplayReviews(sorted);
        }
    }, [peerReviews, reviewSort, setDisplayReviews])


    /**
     * Updates state and local storage with the user's choice to show or hide the
     * Peer Review discussion.
     */
    const handleChangeDiscussionVis = () => {
        setShowDiscussion(!showDiscussion);
        localStorage.setItem('conductor_show_peerdiscussion', !showDiscussion);
    };


    /**
     * Opens the Peer Review View Modal and passes the specified review into state
     * for the Modal to access.
     * @param {Object} peerReview - A Peer Review data object.
     */
    const openReviewViewModal = (peerReview) => {
        if (typeof (peerReview) === 'object') {
            setPRViewData(peerReview);
            setPRViewShow(true);
        }
    };


    /**
     * Closes the Peer Review View Modal and resets associated state.
     */
    const handleCloseReviewView = () => {
        setPRViewShow(false);
        setPRViewData({});
    };


    /**
     * Closes the New Peer Review Modal, then refreshes the list of reviews.
     */
    const handleClosePeerReview = () => {
        setPRShow(false);
        getReviews();
    };


    /**
     * Opens the Peer Review Settings Modal and retrieves a list of available Peer Review
     * Rubrics from the server.
     */
    const handleOpenSettingsModal = () => {
        if (project.hasOwnProperty('allowAnonPR')) setSettingsAllowAnon(project.allowAnonPR);
        if (project.hasOwnProperty('preferredPRRubric')) setSettingsPreferred(project.preferredPRRubric);
        setShowSettingsModal(true);
        setSettingsLoading(false);
        setSettingsUnsaved(false);
        setSettingsRubricsLoading(true);
        axios.get('/peerreview/rubrics').then((res) => {
            if (!res.data.err) {
                if (Array.isArray(res.data.rubrics)) setSettingsRubrics(res.data.rubrics);
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setSettingsRubricsLoading(false);
        }).catch((err) => {
            setSettingsRubricsLoading(false);
            handleGlobalError(err);
        });
    };


    /**
     * Closes the Peer Review Settings Modal and resets its state.
     */
    const handleCloseSettingsModal = () => {
        setShowSettingsModal(false);
        setSettingsAllowAnon(true);
        setSettingsPreferred('');
        setSettingsLoading(false);
        setSettingsUnsaved(false);
        setSettingsRubrics([]);
        setSettingsRubricsLoading(false);
    };


    /**
     * Opens the Rubric Preview Modal and enters the requested Rubric's
     * identifier into state.
     * @param {String} rubricID - The identifier of the requested Rubric.
     */
    const handleOpenRubricPreviewModal = (rubricID) => {
        if (typeof (rubricID) === 'string' && rubricID.length > 0) {
            setSettingsPreviewID(rubricID);
            setSettingsShowPreview(true);
        }
    };


    /**
     * Closes the Rubric Preview Modal and resets associated state.
     */
    const handleCloseRubricPreviewModal = () => {
        setSettingsShowPreview(false);
        setSettingsPreviewID('');
    };


    /**
     * Submits an update to the server with the Project's updated Peer Review Settings (if necessary),
     * then closes the Peer Review Settings Modal.
     */
    const savePeerReviewSettings = () => {
        let updateObj = {
            projectID: props.match.params.id
        };
        if ((project.allowAnonPR !== settingsAllowAnon) || !project.hasOwnProperty('allowAnonPR')) {
            updateObj.allowAnonPR = settingsAllowAnon;
        }
        if ((project.preferredPRRubric !== settingsPreferred) || !project.hasOwnProperty('preferredPRRubric')) {
            updateObj.preferredPRRubric = settingsPreferred;
        }
        if (Object.keys(updateObj).length > 1) {
            setSettingsLoading(true);
            axios.put('/project', updateObj).then((res) => {
                if (!res.data.err) {
                    setPRSettingsSaved(true);
                    handleCloseSettingsModal();
                    getProject();
                } else {
                    setSettingsLoading(false);
                    handleGlobalError(res.data.errMsg);
                }
            }).catch((err) => {
                setSettingsLoading(false);
                handleGlobalError(err);
            });
        } else {
            // no changes to save
            handleCloseSettingsModal();
        }
    };


    /**
     * Sends a request to the server to invite a reviewer given the email in state,
     * then resets the invite form on success.
     */
    const handleSendInvite = () => {
        setInviteEmailErr(false);
        if (inviteEmail.length > 0 && inviteEmail.length < 1000) {
            setInviteSending(true);
            axios.post('/peerreview/invite', {
                projectID: props.match.params.id,
                inviteEmail: inviteEmail,
                sendProjectURL: inviteIncludeURL
            }).then((res) => {
                if (!res.data.err) {
                    setInviteSent(true);
                    setInviteEmail('');
                } else {
                    handleGlobalError(res.data.errMsg);
                }
                setInviteSending(false);
            }).catch((err) => {
                setInviteSending(false);
                handleGlobalError(err);
            });
        } else {
            setInviteEmailErr(true);
        }
    };


    /**
     * Closes the Invite Reviewer Modal and resets its state.
     */
    const closeInviteModal = () => {
        setShowInviteModal(false);
        setInviteEmail('');
        setInviteIncludeURL(true);
        setInviteEmailErr(false);
        setInviteCopied(false);
        setInviteSending(false);
        setInviteSent(false);
    };


    /**
     * Opens the Delete Peer Review Modal and enters information about the selected review into state. 
     * @param {String} reviewID - The internal identifier of the review to delete.
     * @param {String} reviewAuthor - The display name of the review's author
     */
    const openDeleteModal = (reviewID, reviewAuthor) => {
        if (typeof (reviewID) === 'string' && typeof (reviewAuthor) === 'string' && reviewID.length > 0) {
            setDelReviewID(reviewID);
            setDelAuthor(reviewAuthor);
            setDelLoading(false);
            setShowDelModal(true);
        }
    };


    /**
     * Closes the Delete Peer Review modal and resets its state.
     */
    const closeDeleteModal = () => {
        setShowDelModal(false);
        setDelLoading(false);
        setDelReviewID('');
        setDelAuthor('');
    };


    /**
     * Submits a request to delete the selected review (in state) to the server,
     * then closes the Delete Peer Review modal and refreshes the list of reviews.
     */
    const submitDeleteReview = () => {
        if (delReviewID.length > 0) {
            setDelLoading(true);
            axios.delete('/peerreview', {
                data: {
                    peerReviewID: delReviewID
                }
            }).then((res) => {
                if (!res.data.err) {
                    closeDeleteModal();
                    getReviews();
                } else {
                    setDelLoading(false);
                    handleGlobalError(res.data.errMsg);
                }
            }).catch((err) => {
                setDelLoading(false);
                handleGlobalError(err);
            });
        }
    };


    /**
     * Sorting options for the list of Peer Reviews.
     */
    const reviewsSortOptions = [
        { key: 'author', text: 'Sort by Reviewer Name', value: 'author' },
        { key: 'date', text: 'Sort by Date', value: 'date' }
    ];


    // Rendering permission helpers
    let openAccessPR = project.visibility === 'public' && (project.allowAnonPR === true || !project.hasOwnProperty('allowAnonPR'));


    return (
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
                        <Segment>
                            <Grid>
                                <Grid.Row>
                                    {canViewDetails &&
                                        <Grid.Column>
                                            <Header as='h2' dividing className='mt-1p'>Peer Reviews</Header>
                                            {prSettingsSaved && (
                                                <Message
                                                    positive
                                                    icon='check'
                                                    content='Peer Review Settings updated!'
                                                    className='mt-1p mb-2p'
                                                />
                                            )}
                                            <Segment.Group size='large' raised className='mb-4p'>
                                                <Segment>
                                                    <div className='flex-row-div'>
                                                        <div className='left-flex'>
                                                            <Dropdown
                                                                placeholder='Sort by...'
                                                                options={reviewsSortOptions}
                                                                selection
                                                                value={reviewSort}
                                                                onChange={(_e, { value }) => setReviewSort(value)}
                                                            />
                                                        </div>
                                                        <div className='right-flex'>
                                                            <Button.Group fluid>
                                                                {openAccessPR ? (
                                                                    <Button
                                                                        color='purple'
                                                                        onClick={() => setShowInviteModal(true)}
                                                                    >
                                                                        <Icon name='paper plane' />
                                                                        Invite Reviewer
                                                                    </Button>
                                                                ) : (
                                                                    <Popup
                                                                        trigger={(
                                                                            <Button className='cursor-notallowed'>
                                                                                <Icon name='paper plane' />
                                                                                Invite Reviewer
                                                                            </Button>
                                                                        )}
                                                                        position='top center'
                                                                        content={(
                                                                            <p className='text-center'>
                                                                                Project must have <strong>Public</strong> <em>Visibility</em> and <em>Peer Reviews from Non-Conductor Users</em> <strong>allowed</strong>.
                                                                            </p>
                                                                        )}
                                                                    />
                                                                )}
                                                                {userProjectMember &&
                                                                    <Button
                                                                        color='blue'
                                                                        onClick={handleOpenSettingsModal}
                                                                    >
                                                                        <Icon name='settings' />
                                                                        Peer Review Settings
                                                                    </Button>
                                                                }
                                                                {(userProjectMember || openAccessPR) && (
                                                                    <Button
                                                                        color='green'
                                                                        onClick={() => setPRShow(true)}
                                                                    >
                                                                        <Icon name='add' />
                                                                        New Review
                                                                    </Button>
                                                                )}
                                                            </Button.Group>
                                                        </div>
                                                    </div>
                                                    <div className='flex-row-div project-peerreview-stats'>
                                                        <div className='center-flex'>
                                                            <p><strong>Reviews: </strong> {displayReviews.length}</p>
                                                        </div>
                                                        <div className='center-flex'>
                                                            <p>
                                                                <strong>Average Rating:</strong>
                                                                {(typeof(project.rating) === 'number' && project.rating > 0) ? (
                                                                    <span> {reviewAverage}/5</span>
                                                                ) : (
                                                                    <span className='muted-text'> N/A</span>
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </Segment>
                                                <Segment
                                                    loading={loadingData}
                                                    className={(displayReviews.length === 0) ? 'muted-segment' : ''}
                                                >
                                                    {(displayReviews.length > 0) ? (
                                                        <List divided>
                                                            {displayReviews.map((item) => {
                                                                const itemDate = new Date(item.createdAt);
                                                                item.dateTime = date.format(itemDate, 'MMM DDD, YYYY h:mm A');
                                                                return (
                                                                    <List.Item key={item.peerReviewID}>
                                                                        <div className='flex-row-div mt-05p mb-05p'>
                                                                            <div className='left-flex'>
                                                                                <div className='flex-col-div'>
                                                                                    <span className='peerreview-list-title'>{item.author || "Unknown Reviewer"}</span>
                                                                                    <span className='peerreview-list-detail muted-text'>
                                                                                        <em>{getPeerReviewAuthorText(item.authorType)}</em> <>&#8226;</> {item.dateTime}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            <div className='right-flex'>
                                                                                <Popup
                                                                                    trigger={(
                                                                                        <Button
                                                                                            icon='trash'
                                                                                            color='red'
                                                                                            onClick={() => openDeleteModal(item.peerReviewID, item.author)}
                                                                                        />
                                                                                    )}
                                                                                    position='top center'
                                                                                    content='Delete Review'
                                                                                />
                                                                                <Popup
                                                                                    trigger={(
                                                                                        <Button
                                                                                            icon='eye'
                                                                                            color='blue'
                                                                                            onClick={() => openReviewViewModal(item)}
                                                                                        />
                                                                                    )}
                                                                                    position='top center'
                                                                                    content='View Review'
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </List.Item>
                                                                )
                                                            })}
                                                        </List>
                                                    ) : (
                                                        <p className='muted-text text-center mt-3p mb-3p'>No Peer Reviews yet!</p>
                                                    )}
                                                </Segment>
                                            </Segment.Group>
                                        </Grid.Column>
                                    }
                                    {!canViewDetails &&
                                        <Grid.Column>
                                            <Header as='h2' dividing>Peer Reviews</Header>
                                            <Segment
                                                size='large'
                                                raised
                                                className='mb-2p'
                                            >
                                                <p><em>You don't have permission to view this project's Peer Reviews yet.</em></p>
                                            </Segment>
                                        </Grid.Column>
                                    }
                                </Grid.Row>
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
                                                <Messaging
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
                            </Grid>
                        </Segment>
                    </Segment.Group>
                    {/* Peer Review Settings Modal */}
                    <Modal
                        open={showSettingsModal}
                        onClose={handleCloseSettingsModal}
                        size='large'
                    >
                        <Modal.Header>Peer Review Settings</Modal.Header>
                        <Modal.Content scrolling>
                            {settingsUnsaved && (
                                <Message warning className='mb-3p'>
                                    <Message.Content>
                                        <p><Icon name='warning sign' /> You have unsaved changes!</p>
                                    </Message.Content>
                                </Message>
                            )}
                            <Form noValidate>
                                <Header as='p' size='small'>Privacy Settings</Header>
                                <Form.Select
                                    fluid
                                    label={(
                                        <label>
                                            <span className='mr-05p'>Allow Peer Reviews from Non-Conductor Users</span>
                                            <Popup
                                                trigger={<Icon name='info circle' />}
                                                position='top center'
                                                content={(
                                                    <span className='text-center'>
                                                        Only applies if Project has 'Public' visibility. <em>Defaults to Yes.</em>
                                                    </span>
                                                )}
                                            />
                                        </label>
                                    )}
                                    selection
                                    options={[
                                        { key: 'true', text: 'Yes', value: true },
                                        { key: 'false', text: 'No', value: false }
                                    ]}
                                    value={settingsAllowAnon}
                                    onChange={(_e, { value }) => {
                                        setSettingsAllowAnon(value);
                                        if ((project.allowAnonPR !== value) || (!project.hasOwnProperty('allowAnonPR'))) {
                                            setSettingsUnsaved(true);
                                        }
                                    }}
                                />
                                <Header as='p' size='small' className='mt-4p'>Preferred Rubric</Header>
                                <p className='muted-text mb-2p'>
                                    <em>Select a Peer Review Rubric below to choose the rubric that is shown to new reviewers. Otherwise, your Campus' or LibreTexts' default rubric will be used.</em>
                                </p>
                                {(settingsRubrics.length === 0 && !settingsRubricsLoading) && (
                                    <p className='mt-2p mb-2p muted-text text-center'>No Rubrics available right now.</p>
                                )}
                                {(settingsRubrics.length > 0 && !settingsRubricsLoading) && (
                                    <List divided>
                                        {settingsRubrics.map((item) => {
                                            return (
                                                <List.Item key={item.rubricID}>
                                                    <div className='flex-row-div'>
                                                        <div className='left-flex'>
                                                            <div className='flex-col-div'>
                                                                <span className='peerreview-list-title'>{item.rubricTitle || "Unknown Rubric"}</span>
                                                                <span className='peerreview-list-detail muted-text'>
                                                                    {item.organization?.shortName || "Unknown Organization"}
                                                                    {(item.isOrgDefault === true) && (
                                                                        <span> <em>(Campus Default)</em></span>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className='right-flex'>
                                                            <Button.Group>
                                                                {(settingsPreferred !== item.rubricID) ? (
                                                                    <Button
                                                                        color='teal'
                                                                        onClick={() => {
                                                                            setSettingsPreferred(item.rubricID);
                                                                            if (item.rubricID !== project.preferredPRRubric) {
                                                                                setSettingsUnsaved(true);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <Icon name='heart outline' />
                                                                        Set as Preferred Rubric
                                                                    </Button>
                                                                ) : (
                                                                    <Button disabled>
                                                                        <Icon name='heart' color='red' />
                                                                        Preferred Rubric
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    color='blue'
                                                                    onClick={() => handleOpenRubricPreviewModal(item.rubricID)}
                                                                >
                                                                    <Icon name='eye' />
                                                                    Preview Rubric
                                                                </Button>
                                                            </Button.Group>
                                                        </div>
                                                    </div>
                                                </List.Item>
                                            )
                                        })}
                                    </List>
                                )}
                                {settingsRubricsLoading && (
                                    <Loader active inline='centered' className='mt-2p mb-2p' />
                                )}
                            </Form>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={handleCloseSettingsModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                color='green'
                                loading={settingsLoading}
                                onClick={savePeerReviewSettings}
                            >
                                <Icon name='save' />
                                Save Changes
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Invite Reviewer Modal */}
                    <Modal
                        open={showInviteModal}
                        onClose={closeInviteModal}
                    >
                        <Modal.Header>Invite Reviewer</Modal.Header>
                        <Modal.Content>
                            <p>You can send an invite to a reviewer without a Conductor account using the form below. Otherwise, we recommend adding reviewers to this Project as <em>Auditors</em>.</p>
                            {inviteSent &&
                                <Message
                                    positive
                                    content={<span><Icon name='check' /> Invitation sent!</span>}
                                />
                            }
                            <Form>
                                {(typeof (project.projectURL) === 'string' && project.projectURL.length > 0) && (
                                    <Form.Checkbox
                                        label={(
                                            <label>Include this Project's <em>Project URL</em>
                                                <span className='muted-text'> (recommended)</span>
                                            </label>
                                        )}
                                        checked={inviteIncludeURL === true}
                                        onChange={() => setInviteIncludeURL(!inviteIncludeURL)}
                                    />
                                )}
                                <Form.Input
                                    type='email'
                                    value={inviteEmail}
                                    onChange={(_e, { value }) => setInviteEmail(value)}
                                    placeholder='Enter an email...'
                                    action={{
                                        color: 'green',
                                        labelPosition: 'right',
                                        icon: 'paper plane',
                                        content: 'Send Invite',
                                        loading: inviteSending,
                                        onClick: handleSendInvite
                                    }}
                                    fluid
                                    error={inviteEmailErr}
                                    className='mt-2p mb-2p'
                                />
                            </Form>
                            <Divider horizontal>Or</Divider>
                            <p>You can also share this link with others to allow them to review with or without a Conductor account!</p>
                            <Form>
                                {inviteCopied &&
                                    <Message
                                        positive
                                        content={<span><Icon name='check' /> Copied to clipboard!</span>}
                                    />
                                }
                                <Form.Input
                                    type='url'
                                    value={`commons.libretexts.org/peerreview/${props.match.params.id}`}
                                    placeholder='Peer Review URL...'
                                    action={{
                                        labelPosition: 'right',
                                        icon: 'copy outline',
                                        content: 'Copy Link',
                                        color: 'teal',
                                        onClick: () => {
                                            try {
                                                navigator.clipboard.writeText(`commons.libretexts.org/peerreview/${props.match.params.id}`);
                                                setInviteCopied(true);
                                            } catch (e) {
                                                console.error(e);
                                            }
                                        }
                                    }}
                                    fluid
                                    readOnly
                                    className='mt-2p mb-2p'
                                />
                            </Form>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                color='blue'
                                onClick={closeInviteModal}
                            >
                                Done
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Delete Review Modal */}
                    <Modal
                        open={showDelModal}
                        onClose={closeDeleteModal}
                    >
                        <Modal.Header>Delete Peer Review</Modal.Header>
                        <Modal.Content>
                            <p>Are you sure you want to delete this Peer Review by {delAuthor} <span className='muted-text'>(ID: {delReviewID})</span>? <strong>This cannot be undone.</strong></p>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeDeleteModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                color='red'
                                loading={delLoading}
                                onClick={submitDeleteReview}
                            >
                                <Icon name='trash' />
                                Delete Review
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Peer Review Rubric Preview */}
                    <PeerReview
                        open={settingsShowPreview}
                        onClose={handleCloseRubricPreviewModal}
                        rubricID={settingsPreviewID}
                        demoView={true}
                    />
                    {/* New Peer Review */}
                    <PeerReview
                        open={prShow}
                        onClose={handleClosePeerReview}
                        projectID={props.match.params.id}
                    />
                    <PeerReviewView
                        open={prViewShow}
                        onClose={handleCloseReviewView}
                        peerReviewData={prViewData}
                        publicView={false}
                    />
                </Grid.Column>
            </Grid.Row>
        </Grid>
    );

};

export default ProjectPeerReview;
