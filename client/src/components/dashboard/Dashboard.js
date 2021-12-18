import './Dashboard.css';

import {
    Grid,
    Header,
    Menu,
    Image,
    Segment,
    Message,
    Icon,
    Button,
    Modal,
    Form,
    Loader,
    Card,
    Popup
} from 'semantic-ui-react';
import {
    CircularProgressbar,
    buildStyles
} from 'react-circular-progressbar';
import { Link } from 'react-router-dom';
import React, { useEffect, useState, useCallback } from 'react';
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
    const [projects, setProjects] = useState([]);

    /* UI */
    const [loadedAllAnnouncements, setLoadedAllAnnouncements] = useState(false);
    const [loadedAllProjects, setLoadedAllProjects] = useState(false);
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

    /**
     * Check for query string values and update UI if necessary.
     */
    useEffect(() => {
        const queryValues = queryString.parse(props.location.search);
        if (queryValues.newmember === 'true') {
            setShowNMModal(true);
        }
    }, [props.location.search, setShowNMModal]);

    /**
     * Loads the 5 most recent announcements via GET
     * request and updates the UI accordingly.
     */
     const getAnnouncements = useCallback(() => {
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
    }, [setAnnouncements, setLoadedAllAnnouncements, handleGlobalError]);

    /**
     * Load the user's active projects via GET
     * request and update the UI accordingly.
     */
    const getProjects = useCallback(() => {
        axios.get('/projects/recent').then((res) => {
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
    }, [setProjects, setLoadedAllProjects, handleGlobalError]);

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
        getProjects();
        getAnnouncements();
    }, [getProjects, getAnnouncements]);

    /**
     * Accepts a standard ISO 8601 date or date-string
     * and parses the date and time to human-readable format.
     * @param {String|Date} dateInput - the date to parse
     * @returns {Object} object with formatted date and time
     */
    const parseDateAndTime = (dateInput) => {
        const dateInstance = new Date(dateInput);
        return {
            date: date.format(dateInstance, 'MM/DD/YY'),
            time: date.format(dateInstance, 'h:mm A')
        }
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

    return (
        <Grid className='component-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column>
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
                        {((user.hasOwnProperty('isSuperAdmin') && user.isSuperAdmin === true) ||
                            (user.hasOwnProperty('isCampusAdmin') && user.isCampusAdmin === true)) &&
                            <Menu.Item
                                as={Link}
                                to='/controlpanel'
                            >
                                Control Panel
                                <Icon name='dashboard' />
                            </Menu.Item>
                        }
                        <Menu.Item
                            as={Link}
                            to='/'
                        >
                            Commons
                            <Icon name='handshake' />
                        </Menu.Item>
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
                            href='https://commons.libretexts.org/accountrequest'
                            target='_blank'
                            rel='noopener noreferrer'
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
                <Grid.Column width={8}>
                    <Segment padded>
                        <div className='dividing-header-custom'>
                            <h3>Your Projects <span className='gray-span'>(recently updated)</span></h3>
                            <div className='right-flex'>
                                    <Popup
                                        content={<span>To see all of your projects, visit <strong>Projects</strong> in the Navbar.</span>}
                                        trigger={
                                            <Icon name='info circle' className='cursor-pointer' />
                                        }
                                        position='top center'
                                    />
                                </div>
                        </div>
                        <Segment
                            basic
                            loading={!loadedAllProjects}
                        >
                            <Card.Group itemsPerRow={2}>
                                {(projects.length > 0) &&
                                    projects.map((item) => {
                                        const itemDate = new Date(item.updatedAt);
                                        item.updatedDate = date.format(itemDate, 'MM/DD/YY');
                                        item.updatedTime = date.format(itemDate, 'h:mm A');
                                        return (
                                            <Card key={item.projectID} raised>
                                                <div className='flex-col-div project-card-content'>
                                                    <Link as='h4' className='project-card-title' to={`/projects/${item.projectID}`}>{truncateString(item.title, 100)}</Link>
                                                    <span className='muted-text project-card-lastupdate'>Last updated {item.updatedDate} at {item.updatedTime}</span>
                                                    <div className='flex-row-div'>
                                                        <div className='project-card-progress-container'>
                                                            <CircularProgressbar
                                                                value={item.currentProgress || 0}
                                                                strokeWidth={5}
                                                                circleRatio={0.75}
                                                                styles={buildStyles({
                                                                    rotation: 1 / 2 + 1 / 8,
                                                                    pathColor: '#127BC4',
                                                                    textColor: '#127BC4',
                                                                    strokeLinecap: 'butt'
                                                                })}
                                                            />
                                                        </div>
                                                        <div className='project-card-progress-container'>
                                                            <CircularProgressbar
                                                                value={item.peerProgress || 0}
                                                                strokeWidth={5}
                                                                circleRatio={0.75}
                                                                styles={buildStyles({
                                                                    rotation: 1 / 2 + 1 / 8,
                                                                    pathColor: '#f2711c',
                                                                    textColor: '#f2711c',
                                                                    strokeLinecap: 'butt'
                                                                })}
                                                            />
                                                        </div>
                                                        <div className='project-card-progress-container'>
                                                            <CircularProgressbar
                                                                value={item.a11yProgress || 0}
                                                                strokeWidth={5}
                                                                circleRatio={0.75}
                                                                styles={buildStyles({
                                                                    rotation: 1 / 2 + 1 / 8,
                                                                    pathColor: '#00b5ad',
                                                                    textColor: '#00b5ad',
                                                                    strokeLinecap: 'butt'
                                                                })}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        );
                                    })
                                }
                                {(projects.length === 0) &&
                                    <p>You don't have any projects right now.</p>
                                }
                            </Card.Group>
                        </Segment>
                    </Segment>
                </Grid.Column>
                <Grid.Column width={5}>
                    <Segment padded>
                        <div className='dividing-header-custom'>
                            <h3>Announcements <span className='gray-span'>(most recent)</span></h3>
                            {(user.isCampusAdmin === true || user.isSuperAdmin === true) &&
                                <div className='right-flex'>
                                    <Popup
                                        content='New Announcement'
                                        trigger={
                                            <Button color='green' onClick={openNAModal} icon circular>
                                                <Icon name='add' />
                                            </Button>
                                        }
                                        position='top center'
                                    />
                                </div>
                            }
                        </div>
                        {showNASuccess &&
                            <Message
                                onDismiss={() => setShowNASuccess(false)}
                                header='Announcement Successfully Posted!'
                                icon='check circle outline'
                                positive
                            />
                        }
                        <div className='announcements-list'>
                            <Loader active={!loadedAllAnnouncements} inline='centered' className='mt-4p' />
                            {announcements.map((item, index) => {
                                return (
                                    <div className='flex-col-div announcement' key={index} onClick={() => openAVModal(index)}>
                                        <div className='flex-row-div'>
                                            <div className='announcement-avatar-container'>
                                                <Image src={item.author.avatar} size='mini' avatar />
                                            </div>
                                            <div className='flex-col-div announcement-meta-container'>
                                                <span className='announcement-meta-title'>{item.title}</span>
                                                <span className='muted-text announcement-meta-date'><em>{item.author.firstName} {item.author.lastName}</em> &bull; {item.date} at {item.time}</span>
                                            </div>
                                        </div>
                                        <p className='announcement-text' dangerouslySetInnerHTML={{
                                            __html: DOMPurify.sanitize(marked(truncateString(item.message, 200)))
                                        }}></p>
                                    </div>
                                );
                            })}
                            {(loadedAllAnnouncements && announcements.length === 0) &&
                                <p className='text-center mt-4p'>No recent announcements.</p>
                            }
                        </div>
                    </Segment>
                </Grid.Column>
            </Grid.Row>
            {/* New Announcement Modal */}
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
