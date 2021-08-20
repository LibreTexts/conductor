import './Dashboard.css';

import { Grid, Header, Menu, List, Image, Segment, Divider, Message, Icon, Button, Modal, Form, Feed } from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import React, { Component } from 'react';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import { truncateString, capitalizeFirstLetter } from '../util/HelperFunctions.js';

import { UserContext } from '../../providers.js';

class Dashboard extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
            firstName: '',
            avatar: '/steve.jpg',
            roles: [],
            recentAnnouncement: false,
            announcementData: {
                title: '',
                message: '',
                author: {
                    firstName: '',
                    lastName: ''
                },
                date: '',
                time: ''
            },
            loadedRecentProjects: false,
            recentHarvestingProject: {},
            hasRecentHarvest: false,
            userHarvestingProjects: [],
            currentView: 'home',
            fetchedAllAnnouncements: false,
            allAnnouncements: [],
            showNewAnnouncementModal: false,
            newAnnouncementTitle: '',
            newAnnouncementMessage: '',
            newAnnouncementHarvesters: false,
            newAnnouncementDevelopers: false,
            newAnnouncementAdministrators: false,
            announcementViewTitle: '',
            announcementViewMessage: '',
            announcementViewOrg: '',
            announcementViewDate: '',
            announcementViewTime: '',
            announcementViewAuthorFirst: '',
            announcementViewAuthorLast: '',
            announcementViewAuthorAvatar: ''
        };
    }

    componentDidMount() {
        document.title = "LibreTexts Conductor | Dashboard";
        const [user] = this.context;
        date.plugin(ordinal);
        if (user.firstName !== this.state.firstName) {
            this.setState({ firstName: user.firstName });
        }
        if (user.avatar !== this.state.avatar) {
            this.setState({ avatar: user.avatar });
        }
        if (this.state.roles.length === 0 && user.roles.length !== 0) {
            this.setState({ roles: user.roles });
        }
        this.getRecentAnnouncement();
        this.getRecentProjects();
    }

    componentDidUpdate() {
        const [user] = this.context;
        if (user.firstName !== this.state.firstName) {
            this.setState({ firstName: user.firstName });
        }
        if (user.avatar !== this.state.avatar) {
            this.setState({ avatar: user.avatar });
        }
        if (this.state.roles.length === 0 && user.roles.length !== 0) {
            this.setState({ roles: user.roles });
        }
    }

    getAllAnnouncements() {
        axios.get('/announcements/all').then((res) => {
            if (!res.data.err) {
                if (res.data.announcements !== null) {
                    var announcementsForState = [];
                    res.data.announcements.forEach((announcement) => {
                        const { date, time } = this.parseDateAndTime(announcement.createdAt);
                        const newAnnouncement = {
                            title: announcement.title,
                            message: announcement.message,
                            author: {
                                firstName: announcement.author.firstName,
                                lastName: announcement.author.lastName,
                                avatar: announcement.author.avatar
                            },
                            date: date,
                            time: time,
                            org: announcement.org,
                            rawDate: announcement.createdAt
                        };
                        announcementsForState.push(newAnnouncement);
                    });
                    announcementsForState.sort((a, b) => {
                        const date1 = new Date(a.rawDate);
                        const date2 = new Date(b.rawDate);
                        return date2 - date1;
                    });
                    this.setState({
                        fetchedAllAnnouncements: true,
                        allAnnouncements: announcementsForState
                    });
                } else {
                    this.setState({ fetchedAllAnnouncements: true });
                }
            } else {
                console.log(res.data.err);
            }
        }).catch((err) => {
            console.log(err);
        });
    }

    getRecentAnnouncement() {
        axios.get('/announcements/recent').then((res) => {
            if (!res.data.err) {
                if (res.data.announcement !== null) {
                    const { date, time } = this.parseDateAndTime(res.data.announcement.createdAt);
                    this.setState({
                        recentAnnouncement: true,
                        announcementData: {
                            title: res.data.announcement.title,
                            message: res.data.announcement.message,
                            author: {
                                firstName: res.data.announcement.author.firstName,
                                lastName: res.data.announcement.author.lastName,
                                avatar: res.data.announcement.author.avatar
                            },
                            date: date,
                            time: time
                        }
                    });
                }
            } else {
                console.log(res.data.errMsg);
            }
        }).catch((err) => {
            console.log(err);
        });
    }

    getAllProjects() {
        axios.get('/projects/all').then((res) => {
            if (!res.data.err) {
                this.setState({
                    userHarvestingProjects: res.data.harvesting,
                    userDevelopmentProjects: res.data.development,
                    userAdminProjects: res.data.admin
                });
            } else {
                console.log(res.data.errMsg);
            }
        }).catch((err) => {
            console.log(err);
        });
    }

    getRecentProjects() {
        axios.get('/projects/recent').then((res) => {
            if (!res.data.err) {
                var toSet = {
                    loadedRecentProjects: true
                };
                if (res.data.harvesting !== undefined) {
                    const itemDate = new Date(res.data.harvesting.lastUpdate.createdAt);
                    res.data.harvesting.updatedDate = date.format(itemDate, 'MMM DDD, YYYY');
                    res.data.harvesting.updatedTime = date.format(itemDate, 'h:mm A');
                    toSet.recentHarvestingProject = res.data.harvesting;
                    toSet.hasRecentHarvest = true;
                }
                this.setState(toSet);
            } else {
                console.log(res.data.errMsg);
            }
        }).catch((err) => {
            console.log(err);
        });
    }

    parseDateAndTime(dateInput) {
        const dateInstance = new Date(dateInput);
        return {
            date: date.format(dateInstance, 'ddd, MMM DDD, YYYY'),
            time: date.format(dateInstance, 'h:mm A')
        }
    }

    setView(e, data) {
        switch(data.name) {
            case 'announcements':
            this.getAllAnnouncements();
                break;
            case 'projects':
                this.getAllProjects();
                break
            default:
                break // silence React warning
        }
        this.setState({ currentView: data.name });
    }

    setNATitle(e) {
        this.setState({ newAnnouncementTitle: e.target.value });
    }

    setNAMessage(e) {
        this.setState({ newAnnouncementMessage: e.target.value });
    }

    setNAHarvesters() {
        this.setState((prevState) => ({
            newAnnouncementHarvesters: !prevState.newAnnouncementHarvesters
        }));
    }

    setNADevelopers() {
        this.setState((prevState) => ({
            newAnnouncementDevelopers: !prevState.newAnnouncementDevelopers
        }));
    }

    setNAAdministrators() {
        this.setState((prevState) => ({
            newAnnouncementAdministrators: !prevState.newAnnouncementAdministrators
        }));
    }

    openNewAnnouncementModal() {
        this.setState({ showNewAnnouncementModal: true });
    }

    closeNewAnnouncementModal() {
        this.setState({
            newAnnouncementTitle: '',
            newAnnouncementMessage: '',
            showNewAnnouncementModal: false,
            newAnnouncementHarvesters: false,
            newAnnouncementDevelopers: false,
            newAnnouncementAdministrators: false
        });
    }

    openAnnouncementViewModal(index) {
        const announcement = this.state.allAnnouncements[index];
        this.setState({
            showAnnouncementViewModal: true,
            announcementViewTitle: announcement.title,
            announcementViewMessage: announcement.message,
            announcementViewOrg: announcement.org,
            announcementViewDate: announcement.date,
            announcementViewTime: announcement.time,
            announcementViewAuthorFirst: announcement.author.firstName,
            announcementViewAuthorLast: announcement.author.lastName,
            announcementViewAuthorAvatar: announcement.author.avatar
        });
    }

    closeAnnouncementViewModal() {
        this.setState({
            showAnnouncementViewModal: false,
            announcementViewTitle: '',
            announcementViewMessage: '',
            announcementViewOrg: '',
            announcementViewDate: '',
            announcementViewTime: '',
            announcementViewAuthorFirst: '',
            announcementViewAuthorLast: '',
            announcementViewAuthorAvatar: ''
        });
    }

    postNewAnnouncement() {
        if (this.state.newAnnouncementTitle !== '') {
            if (this.state.newAnnouncementMessage !== '') {
                var recipientGroups = [];
                var groupCount = 0;
                if (this.state.newAnnouncementHarvesters && this.state.newAnnouncementDevelopers && this.state.newAnnouncementAdministrators) {
                    recipientGroups.push('all');
                    groupCount++;
                } else {
                    if (this.state.newAnnouncementHarvesters) {
                        recipientGroups.push('harvest');
                        groupCount++;
                    }
                    if (this.state.newAnnouncementDevelopers) {
                        recipientGroups.push('develop');
                        groupCount++;
                    }
                    if (this.state.newAnnouncementAdministrators) {
                        recipientGroups.push('admin');
                        groupCount++;
                    }
                }
                if (groupCount !== 0) {
                    var newAnnouncement = {
                        title: this.state.newAnnouncementTitle,
                        message: this.state.newAnnouncementMessage,
                        recipientGroups: recipientGroups
                    };
                    axios.post('/announcements/create', newAnnouncement, {
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }).then((res) => {
                        if (!res.data.err) {
                            this.setState({
                                newAnnouncementTitle: '',
                                newAnnouncementMessage: '',
                                showNewAnnouncementModal: false,
                                newAnnouncementHarvesters: false,
                                newAnnouncementDevelopers: false,
                                newAnnouncementAdministrators: false,
                                recentAnnouncement: false,
                                announcementData: {
                                    title: '',
                                    message: '',
                                    author: {
                                        firstName: '',
                                        lastName: ''
                                    },
                                    date: '',
                                    time: ''
                                },
                                fetchedAllAnnouncements: false,
                                allAnnouncements: []
                            }, () => {
                                this.getRecentAnnouncement();
                                this.getAllAnnouncements();
                            });
                        } else {
                            throw(res.data.errMsg);
                        }
                    }).catch((err) => {
                        alert(`Oops! We encountered an error: ${err}`);
                    });
                } else {
                    alert("Please select at least one recipient group.");
                }
            } else {
                alert("Please enter a message for the announcement.");
            }
        } else {
            alert("Please enter a title for the announcement.");
        }
    }

    render() {
        const View = (props) => {
            switch (this.state.currentView) {
                case 'announcements':
                    return (
                        <Segment>
                            <Grid verticalAlign='middle'>
                                <Grid.Row columns={2}>
                                    <Grid.Column>
                                        <Header as='h2' className='announcements-header'>Announcements <span className='gray-span'>(50 most recent)</span></Header>
                                    </Grid.Column>
                                    <Grid.Column>
                                        {this.state.roles.includes('admin') &&
                                            <Button color='green' floated='right' onClick={this.openNewAnnouncementModal.bind(this)}>
                                                <Icon name='add' />
                                                New
                                            </Button>
                                        }
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>

                            <Divider />
                            <Feed className='announcement-feed'>
                            {this.state.allAnnouncements.map((item, index) => {
                                return (
                                    <Feed.Event key={index} onClick={() => { this.openAnnouncementViewModal(index)}} className='announcement'>
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
                            {this.state.allAnnouncements.length === 0 &&
                                <p>No recent announcements.</p>
                            }
                        </Segment>
                    );
                case 'projects':
                    return (
                        <Segment>
                            <Header as='h2'>Your Projects</Header>
                            <Divider />
                            <List
                                relaxed
                                divided
                            >
                            {this.state.userHarvestingProjects.map((item, index) => {
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
                            {(this.state.userHarvestingProjects.length === 0) &&
                                <p>You don't have any projects right now.</p>
                            }
                            </List>
                        </Segment>
                    );
                default: // Home
                    return (
                        <Segment>
                            <Header as='h2'>Home</Header>
                            <Divider />
                            <Segment basic>
                                <Header size='medium' onClick={(e) => {this.setView(e, { name: 'announcements' })}} className='dashboard-header-link'>Announcements <span className='gray-span'>(most recent)</span></Header>
                                {this.state.recentAnnouncement ?
                                    <Message icon>
                                        <Icon name='announcement' />
                                        <Message.Content>
                                            <Message.Header className="recent-announcement-title">{this.state.announcementData.title}</Message.Header>
                                            {this.state.announcementData.message}<br />
                                            <span className='author-info-span gray-span'>by {this.state.announcementData.author.firstName} {this.state.announcementData.author.lastName} on {this.state.announcementData.date} at {this.state.announcementData.time}</span>
                                        </Message.Content>
                                    </Message>
                                : <p>No recent announcements.</p>
                                }
                            </Segment>
                            <Divider />
                            <Segment basic>
                                <Header size='medium' onClick={(e) => {this.setView(e, { name: 'projects' })}} className='dashboard-header-link'>Your Projects <span className='gray-span'>(overview)</span></Header>
                                <List divided size='large'>
                                    {!this.state.loadedRecentProjects &&
                                        <p>Loading...</p>
                                    }
                                    {this.state.recentHarvestingProject.title !== undefined &&
                                        <List.Item>
                                          <List.Icon name='book' size='large' verticalAlign='middle' />
                                          <List.Content>
                                            <List.Header as={Link} to={`/harvesting/projects/${this.state.recentHarvestingProject.projectID}`}>{this.state.recentHarvestingProject.title}</List.Header>
                                            <List.Description as='a'>Last updated on {this.state.recentHarvestingProject.updatedDate} at {this.state.recentHarvestingProject.updatedTime}</List.Description>
                                          </List.Content>
                                        </List.Item>
                                    }
                                    {!this.state.hasRecentHarvest &&
                                        <p>You have no recent projects right now.</p>
                                    }
                                </List>
                            </Segment>
                        </Segment>
                    );
            }
        };
        return(
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
                                    <Image circular src={`${this.state.avatar}`} className='menu-avatar' />
                                    <br />
                                    Welcome,<br/>
                                    {this.state.firstName}
                                </Header>
                            </Menu.Item>
                          <Menu.Item
                            name='home'
                            onClick={this.setView.bind(this)}
                            active={this.state.currentView === 'home'}
                            color={this.state.currentView === 'home' ? 'blue' : 'black'}
                          >
                            Home
                          </Menu.Item>
                          <Menu.Item
                            name='announcements'
                            onClick={this.setView.bind(this)}
                            active={this.state.currentView === 'announcements'}
                            color={this.state.currentView === 'announcements' ? 'blue' : 'black'}
                          >
                            Announcements
                          </Menu.Item>
                          <Menu.Item
                            name='projects'
                            onClick={this.setView.bind(this)}
                            active={this.state.currentView === 'projects'}
                            color={this.state.currentView === 'projects' ? 'blue' : 'black'}
                            >
                                Your Projects
                            </Menu.Item>
                            <Menu.Item>&nbsp;
                            </Menu.Item>
                          <Menu.Item href='https://libretexts.org' target='_blank'>
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
                              <Menu.Item href='https://bio.libretexts.org/' target='_blank'>
                                <span><Icon name='dna' /></span>
                                Biology
                                <Icon name='external' />
                              </Menu.Item>
                              <Menu.Item href='https://biz.libretexts.org/' target='_blank'>
                                <span><Icon name='dollar' /></span>
                                Business
                                <Icon name='external' />
                              </Menu.Item>
                              <Menu.Item href='https://chem.libretexts.org/' target='_blank'>
                                <span><Icon name='flask' /></span>
                                Chemistry
                                <Icon name='external' />
                              </Menu.Item>
                              <Menu.Item href='https://eng.libretexts.org/' target='_blank'>
                                <span><Icon name='wrench' /></span>
                                Engineering
                                <Icon name='external' />
                              </Menu.Item>
                              <Menu.Item href='https://espanol.libretexts.org/' target='_blank'>
                                <span><Icon name='language' /></span>
                                Español
                                <Icon name='external' />
                              </Menu.Item>
                              <Menu.Item href='https://geo.libretexts.org/' target='_blank'>
                                <span><Icon name='globe' /></span>
                                Geosciences
                                <Icon name='external' />
                              </Menu.Item>
                              <Menu.Item href='https://human.libretexts.org/' target='_blank'>
                                <span><Icon name='address book' /></span>
                                Humanities
                                <Icon name='external' />
                              </Menu.Item>
                              <Menu.Item href='https://math.libretexts.org/' target='_blank'>
                                <span><Icon name='subscript' /></span>
                                Mathematics
                                <Icon name='external' />
                              </Menu.Item>
                              <Menu.Item href='https://med.libretexts.org/' target='_blank'>
                                <span><Icon name='first aid' /></span>
                                Medicine
                                <Icon name='external' />
                              </Menu.Item>
                              <Menu.Item href='https://phys.libretexts.org/' target='_blank'>
                                <span><Icon name='rocket' /></span>
                                Physics
                                <Icon name='external' />
                              </Menu.Item>
                              <Menu.Item href='https://socialsci.libretexts.org/' target='_blank'>
                                <span><Icon name='users' /></span>
                                Social Science
                                <Icon name='external' />
                              </Menu.Item>
                              <Menu.Item href='https://stats.libretexts.org/' target='_blank'>
                                <span><Icon name='chart pie' /></span>
                                Statistics
                                <Icon name='external' />
                              </Menu.Item>
                              <Menu.Item href='https://workforce.libretexts.org/' target='_blank'>
                                <span><Icon name='briefcase' /></span>
                                Workforce
                                <Icon name='external' />
                              </Menu.Item>
                            </Menu>
                        </Segment>
                    </Grid.Column>
                </Grid.Row>
                <Modal
                    onClose={this.closeNewAnnouncementModal.bind(this)}
                    open={this.state.showNewAnnouncementModal}
                >
                    <Modal.Header>New Announcement</Modal.Header>
                    <Modal.Content>
                        <Form>
                            <Form.Input label='Title' type='text' placeholder='Enter title...' required onChange={this.setNATitle.bind(this)} value={this.state.newAnnouncementTitle} />
                            <Form.TextArea label='Message' placeholder='Enter message...' required onChange={this.setNAMessage.bind(this)} value={this.state.newAnnouncementMessage} />
                            <Form.Group inline>
                                <label>Recipient Group</label>
                                <Form.Checkbox label='Harvesters' checked={this.state.newAnnouncementHarvesters} onChange={this.setNAHarvesters.bind(this)} />
                                <Form.Checkbox label='Developers' checked={this.state.newAnnouncementDevelopers} onChange={this.setNADevelopers.bind(this)} />
                                <Form.Checkbox label='Administrators' checked={this.state.newAnnouncementAdministrators} onChange={this.setNAAdministrators.bind(this)} />
                            </Form.Group>
                            <span className='gray-span'>At least one group is required.</span>
                        </Form>
                    </Modal.Content>
                    <Modal.Actions>
                        <Button onClick={this.closeNewAnnouncementModal.bind(this)}>Cancel</Button>
                        <Button color='green' onClick={this.postNewAnnouncement.bind(this)}>
                            <Icon name='announcement' />
                            Post Announcement
                        </Button>
                    </Modal.Actions>
                </Modal>
                <Modal
                    onClose={this.closeAnnouncementViewModal.bind(this)}
                    open={this.state.showAnnouncementViewModal}
                >
                    <Modal.Header>
                        {this.state.announcementViewTitle}
                    </Modal.Header>
                    <Modal.Content>
                        <Header as='h4'>
                            <Image avatar src={`${this.state.announcementViewAuthorAvatar}`} />
                            <Header.Content>
                                {this.state.announcementViewAuthorFirst} {this.state.announcementViewAuthorLast}
                                <Header.Subheader>
                                    {this.state.announcementViewDate} at {this.state.announcementViewTime}
                                </Header.Subheader>
                            </Header.Content>
                        </Header>
                        <Modal.Description className='announcement-view-text'>{this.state.announcementViewMessage}</Modal.Description>
                        <span className='gray-span'>Sent to: {capitalizeFirstLetter(this.state.announcementViewOrg)}</span>
                    </Modal.Content>
                    <Modal.Actions>
                        <Button onClick={this.closeAnnouncementViewModal.bind(this)} color='blue'>Done</Button>
                    </Modal.Actions>
                </Modal>
            </Grid>
        );
    }
}

export default Dashboard;
