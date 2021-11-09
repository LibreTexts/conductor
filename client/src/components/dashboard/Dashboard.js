import './Dashboard.css';

import {
    Grid,
    Header,
    Menu,
    List,
    Image,
    Segment,
    Divider,
    Message,
    Icon,
    Button,
    Modal,
    Form,
    Feed
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import queryString from 'query-string';
import DOMPurify from 'dompurify';
import marked from 'marked';

import ConductorTextArea from '../util/ConductorTextArea';

import {
    truncateString,
    capitalizeFirstLetter,
    isEmptyString
} from '../util/HelperFunctions.js';
import useGlobalError from '../error/ErrorHooks.js';

const Dashboard = (props) => {

    const { handleGlobalError } = useGlobalError();
    const user = useSelector((state) => state.user);
    const org = useSelector((state) => state.org);

    /* Data */
    const [announcements, setAnnouncements] = useState([]);
    const [recentAnnouncement, setRecentAnnouncement] = useState({});
    const [projects, setProjects] = useState([]);
    const [recentProjects, setRecentProjects] = useState([]);

    /* UI */
    const [currentView, setCurrentView] = useState('home');
    const [loadedAllAnnouncements, setLoadedAllAnnouncements] = useState(false);
    const [loadedRecentAnnouncement, setLoadedRecentAnnouncement] = useState(false);
    const [loadedAllProjects, setLoadedAllProjects] = useState(false);
    const [loadedRecentProjects, setLoadedRecentProjects] = useState(false);
    const [hasRecentAnnouncement, setHasRecentAnnouncement] = useState(false);
    const [showNASuccess, setShowNASuccess] = useState(false);

    // New Announcement Modal
    const [showNAModal, setShowNAModal] = useState(false);
    const [naTitle, setNATitle] = useState('');
    const [naMessage, setNAMessage] = useState('');
    const [naGlobal, setNAGlobal] = useState(false);
    const [naTitleError, setNATitleError] = useState(false);
    const [naMessageError, setNAMessageError] = useState(false);

    // Announcement View Modal
    const [showAVModal, setShowAVModal] = useState(false);
    const [avAnnouncement, setAVAnnouncement] = useState({});
    const [avModalLoading, setAVModalLoading] = useState(false);

    // New Member Modal
    const [showNMModal, setShowNMModal] = useState(false);

    useEffect(() => {
        const queryValues = queryString.parse(props.location.search);
        if (queryValues.newmember === 'true') {
            setShowNMModal(true);
        }
    }, [props.location.search]);

    /**
     * Setup page & title on load and
     * load recent data.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Dashboard";
        date.plugin(ordinal);
        // Hook to force message links to open in new window
        DOMPurify.addHook('afterSanitizeAttributes', function (node) {
          if ('target' in node) {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer')
          }
        });
        getRecentAnnouncement();
        getRecentProjects();
    }, []);

    /**
     * Change the current Dashboard View
     */
    useEffect(() => {
        switch(currentView) {
            case 'announcements':
                getAnnouncements();
                break;
            case 'projects':
                getProjects();
                break;
            default:
                break; // silence React warning
        }
    }, [currentView]);

    /**
     * Accepts a standard ISO 8601 @dateInput
     * and parses the date and time to
     * human-readable format.
     */
    const parseDateAndTime = (dateInput) => {
        const dateInstance = new Date(dateInput);
        return {
            date: date.format(dateInstance, 'ddd, MMM DDD, YYYY'),
            time: date.format(dateInstance, 'h:mm A')
        }
    };

    /**
     * Load the most recent announcement via GET
     * request and update the UI accordingly.
     */
    const getRecentAnnouncement = () => {
        axios.get('/announcements/recent').then((res) => {
            if (!res.data.err) {
                if (res.data.announcement !== null) {
                    const { date, time } = parseDateAndTime(res.data.announcement.createdAt);
                    setRecentAnnouncement({
                        ...res.data.announcement,
                        date: date,
                        time: time
                    });
                    setHasRecentAnnouncement(true);
                } else {
                    setHasRecentAnnouncement(false);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedRecentAnnouncement(true);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedRecentAnnouncement(true);
        });
    };

    /**
     * Load the most recent project via GET
     * request and update the UI accordingly.
     */
    const getRecentProjects = () => {
        axios.get('/projects/recent').then((res) => {
            if (!res.data.err) {
                if (res.data.projects && Array.isArray(res.data.projects)) {
                    setRecentProjects(res.data.projects);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedRecentProjects(true);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedRecentProjects(true);
        });
    };

    /**
     * Load the 50 most recent announcements via GET
     * request and update the UI accordingly.
     */
    const getAnnouncements = () => {
        axios.get('/announcements/all').then((res) => {
            if (!res.data.err) {
                if (res.data.announcements && Array.isArray(res.data.announcements)) {
                    var announcementsForState = [];
                    res.data.announcements.forEach((item) => {
                        const { date, time } = parseDateAndTime(item.createdAt);
                        const newAnnouncement = {
                            ...item,
                            date: date,
                            time: time,
                            rawDate: item.createdAt
                        };
                        announcementsForState.push(newAnnouncement);
                    });
                    announcementsForState.sort((a, b) => {
                        const date1 = new Date(a.rawDate);
                        const date2 = new Date(b.rawDate);
                        return date2 - date1;
                    });
                    setAnnouncements(announcementsForState);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedAllAnnouncements(true);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedAllAnnouncements(true);
        });
    };

    /**
     * Load the user's active projects via GET
     * request and update the UI accordingly.
     */
    const getProjects = () => {
        axios.get('/projects/all').then((res) => {
            if (!res.data.err) {
                if (res.data.projects && Array.isArray(res.data.projects)) {
                    setProjects(res.data.projects);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedAllProjects(true);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedAllProjects(true);
        });
    };

    /**
     * Open the New Announcement modal and ensure
     * all form fields are reset to their defaults.
     */
    const openNAModal = () => {
        resetNAForm();
        setNATitle('');
        setNAMessage('');
        setNAGlobal(false);
        setShowNAModal(true);
    };

    /**
     * Close the New Announcement modal and
     * reset the form.
     */
    const closeNAModal = () => {
        setShowNAModal(false);
        resetNAForm();
        setNATitle('');
        setNAMessage('');
        setNAGlobal(false);
    };

    /**
     * Reset all New Announcement form
     * error states
     */
    const resetNAForm = () => {
        setNATitleError(false);
        setNAMessageError(false);
    };

    /**
     * Validate the New Announcement form data,
     * return 'false' if validation errors
     * exists, 'true' otherwise
     */
    const validateNAForm = () => {
        var validForm = true;
        if (isEmptyString(naTitle)) {
            validForm = false;
            setNATitleError(true);
        }
        if (isEmptyString(naMessage)) {
            validForm = false;
            setNAMessageError(true);
        }
        return validForm;
    };

    /**
     * Submit data via POST to the server, then
     * call closeNAModal() on success
     * and reload announcements.
     */
    const postNewAnnouncement = () => {
        resetNAForm();
        if (validateNAForm()) {
            axios.post('/announcement', {
                title: naTitle,
                message: naMessage,
                global: naGlobal
            }).then((res) => {
                if (!res.data.err) {
                    setShowNASuccess(true);
                    closeNAModal();
                    getRecentAnnouncement();
                    getAnnouncements();
                } else {
                    throw(res.data.errMsg);
                }
            }).catch((err) => {
                handleGlobalError(err);
            });
        }
    };

    /**
     * Open the Announcement View modal
     * and bring the request announcement
     * into state.
     */
    const openAVModal = (idx) => {
        if (announcements[idx] !== undefined) {
            setAVAnnouncement(announcements[idx]);
            setAVModalLoading(false);
            setShowAVModal(true);
        }
    };

    /**
     * Close the Announcement View modal
     * and reset state to the empty announcement.
     */
    const closeAVModal = () => {
        setShowAVModal(false);
        setAVAnnouncement({});
        setAVModalLoading(false);
    };

    /**
     * Submit a DELETE request to the server to delete the announcement
     * currently open in the Announcement View Modal, then close
     * the modal and reload announcements on success.
     */
    const deleteAnnouncement = () => {
        if (avAnnouncement._id && avAnnouncement._id !== '') {
            setAVModalLoading(true);
            axios.delete('/announcement', {
                data: {
                    announcementID: avAnnouncement._id
                }
            }).then((res) => {
                if (!res.data.err) {
                    closeAVModal();
                    getAnnouncements();
                } else {
                    handleGlobalError(res.data.errMsg);
                    setAVModalLoading(false);
                }
            }).catch((err) => {
                handleGlobalError(err);
                setAVModalLoading(false);
            });
        }
    };

    /**
     * Render the appropriate Dashboard View
     * according to the current selected view
     * in state.
     */
    const View = (props) => {
        switch(currentView) {
            case 'announcements':
                return (
                    <Segment>
                        <Grid verticalAlign='middle'>
                            <Grid.Row columns={2}>
                                <Grid.Column>
                                    <Header as='h2' className='announcements-header'>
                                        Announcements <span className='gray-span'>(50 most recent)</span>
                                    </Header>
                                </Grid.Column>
                                <Grid.Column>
                                    {((user.hasOwnProperty('isCampusAdmin') && user.isCampusAdmin === true) ||
                                        (user.hasOwnProperty('isCampusAdmin') && user.isSuperAdmin === true)) &&
                                        <Button color='green' floated='right' onClick={openNAModal}>
                                            <Icon name='add' />
                                            New
                                        </Button>
                                    }
                                </Grid.Column>
                            </Grid.Row>
                        </Grid>
                        <Divider />
                        {showNASuccess &&
                            <Message
                                onDismiss={() => setShowNASuccess(false)}
                                header='Announcement Successfully Posted!'
                                icon='check circle outline'
                                positive
                            />
                        }
                        <Segment
                            basic
                            className='announcements-segment'
                            loading={!loadedAllAnnouncements}
                        >
                            <Feed>
                            {announcements.map((item, index) => {
                                return (
                                    <Feed.Event key={index} onClick={() => openAVModal(index)} className='announcement'>
                                        <Feed.Label image={`${item.author.avatar}`} />
                                        <Feed.Content className='announcement-content'>
                                            <Feed.Summary>
                                                {item.title}
                                                <Feed.Date className='announcement-details'>by {item.author.firstName} {item.author.lastName} on {item.date} at {item.time} </Feed.Date>
                                            </Feed.Summary>
                                            <p className='announcement-text' dangerouslySetInnerHTML={{
                                                __html: DOMPurify.sanitize(marked(truncateString(item.message, 250)))
                                            }}></p>
                                        </Feed.Content>
                                    </Feed.Event>
                                );
                            })}
                            </Feed>
                            {announcements.length === 0 &&
                                <p>No recent announcements.</p>
                            }
                        </Segment>
                    </Segment>
                );
            case 'projects':
                return (
                    <Segment>
                        <Header as='h2'>Your Projects</Header>
                        <Divider />
                        <Segment
                            basic
                            loading={!loadedAllProjects}
                        >
                            <List
                                divided
                                size='large'
                                relaxed='very'
                            >
                            {(projects.length > 0) &&
                                projects.map((item) => {
                                    const itemDate = new Date(item.updatedAt);
                                    item.updatedDate = date.format(itemDate, 'MMM DDD, YYYY');
                                    item.updatedTime = date.format(itemDate, 'h:mm A');
                                    return (
                                        <List.Item key={item.projectID} className='dashboard-list-item'>
                                            <List.Icon name='folder' size='large' verticalAlign='middle' />
                                            <List.Content>
                                                <List.Header as={Link} to={`/projects/${item.projectID}`}>
                                                    {item.title}
                                                </List.Header>
                                                <List.Description>
                                                    <span className='project-meta gray-span'>
                                                        Last updated on {item.updatedDate} at {item.updatedTime}
                                                    </span>
                                                </List.Description>
                                            </List.Content>
                                        </List.Item>
                                    );
                                })
                            }
                            {(projects.length === 0) &&
                                <p>You don't have any projects right now.</p>
                            }
                            </List>
                        </Segment>
                    </Segment>
                );
            default: // Home
                return (
                    <Segment>
                        <Header as='h2'>Home</Header>
                        <Divider />
                        <Segment basic>
                            <Header size='medium' onClick={() => setCurrentView('announcements')} className='pointer-hover'>
                                Announcements <span className='gray-span'>(most recent)</span>
                            </Header>
                            {!loadedRecentAnnouncement &&
                                <p><em>Loading...</em></p>
                            }
                            {(loadedRecentAnnouncement && hasRecentAnnouncement) &&
                                <Message icon>
                                    <Icon name='announcement' circular fitted className='recent-announcement-icon' />
                                    <Message.Content className='recent-announcement-content'>
                                        <Message.Header className="recent-announcement-title">{recentAnnouncement.title}</Message.Header>
                                        <p dangerouslySetInnerHTML={{
                                            __html: DOMPurify.sanitize(marked(truncateString(recentAnnouncement.message, 250)))
                                        }}></p>
                                        <p className='recent-announcement-meta gray-span'>by {recentAnnouncement.author?.firstName} {recentAnnouncement.author?.lastName} on {recentAnnouncement.date} at {recentAnnouncement.time}</p>
                                    </Message.Content>
                                </Message>
                            }
                            {(loadedRecentAnnouncement && !hasRecentAnnouncement) &&
                                <p>There are no recent announcements right now.</p>
                            }
                        </Segment>
                        <Divider />
                        <Segment basic>
                            <Header size='medium' onClick={() => setCurrentView('projects')} className='pointer-hover'>
                                Your Projects <span className='gray-span'>(overview)</span>
                            </Header>
                            <List divided size='large' relaxed='very'>
                                {!loadedRecentProjects &&
                                    <p><em>Loading...</em></p>
                                }
                                {(loadedRecentProjects && recentProjects.length > 0) &&
                                    recentProjects.map((item) => {
                                        const itemDate = new Date(item.updatedAt);
                                        item.updatedDate = date.format(itemDate, 'MMM DDD, YYYY');
                                        item.updatedTime = date.format(itemDate, 'h:mm A');
                                        return (
                                            <List.Item key={item.projectID}>
                                              <List.Icon name='folder' size='large' verticalAlign='middle' />
                                              <List.Content>
                                                <List.Header as={Link} to={`/projects/${item.projectID}`}>
                                                    {item.title}
                                                </List.Header>
                                                <List.Description>
                                                    <span className='project-meta gray-span'>
                                                        Last updated on {item.updatedDate} at {item.updatedTime}
                                                    </span>
                                                </List.Description>
                                              </List.Content>
                                            </List.Item>
                                        );
                                    })
                                }
                                {(loadedRecentProjects && recentProjects.length === 0) &&
                                    <p>You have no recent projects right now.</p>
                                }
                            </List>
                        </Segment>
                    </Segment>
                );
        }
    };

    return (
        <Grid className='component-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Dashboard</Header>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column width={3}>
                    <Menu vertical fluid>
                        <Menu.Item>
                            <Header as='h1'>
                                <Image circular src={`${user.avatar}`} className='menu-avatar' />
                                <br />
                                Welcome,<br/>
                                {user.firstName}
                            </Header>
                        </Menu.Item>
                        <Menu.Item
                            name='home'
                            onClick={() => setCurrentView('home')}
                            active={currentView === 'home'}
                            color={currentView === 'home' ? 'blue' : 'black'}
                        >
                            Home
                        </Menu.Item>
                        <Menu.Item
                            name='announcements'
                            onClick={() => setCurrentView('announcements')}
                            active={currentView === 'announcements'}
                            color={currentView === 'announcements' ? 'blue' : 'black'}
                        >
                            Announcements
                        </Menu.Item>
                        <Menu.Item
                            name='projects'
                            onClick={() => setCurrentView('projects')}
                            active={currentView === 'projects'}
                            color={currentView === 'projects' ? 'blue' : 'black'}
                        >
                            Your Projects
                        </Menu.Item>
                        <Menu.Item>&nbsp;
                        </Menu.Item>
                        {((user.hasOwnProperty('isSuperAdmin') && user.isSuperAdmin === true) ||
                            (user.hasOwnProperty('isSuperAdmin') && user.isCampusAdmin === true)) &&
                            <Menu.Item
                                as={Link}
                                to='/controlpanel'
                            >
                                Control Panel
                                <Icon name='dashboard' />
                            </Menu.Item>
                        }
                        <Menu.Item
                            href='https://commons.libretexts.org/harvestrequest'
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            Harvesting Request
                            <Icon name='plus' />
                        </Menu.Item>
                        <Menu.Item
                            href='https://commons.libretexts.org/adopt'
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            Adoption Report
                            <Icon name='clipboard check' />
                        </Menu.Item>
                        <Menu.Item
                            disabled
                        >
                            Account Request
                            <Icon name='share alternate' />
                        </Menu.Item>
                        <Menu.Item
                            href='https://libretexts.org'
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            LibreTexts.org
                            <Icon name='external' />
                        </Menu.Item>
                    </Menu>
                </Grid.Column>
                <Grid.Column width={13}>
                    <View />
                </Grid.Column>
            </Grid.Row>
            <Modal
                onClose={closeNAModal}
                open={showNAModal}
                closeOnDimmerClick={false}
            >
                <Modal.Header>New Announcement</Modal.Header>
                <Modal.Content scrolling>
                    <Form noValidate>
                        <Form.Field
                            required
                            error={naTitleError}
                        >
                            <label>Title</label>
                            <Form.Input
                                type='text'
                                placeholder='Enter title...'

                                onChange={(e) => setNATitle(e.target.value)}
                                value={naTitle}
                            />
                        </Form.Field>
                        <Form.Field
                            required
                            error={naMessageError}
                        >
                            <label>Message</label>
                            <ConductorTextArea
                                placeholder='Enter announcement text...'
                                textValue={naMessage}
                                onTextChange={(value) => setNAMessage(value)}
                                inputType='announcement'
                                showSendButton={false}
                            />
                        </Form.Field>
                        {(user.hasOwnProperty('isSuperAdmin') && user.isSuperAdmin === true) &&
                            (
                                <div className='mb-2p'>
                                    <p><strong><em>Super Administrator Options</em></strong> <span className='muted-text'>(use caution)</span></p>
                                    <Form.Field>
                                        <Form.Checkbox
                                            onChange={() => setNAGlobal(!naGlobal)}
                                            checked={naGlobal}
                                            label="Send globally"
                                        />
                                    </Form.Field>
                                </div>
                            )
                        }
                    </Form>
                    <span>
                        <em>This announcement will be available to
                        {naGlobal
                            ? ' all Conductor users (global).'
                            : ` all members of ${org.shortName}.`
                        }
                        </em>
                    </span>
                </Modal.Content>
                <Modal.Actions>
                    <Button
                        onClick={closeNAModal}
                    >
                        Cancel
                    </Button>
                    <Button
                        color='green'
                        onClick={postNewAnnouncement}
                        icon
                        labelPosition='right'
                    >
                        Post Announcement
                        <Icon name='announcement' />
                    </Button>
                </Modal.Actions>
            </Modal>
            {/* Announcement View Modal */}
            <Modal
                onClose={closeAVModal}
                open={showAVModal}
            >
                <Modal.Header>
                    {avAnnouncement.title}
                </Modal.Header>
                <Modal.Content>
                    <Header as='h4'>
                        <Image avatar src={`${avAnnouncement.author?.avatar || '/mini_logo.png'}`} />
                        <Header.Content>
                            {avAnnouncement.author?.firstName} {avAnnouncement.author?.lastName}
                            <Header.Subheader>
                                {avAnnouncement.date} at {avAnnouncement.time}
                            </Header.Subheader>
                        </Header.Content>
                    </Header>
                    <Modal.Description className='announcement-view-text'>
                        {avAnnouncement.message &&
                            <p dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(marked(avAnnouncement.message, { breaks: true }))
                            }}></p>
                        }
                    </Modal.Description>
                    <span className='gray-span'>Sent to: {capitalizeFirstLetter(avAnnouncement.org?.shortName || 'Unknown')}</span>
                </Modal.Content>
                <Modal.Actions>
                    {((avAnnouncement.author?.uuid === user.uuid) || (user.isSuperAdmin)) &&
                        <Button
                            color='red'
                            loading={avModalLoading}
                            onClick={deleteAnnouncement}
                        >
                            <Icon name='trash' />
                            Delete
                        </Button>
                    }
                    <Button
                        color='blue'
                        loading={avModalLoading}
                        onClick={closeAVModal}
                    >
                        Done
                    </Button>
                </Modal.Actions>
            </Modal>
            {/* New Member Modal */}
            <Modal
                open={showNMModal}
                closeOnDimmerClick={false}
            >
                <Modal.Header>
                    Welcome to Conductor
                </Modal.Header>
                <Modal.Content>
                    <p>Welcome to Conductor! You've been added as a new member of <strong>{org.name}</strong>.</p>
                    <p>
                        <em>If you need elevated privileges, please contact the member of your organization responsible for communicating with LibreTexts.</em>
                    </p>
                </Modal.Content>
                <Modal.Actions>
                    <Button
                        onClick={() => setShowNMModal(false)}
                        color='blue'
                    >
                        Done
                    </Button>
                </Modal.Actions>
            </Modal>
        </Grid>
    )
};

export default Dashboard;
