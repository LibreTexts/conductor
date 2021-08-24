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
import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import { truncateString, capitalizeFirstLetter, isEmptyString } from '../util/HelperFunctions.js';

import useGlobalError from '../error/ErrorHooks.js';

const Dashboard = (props) => {

    const dispatch = useDispatch();
    const { handleGlobalError } = useGlobalError();
    const user = useSelector((state) => state.user);
    const org = useSelector((state) => state.org);

    const emptyAnnouncement = {
        title: "",
        message: "",
        org: "",
        author: {
            firstName: "",
            lastName: "",
            avatar: "",
            uuid: ""
        }
    };

    /* Data */
    const [announcements, setAnnouncements] = useState([]);
    const [recentAnnouncement, setRecentAnnouncement] = useState(emptyAnnouncement);
    const [projects, setProjects] = useState([]);
    const [recentProjects, setRecentProjects] = useState([]);

    /* UI */
    const [currentView, setCurrentView] = useState('home');
    const [loadedAllAnnouncements, setLoadedAllAnnouncements] = useState(false);
    const [loadedRecentAnnouncement, setLoadedRecentAnnouncement] = useState(false);
    const [loadedAllProjects, setLoadedAllProjects] = useState(false);
    const [loadedRecentProjects, setLoadedRecentProjects] = useState(false);
    const [hasRecentAnnouncement, setHasRecentAnnouncement] = useState(false);
    const [hasRecentProjects, setHasRecentProjects] = useState(false);
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
    const [avAnnouncement, setAVAnnouncement] = useState(emptyAnnouncement);

    /**
     * Setup page & title on load and
     * load recent data.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Dashboard";
        date.plugin(ordinal);
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
                console.log(res.data.errMsg);
            }
            setLoadedRecentAnnouncement(true);
        }).catch((err) => {
            handleGlobalError(err);
        });
    };

    /**
     * Load the most recent project via GET
     * request and update the UI accordingly.
     */
    const getRecentProjects = () => { // TODO: update to new Projects paradigm
        axios.get('/projects/recent').then((res) => {
            if (!res.data.err) {
            } else {
                console.log(res.data.errMsg);
            }
            setLoadedRecentProjects(true);
        }).catch((err) => {
            handleGlobalError(err);
        });
    };

    /**
     * Load the 50 most recent announcements via GET
     * request and update the UI accordingly.
     */
    const getAnnouncements = () => {
        axios.get('/announcements/all').then((res) => {
            if (!res.data.err) {
                if (res.data.announcements !== null) {
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
                console.log(res.data.err);
            }
            setLoadedAllAnnouncements(true);
        }).catch((err) => {
            handleGlobalError(err);
        });
    };

    /**
     * Load the user's active projects via GET
     * request and update the UI accordingly.
     */
    const getProjects = () => { // TODO: update to new Projects paradigm
        axios.get('/projects/all').then((res) => {
            if (!res.data.err) {
            } else {
                console.log(res.data.errMsg);
            }
            setLoadedAllProjects(true);
        }).catch((err) => {
            handleGlobalError(err);
        });
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
            axios.post('/announcements/create', {
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
            setShowAVModal(true);
            setAVAnnouncement(announcements[idx]);
        }
    };

    /**
     * Close the Announcement View modal
     * and reset state to the empty announcement.
     */
    const closeAVModal = () => {
        setShowAVModal(false);
        setAVAnnouncement(emptyAnnouncement);
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
                                    <Header as='h2' className='announcements-header'>Announcements <span className='gray-span'>(50 most recent)</span></Header>
                                </Grid.Column>
                                <Grid.Column>
                                    {(user.isCampusAdmin || user.isSuperAdmin) &&
                                        <Button color='green' floated='right' onClick={() => { setShowNAModal(true) }}>
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
                                onDismiss={() => { setShowNASuccess(false) }}
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
                                    <Feed.Event key={index} onClick={() => { openAVModal(index)}} className='announcement'>
                                        <Feed.Label image={`${item.author.avatar}`} />
                                        <Feed.Content className='announcement-content'>
                                            <Feed.Summary>
                                                {item.title}
                                                <Feed.Date className='announcement-details'>by {item.author.firstName} {item.author.lastName} on {item.date} at {item.time} </Feed.Date>
                                            </Feed.Summary>
                                            <p className='announcement-text'>{truncateString(item.message, 280)}</p>
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
                                relaxed
                                divided
                            >
                            {projects.map((item, index) => {
                                const itemDate = new Date(item.lastUpdate.createdAt);
                                item.updatedDate = date.format(itemDate, 'MMM DDD, YYYY');
                                item.updatedTime = date.format(itemDate, 'h:mm A');
                                return (
                                    <List.Item key={index} className='dashboard-list-item'>
                                        <List.Icon name='book' size='large' verticalAlign='middle' />
                                        <List.Content>
                                            <List.Header className='recent-announcement-title' as={Link} to={`/harvesting/projects/${item.projectID}`}>{item.title}</List.Header>
                                            <List.Description>
                                                <span className='author-info-span gray-span'>Last updated on {item.updatedDate} at {item.updatedTime}</span>
                                            </List.Description>
                                        </List.Content>
                                    </List.Item>
                                );
                            })}
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
                            <Header size='medium' onClick={() => { setCurrentView('announcements')}} className='pointer-hover'>Announcements <span className='gray-span'>(most recent)</span></Header>
                            {!loadedRecentAnnouncement &&
                                <p><em>Loading...</em></p>
                            }
                            {(loadedRecentAnnouncement && hasRecentAnnouncement) &&
                                <Message icon>
                                    <Icon name='announcement' />
                                    <Message.Content>
                                        <Message.Header className="recent-announcement-title">{recentAnnouncement.title}</Message.Header>
                                        {recentAnnouncement.message}<br />
                                        <span className='author-info-span gray-span'>by {recentAnnouncement.author.firstName} {recentAnnouncement.author.lastName} on {recentAnnouncement.date} at {recentAnnouncement.time}</span>
                                    </Message.Content>
                                </Message>
                            }
                            {(loadedRecentAnnouncement && !hasRecentAnnouncement) &&
                                <p>There are no recent announcements right now.</p>
                            }
                        </Segment>
                        <Divider />
                        <Segment basic>
                            <Header size='medium' onClick={() => { setCurrentView('projects') }} className='pointer-hover'>Your Projects <span className='gray-span'>(overview)</span></Header>
                            <List divided size='large'>
                                {!loadedRecentProjects &&
                                    <p><em>Loading...</em></p>
                                }
                                {(loadedRecentProjects && hasRecentProjects) &&
                                    projects.map((item, index) => {
                                        const itemDate = new Date(item.lastUpdate.createdAt);
                                        item.updatedDate = date.format(itemDate, 'MMM DDD, YYYY');
                                        item.updatedTime = date.format(itemDate, 'h:mm A');
                                        return (
                                            <List.Item>
                                              <List.Icon name='book' size='large' verticalAlign='middle' />
                                              <List.Content>
                                                <List.Header as={Link} to={`/projects/${item.projectID}`}>{item.title}</List.Header>
                                                <List.Description as='a'>Last updated on {item.updatedDate} at {item.updatedTime}</List.Description>
                                              </List.Content>
                                            </List.Item>
                                        );
                                    })
                                }
                                {(loadedRecentProjects && !hasRecentProjects) &&
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
                        onClick={() => { setCurrentView('home') }}
                        active={currentView === 'home'}
                        color={currentView === 'home' ? 'blue' : 'black'}
                      >
                        Home
                      </Menu.Item>
                      <Menu.Item
                        name='announcements'
                        onClick={() => { setCurrentView('announcements') }}
                        active={currentView === 'announcements'}
                        color={currentView === 'announcements' ? 'blue' : 'black'}
                      >
                        Announcements
                      </Menu.Item>
                      <Menu.Item
                        name='projects'
                        onClick={() => { setCurrentView('projects') }}
                        active={currentView === 'projects'}
                        color={currentView === 'projects' ? 'blue' : 'black'}
                        >
                            Your Projects
                        </Menu.Item>
                        <Menu.Item>&nbsp;
                        </Menu.Item>
                      <Menu.Item href='https://libretexts.org' target='_blank' rel='noopener noreferrer'>
                        LibreTexts.org
                        <Icon name='external' />
                      </Menu.Item>
                    </Menu>
                </Grid.Column>
                <Grid.Column width={9}>
                    <View />
                </Grid.Column>
                <Grid.Column width={4}>
                    <Segment>
                        <Header as='h3'>Libraries</Header>
                        <Divider />
                        <Menu vertical fluid secondary size='tiny'>
                          <Menu.Item href='https://bio.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                            <span><Icon name='dna' /></span>
                            Biology
                            <Icon name='external' />
                          </Menu.Item>
                          <Menu.Item href='https://biz.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                            <span><Icon name='dollar' /></span>
                            Business
                            <Icon name='external' />
                          </Menu.Item>
                          <Menu.Item href='https://chem.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                            <span><Icon name='flask' /></span>
                            Chemistry
                            <Icon name='external' />
                          </Menu.Item>
                          <Menu.Item href='https://eng.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                            <span><Icon name='wrench' /></span>
                            Engineering
                            <Icon name='external' />
                          </Menu.Item>
                          <Menu.Item href='https://espanol.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                            <span><Icon name='language' /></span>
                            Español
                            <Icon name='external' />
                          </Menu.Item>
                          <Menu.Item href='https://geo.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                            <span><Icon name='globe' /></span>
                            Geosciences
                            <Icon name='external' />
                          </Menu.Item>
                          <Menu.Item href='https://human.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                            <span><Icon name='address book' /></span>
                            Humanities
                            <Icon name='external' />
                          </Menu.Item>
                          <Menu.Item href='https://math.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                            <span><Icon name='subscript' /></span>
                            Mathematics
                            <Icon name='external' />
                          </Menu.Item>
                          <Menu.Item href='https://med.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                            <span><Icon name='first aid' /></span>
                            Medicine
                            <Icon name='external' />
                          </Menu.Item>
                          <Menu.Item href='https://phys.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                            <span><Icon name='rocket' /></span>
                            Physics
                            <Icon name='external' />
                          </Menu.Item>
                          <Menu.Item href='https://socialsci.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                            <span><Icon name='users' /></span>
                            Social Science
                            <Icon name='external' />
                          </Menu.Item>
                          <Menu.Item href='https://stats.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                            <span><Icon name='chart pie' /></span>
                            Statistics
                            <Icon name='external' />
                          </Menu.Item>
                          <Menu.Item href='https://workforce.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                            <span><Icon name='briefcase' /></span>
                            Workforce
                            <Icon name='external' />
                          </Menu.Item>
                        </Menu>
                    </Segment>
                </Grid.Column>
            </Grid.Row>
            <Modal
                onClose={closeNAModal}
                open={showNAModal}
                closeOnDimmerClick={false}
            >
                <Modal.Header>New Announcement</Modal.Header>
                <Modal.Content>
                    <Form noValidate>
                        <Form.Field
                            required
                            error={naTitleError}
                        >
                            <label>Title</label>
                            <Form.Input
                                type='text'
                                placeholder='Enter title...'

                                onChange={(e) => { setNATitle(e.target.value) }}
                                value={naTitle}
                            />
                        </Form.Field>
                        <Form.Field
                            required
                            error={naMessageError}
                        >
                            <label>Message</label>
                            <Form.TextArea
                                placeholder='Enter message...'
                                onChange={(e) => { setNAMessage(e.target.value) }}
                                value={naMessage}
                            />
                        </Form.Field>
                        {user.isSuperAdmin &&
                            (
                                <div className='mb-2p'>
                                    <p><strong><em>Super Administrator Options</em></strong> <span className='muted-text'>(use caution)</span></p>
                                    <Form.Field>
                                        <Form.Checkbox
                                            onChange={() => { setNAGlobal(!naGlobal) }}
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
                    <Button onClick={closeNAModal}>Cancel</Button>
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
            <Modal
                onClose={closeAVModal}
                open={showAVModal}
            >
                <Modal.Header>
                    {avAnnouncement.title}
                </Modal.Header>
                <Modal.Content>
                    <Header as='h4'>
                        <Image avatar src={`${avAnnouncement.author.avatar}`} />
                        <Header.Content>
                            {avAnnouncement.author.firstName} {avAnnouncement.author.lastName}
                            <Header.Subheader>
                                {avAnnouncement.date} at {avAnnouncement.time}
                            </Header.Subheader>
                        </Header.Content>
                    </Header>
                    <Modal.Description className='announcement-view-text'>{avAnnouncement.message}</Modal.Description>
                    <span className='gray-span'>Sent to: {capitalizeFirstLetter(avAnnouncement.org)}</span>
                </Modal.Content>
                <Modal.Actions>
                    <Button onClick={closeAVModal} color='blue'>Done</Button>
                </Modal.Actions>
            </Modal>
        </Grid>
    )
};

export default Dashboard;
