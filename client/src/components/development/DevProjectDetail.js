import './DevelopmentPortal.css';

import {
  Grid,
  Header,
  Segment,
  Divider,
  Message,
  Icon,
  Button,
  Container,
  Modal,
  Dropdown,
  Card,
  Image,
  Form
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import React, { Component } from 'react';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import queryString from 'query-string';

import { UserContext } from '../../providers.js';

class DevProjectDetail extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
            id: '',
            title: '',
            status: '',
            currentProgress: 0,
            description: '',
            resourceURL: '',
            updates: [],
            assignees: '',
            showFlagModal: false,
            showUnflagModal: false,
            loadingAdmins: false,
            adminOptions: [],
            flaggedAdmin: '',
            showCreateSuccess: false,
            showCreateFASuccess: false,
            showUpdateSuccess: false,
            showCompletedSuccess: false,
            showDeleteModal: false,
            showUpdateModal: false,
            showDeleteProgressModal: false,
            showEditProgressModal: false,
            showMarkCompletedModal: false,
            updateDate: '',
            updateProgress: 0,
            updateHours: 0,
            updateAccomplishments: '',
            updateIssues: '',
            updateObjectives: '',
            updateNotes: '',
            deleteProgressID: '',
            deleteProgressTitle: ''
        };
    }

    componentDidMount() {
        document.title = "LibreTexts PTS | Development | Projects | Detail";
        //const [user] = this.context;
        const queryValues = queryString.parse(this.props.location.search);
        const createSuccess = decodeURIComponent(queryValues.showCreateSuccess);
        const createFASuccess = decodeURIComponent(queryValues.showCreateFASuccess);
        const updateSuccess = decodeURIComponent(queryValues.showUpdateSuccess);
        var setCreateSuccess = false;
        var setCreateFASuccess = false;
        var setUpdateSuccess = false;
        if (createSuccess === "true") {
            setCreateSuccess = true;
        }
        if (createFASuccess === "true") {
            setCreateFASuccess = true;
        }
        if (updateSuccess === "true") {
            setUpdateSuccess = true;
        }
        date.plugin(ordinal);
        this.setState({
            id: this.props.match.params.id,
            showCreateSuccess: setCreateSuccess,
            showCreateFASuccess: setCreateFASuccess,
            showUpdateSuccess: setUpdateSuccess
        }, () => {
            this.getProjectDetail();
        });
    }

    getProjectDetail() {
        if (this.state.id !== '') {
            axios.get('/development/projects/detail', {
                params: {
                    id: this.state.id
                }
            }).then((res) => {
                if (!res.data.err) {
                    if (res.data.project !== null) {
                        var assigneesArray = [];
                        res.data.project.assignees.forEach((item) => {
                            assigneesArray.push(item.firstName + " " + item.lastName);
                        });
                        this.setState({
                            id: res.data.project.projectID,
                            title: res.data.project.title,
                            status: res.data.project.status,
                            currentProgress: res.data.project.currentProgress,
                            description: res.data.project.description,
                            assignees: assigneesArray.join(', '),
                            resourceURL: res.data.project.resourceURL
                        }, () => {
                            this.getProgressUpdates();
                        });
                    }
                } else {
                    alert(`Oops! We encountered an error: ${res.data.errMsg}`);
                    console.log(res.data.errMsg);
                }
            }).catch((err) => {
                alert("Oops! We encountered an error.");
                console.log(err);
            });
        }
    }

    openFlagModal() {
        this.setState({
            showFlagModal: true,
            loadingAdmins: true
        }, () => {
            this.getFlaggableAdmins();
        })
    }

    closeFlagModal() {
        this.setState({
            showFlagModal: false,
            adminOptions: [],
            flaggedAdmin: ''
        });
    }

    openUnflagModal() {
        this.setState({ showUnflagModal: true });
    }

    closeUnflagModal() {
        this.setState({ showUnflagModal: false });
    }

    openDeleteModal() {
        this.setState({ showDeleteModal: true });
    }

    closeDeleteModal() {
        this.setState({ showDeleteModal: false });
    }

    openAssigneeModal() {
        this.setState({
            showAssigneeModal: true,
            loadingAssignees: true
        }, () => {
            this.getAssignees();
        });
    }

    closeAssigneeModal() {
        this.setState({
            showAssigneeModal: false,
            assigneeToAdd: ''
        });
    }

    openUpdateModal() {
        const now = new Date();
        this.setState({
            updateDate: date.format(now, 'MMMM DDD, YYYY'),
            showUpdateModal: true
        });
    }

    closeUpdateModal() {
        this.setState({
            showUpdateModal: false,
            updateDate: '',
            updateProgress: 0,
            updateHours: 0,
            updateAccomplishments: '',
            updateIssues: '',
            updateObjectives: '',
            updateNotes: '',
        });
    }

    openDeleteProgressModal(id) {
        const foundUpdate = this.state.updates.find((item) => {
            return item.updateID === id;
        });
        if (foundUpdate !== null) {
            const createdAt = String(foundUpdate.createdAt);
            const itemDate = new Date(createdAt);
            const formatDate = date.format(itemDate, 'MMMM DDD, YYYY');
            this.setState({
                showDeleteProgressModal: true,
                deleteProgressID: id,
                deleteProgressTitle: formatDate
            });
        }
    }

    closeDeleteProgressModal() {
        this.setState({
            showDeleteProgressModal: false,
            deleteProgressID: '',
            deleteProgressTitle: ''
        });
    }

    openMarkCompletedModal() {
        this.setState({
            showMarkCompletedModal: true
        });
    }

    closeMarkCompletedModal() {
        this.setState({
            showMarkCompletedModal: false
        });
    }

    /*
    openEditProgressModal(id) {
        this.setState({
            showEditProgressModal: true,
            editProgressID: id
        });
    }

    closeEditProgressModal() {
        this.setState({
            showEditProgressModal: false,
            editProgressID: '',
            editUpdateChapter: 0,
            editUpdateMessage: ''
        });
    }
    */

    editProject() {
        this.props.history.push(`/development/projects/${this.state.id}/edit`);
    }

    deleteProject() {
        const toDelete = {
            id: this.state.id
        };
        axios.post('/development/projects/delete', toDelete, {
            headers: {
                'Content-Type': 'application/json'
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.deletedProject) {
                    this.props.history.push('/development?showProjectDeleteSuccess=true');
                } else {
                    alert("Oops! We're having trouble deleting that target.");
                }
            } else {
                alert(`Oops! We encountered an error: ${res.data.errMsg}`);
                console.log(res.data.errMsg);
            }
        }).catch((err) => {
            alert("Oops! We encountered an error.");
            console.log(err);
        });
    }

    setUpdateProgress(e) {
        this.setState({ updateProgress: e.target.value });
    }

    setUpdateHours(e) {
        this.setState({ updateHours: e.target.value });
    }

    setUpdateAccommplishments(e) {
        this.setState({ updateAccomplishments: e.target.value });
    }

    setUpdateIssues(e) {
        this.setState({ updateIssues: e.target.value });
    }

    setUpdateObjectives(e) {
        this.setState({ updateObjectives: e.target.value });
    }

    setUpdateNotes(e) {
        this.setState({ updateNotes: e.target.value });
    }

    /*
    setEditUpdateChapter(e) {
        this.setState({ editUpdateChapter: e.target.value });
    }

    setEditUpdateMessage(e) {
        this.setState({ editUpdateMessage: e.target.value });
    }
    */


    getFlaggableAdmins() {
        const [user] = this.context;
        axios.get('/user/getadmins').then((res) => {
            if (!res.data.err) {
                if (res.data.admins !== undefined) {
                    var adminsList = [{
                        key: 'empty',
                        text: 'Clear...',
                        value: ''
                    }];
                    res.data.admins.forEach((item, index) => {
                        if (item.lastName !== user.lastName) {
                            adminsList.push({
                                key: index,
                                text: `${item.firstName} ${item.lastName}`,
                                value: item.uuid,
                                image: {
                                    avatar: true,
                                    src: item.avatar
                                }
                            });
                        }
                    });
                    this.setState({
                        adminOptions: adminsList,
                        loadingAdmins: false
                    });
                } else {
                    alert("Oops! We couldn't find any admins");
                }
            } else {
                alert(`Oops! We encountered an error: ${res.data.errMsg}`);
                console.log(res.data.errMsg);
            }
        }).catch((err) => {
            alert("Oops! We encountered an error.");
            console.log(err);
        });
    }

    setAdminToFlag(e, { value }) {
        this.setState({
            flaggedAdmin: value
        });
    }

    flagProject() {
        if (this.state.flaggedAdmin !== '') {
            if (this.state.id !== '') {
                const toFlag = {
                    id: this.state.id,
                    newAssignee: this.state.flaggedAdmin
                };
                axios.post('/development/projects/flag', toFlag, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }).then((res) => {
                    if (!res.data.err) {
                        this.getProjectDetail();
                        alert("Successfully flagged the project!");
                        this.setState({
                            showFlagModal: false,
                            adminOptions: [],
                            flaggedAdmin: ''
                        });
                    } else {
                        alert(`Oops! We encountered an error: ${res.data.errMsg}`);
                        console.log(res.data.errMsg);
                    }
                }).catch((err) => {
                    alert("Oops! We encountered an error.");
                    console.log(err);
                });
            } else {
                alert("Missing required field. Try reloading the page.");
            }
        } else {
            alert("Select an admin to assign.");
        }
    }

    unflagProject() {
        if (this.state.id !== '') {
            const toUnflag = {
                id: this.state.id
            };
            axios.post('/development/projects/unflag', toUnflag, {
                headers: {
                    'Content-Type': 'application/json'
                }
            }).then((res) => {
                if (!res.data.err) {
                    this.getProjectDetail();
                    alert("Successfully unflagged project.");
                    this.setState({
                        showUnflagModal: false
                    });
                } else {
                    alert(`Oops! We encountered an error: ${res.data.errMsg}`);
                    console.log(res.data.errMsg);
                }
            }).catch((err) => {
                alert("Oops! We encountered an error.");
                console.log(err);
            });
        } else {
            alert("Missing a required parameter. Try reloading the page.");
        }
    }

    getProgressUpdates() {
        axios.get('/development/projects/updates/all', {
            params: {
                id: this.state.id
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.updates != null) {
                    this.setState({
                        updates: res.data.updates
                    });
                }
            } else {
                alert(`Oops! We encountered an error: ${res.data.errMsg}`);
                console.log(res.data.errMsg);
            }
        }).catch((err) => {
            alert("Oops! We encountered an error.");
            console.log(err);
        });
    }

    submitUpdate() {
        if (this.state.updateHours !== 0 && this.state.updateProgress !== 0 && this.state.updateAccomplishments !== '' && this.state.updateIssues !== '' && this.state.updateObjectives !== '') {
            const toSubmit = {
                projectID: this.state.id,
                estimatedProgress: this.state.updateProgress,
                estimatedHours: this.state.updateHours,
                accomplishments: this.state.updateAccomplishments,
                issues: this.state.updateIssues,
                objectives: this.state.updateObjectives,
                notes: this.state.updateNotes
            };
            axios.post('/development/projects/updates/new', toSubmit, {
                headers: {
                    'Content-Type': 'application/json'
                }
            }).then((res) => {
                if (!res.data.err) {
                    this.setState({
                        updateDate: '',
                        updateProgress: 0,
                        updateHours: 0,
                        updateAccomplishments: '',
                        updateIssues: '',
                        updateObjectives: '',
                        updateNotes: '',
                        showUpdateModal: false
                    }, () => {
                        this.getProjectDetail();
                    });
                } else {
                    alert(`Oops! We encountered an error: ${res.data.errMsg}`);
                    console.log(res.data.errMsg);
                }
            }).catch((err) => {
                alert("Oops! We encountered an error.");
                console.log(err);
            });
        } else {
            alert("Please fill out all fields.");
        }
    }

    deleteUpdate() {
        if (this.state.id != null && this.state.deleteProgressID != null) {
            const toDelete = {
                projectID: this.state.id,
                updateID: this.state.deleteProgressID
            };
            axios.post('/development/projects/updates/delete', toDelete, {
                headers: {
                    'Content-Type': 'application/json'
                }
            }).then((res) => {
                if (!res.data.err) {
                    this.setState({
                        deleteProgressID: '',
                        deleteProgressTitle: '',
                        showDeleteProgressModal: false
                    }, () => {
                        this.getProjectDetail();
                    });
                } else {
                    alert(`Oops! We encountered an error: ${res.data.errMsg}`);
                    console.log(res.data.errMsg);
                }
            }).catch((err) => {
                alert("Oops! We encountered an error.");
                console.log(err);
            });
        }
    }

    markCompleted() {
        const toComplete = {
            id: this.state.id
        };
        axios.post('/development/projects/markcompleted', toComplete, {
            headers: {
                'Content-Type': 'application/json'
            }
        }).then((res) => {
            if (!res.data.err) {
                this.setState({
                    showMarkCompletedModal: false,
                    showCompletedSuccess: true
                }, () => {
                    this.getProjectDetail();
                });
            } else {
                alert(`Oops! We encountered an error: ${res.data.errMsg}`);
                console.log(res.data.errMsg);
            }
        }).catch((err) => {
            alert("Oops! We encountered an error.");
            console.log(err);
        });
    }

    render() {
        var statusDisplay = '';
        if (this.state.status === 'ready') {
            statusDisplay = 'Ready';
        } else if (this.state.status === 'ip') {
            statusDisplay = 'In Progress';
        } else if (this.state.status === 'flagged') {
            statusDisplay = 'Flagged';
        } else if (this.state.status === 'completed') {
            statusDisplay = 'Completed';
        }
        return(
            <Grid className='component-container' divided='vertically'>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Header className='component-header'>Project: <span className='project-detail-titleheader'>{this.state.title}</span></Header>
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Segment>
                            <Container fluid>
                                <Link to='/development'>
                                    <Button color='blue' basic>
                                        <Button.Content>
                                            <Icon name='arrow left' />
                                            Back to Development
                                        </Button.Content>
                                    </Button>
                                </Link>
                                <span className='resource-id-span'>ID: {this.state.id}</span>
                            </Container>
                            <Divider />
                            <Segment basic className='component-innercontainer'>
                                {this.state.showCompletedSuccess &&
                                    <Message floating positive icon>
                                        <Icon name='check square' />
                                        <Message.Header>Project successfully marked completed!</Message.Header>
                                    </Message>
                                }
                                {this.state.showCreateSuccess &&
                                    <Message floating positive icon>
                                        <Icon name='check square' />
                                        <Message.Header>Project successfully created!</Message.Header>
                                    </Message>
                                }
                                {this.state.showUpdateSuccess &&
                                    <Message floating positive icon>
                                        <Icon name='check square' />
                                        <Message.Header>Project successfully updated!</Message.Header>
                                    </Message>
                                }
                                <Container fluid>
                                    <Button color='blue' floated='right' onClick={this.editProject.bind(this)}>
                                        <Icon name='edit' />
                                        Edit Project
                                    </Button>
                                    {this.state.status !== "flagged"
                                        ? (
                                            <Button color='orange' floated='right' onClick={this.openFlagModal.bind(this)}>
                                                <Icon name='flag' />
                                                Flag Project
                                            </Button>
                                        )
                                        : (
                                            <Button color='orange' floated='right' onClick={this.openUnflagModal.bind(this)}>
                                                <Icon name='flag outline' />
                                                Unflag Project
                                            </Button>
                                        )
                                    }
                                    <Button color='red' floated='right' onClick={this.openDeleteModal.bind(this)}>
                                        <Icon name='trash' />
                                        Delete Project
                                    </Button>
                                    <Grid className='clear-grid'>
                                        <Grid.Row columns={3}>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Project Title</Header>
                                                <span className='project-detail-text'>{this.state.title}</span>
                                            </Grid.Column>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Status</Header>
                                                {statusDisplay === '' ?
                                                    <span className='gray-span'><em>Unspecified</em></span>
                                                    :
                                                    <span className='project-detail-text'>{statusDisplay}</span>
                                                }
                                            </Grid.Column>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Current Progress</Header>
                                                <span className='project-detail-text'>{this.state.currentProgress}%</span>
                                            </Grid.Column>
                                        </Grid.Row>
                                        <Grid.Row columns={1}>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Resource URL</Header>
                                                <a href={String(this.state.resourceURL).includes('http') ?
                                                    this.state.resourceURL :
                                                    `https://${this.state.resourceURL}`
                                                } target='_blank' className='project-detail-text' rel='noreferrer'>{this.state.resourceURL}</a>
                                            </Grid.Column>
                                        </Grid.Row>
                                        <Grid.Row columns={1}>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Assignees</Header>
                                                <span className='project-detail-text'>{this.state.assignees}</span>
                                            </Grid.Column>
                                        </Grid.Row>
                                        <Grid.Row columns={1}>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Description & Notes</Header>
                                                <p className='project-detail-text multiline-display'>{this.state.description}</p>
                                            </Grid.Column>
                                        </Grid.Row>
                                    </Grid>
                                    <Grid className='clear-grid project-updates-grid'>
                                        <Grid.Row columns={1}>
                                            <Grid.Column>
                                                <Header size='large' as="span">Project Updates</Header>
                                                <Button color='green' floated='right' onClick={this.openUpdateModal.bind(this)}>
                                                    <Icon name='write' />
                                                    New Update
                                                </Button>
                                                <Divider />
                                                {((this.state.currentProgress === 100) && (this.state.status !== 'completed')) &&
                                                    <Button color='green' fluid onClick={this.openMarkCompletedModal.bind(this)}>
                                                        <Icon name='check' />
                                                        Mark Completed
                                                    </Button>
                                                }
                                                {this.state.updates.map((item, index) => {
                                                    const itemDate = new Date(item.createdAt);
                                                    item.date = date.format(itemDate, 'MMMM DDD, YYYY');
                                                    item.time = date.format(itemDate, 'h:mm A')
                                                    return (
                                                        <Card fluid key={index}>
                                                            <Card.Content>
                                                                <Button floated='right' icon color='red' onClick={() => this.openDeleteProgressModal(item.updateID)}>
                                                                    <Icon name='trash' />
                                                                </Button>
                                                                <Image
                                                                    floated='left'
                                                                    size='mini'
                                                                    src={`${item.author.avatar}`}
                                                                    circular
                                                                />
                                                                <Card.Header>{item.date} — <em>{item.estimatedProgress}% <span className='gray-span'>(estimated)</span> - {item.estimatedHours} Hours <span className='gray-span'>(estimated)</span></em></Card.Header>
                                                                <Card.Meta>{item.author.firstName} {item.author.lastName} | {item.time}</Card.Meta>
                                                            </Card.Content>
                                                            <Card.Content>
                                                                <Header size='small'>Accomplishments</Header>
                                                                <Card.Description>{item.accomplishments}</Card.Description>
                                                                <Header size='small'>Issues</Header>
                                                                <Card.Description>{item.issues}</Card.Description>
                                                                <Header size='small'>Objectives</Header>
                                                                <Card.Description>{item.objectives}</Card.Description>
                                                            </Card.Content>
                                                            <Card.Content>
                                                                <Header size='small'>Other Notes</Header>
                                                                <Card.Description>
                                                                    {item.notes}
                                                                    {item.notes === '' &&
                                                                        "N/A"
                                                                    }
                                                                </Card.Description>
                                                            </Card.Content>
                                                        </Card>
                                                    )
                                                })}
                                                {(this.state.updates.length === 0) &&
                                                    <Message><p>There are no progress updates yet.</p></Message>
                                                }
                                                <Segment basic></Segment>
                                            </Grid.Column>
                                        </Grid.Row>
                                    </Grid>
                                </Container>
                            </Segment>
                        </Segment>
                    </Grid.Column>
                </Grid.Row>
                {/* New Project Update Modal */}
                <Modal
                    onClose={this.closeUpdateModal.bind(this)}
                    open={this.state.showUpdateModal}
                >
                    <Modal.Header>New Project Update</Modal.Header>
                    <Modal.Content>
                        <Header sub>Date</Header>
                        <p>{this.state.updateDate}</p>
                        <Form>
                            <Form.Input fluid type='number' label='Estimated Hours Worked (since last update)' placeholder="Enter estimated hours worked on this project since the last update.." onChange={this.setUpdateHours.bind(this)} value={this.state.updateHours} required />
                            <Form.Input fluid type='number' label='Estimated Project Progress (%)' placeholder="Enter estimated progress percentage.." onChange={this.setUpdateProgress.bind(this)} value={this.state.updateProgress} required />
                            <Form.TextArea label='Accomplishments' placeholder="Describe project accomplishments since the last update..." onChange={this.setUpdateAccommplishments.bind(this)} value={this.state.updateAccomplishments} required />
                            <Form.TextArea label='Issues' placeholder="Describe issues with the project since the last update..." onChange={this.setUpdateIssues.bind(this)} value={this.state.updateIssues} required />
                            <Form.TextArea label='Objectives' placeholder="Describe the next objectives for the project..." onChange={this.setUpdateObjectives.bind(this)} value={this.state.updateObjectives} required />
                            <Form.TextArea label='Other Notes' placeholder="Place any other notes here..." onChange={this.setUpdateNotes.bind(this)} value={this.state.updateNotes} />
                        </Form>
                    </Modal.Content>
                    <Modal.Actions>
                        <Button onClick={this.closeUpdateModal.bind(this)}>Cancel</Button>
                        <Button color='green' onClick={this.submitUpdate.bind(this)}>
                            <Icon name='write' />
                            Submit Update
                        </Button>
                    </Modal.Actions>
                </Modal>
                {/* Edit Progress Update Modal
                <Modal
                    onClose={this.closeEditProgressModal.bind(this)}
                    open={this.state.showEditProgressModal}
                >
                    <Modal.Header>Edit Progress Update</Modal.Header>
                    <Modal.Content>
                        <Header sub>Date</Header>
                        <p>December 1st, 2020</p>
                        <Form>
                            <Form.Input fluid type='number' label='Current Chapter' placeholder="Enter the current completed chapter number..." onChange={this.setUpdateChapter.bind(this)} value={this.state.updateChapter}/>
                            <Form.TextArea label='Message/Notes' placeholder="Describe project progress since the last update..." onChange={this.setUpdateMessage.bind(this)} value={this.state.updateMessage} />
                        </Form>
                    </Modal.Content>
                    <Modal.Actions>
                        <Button onClick={this.closeEditProgressModal.bind(this)}>Cancel</Button>
                        <Button color='green'>
                            <Icon name='save outline' />
                            Save Changes
                        </Button>
                    </Modal.Actions>
                </Modal>
                */}
                {/* Delete Progress Update Modal */}
                <Modal
                    onClose={this.closeDeleteProgressModal.bind(this)}
                    open={this.state.showDeleteProgressModal}
                >
                    <Modal.Header>Delete Progress Update</Modal.Header>
                    <Modal.Content>
                        <Message icon negative>
                            <Icon name='warning sign' />
                            <Message.Content>
                                <Message.Header>Are you sure you want to delete the progress update <em>{this.state.deleteProgressTitle}</em>?</Message.Header>
                            </Message.Content>
                        </Message>
                    </Modal.Content>
                    <Modal.Actions>
                        <Button onClick={this.closeDeleteProgressModal.bind(this)}>Cancel</Button>
                        <Button color='red' onClick={this.deleteUpdate.bind(this)}>
                            <Icon name='trash' />
                            Delete Update
                        </Button>
                    </Modal.Actions>
                </Modal>
                {/* Mark Project Completed Modal */}
                <Modal
                    onClose={this.closeMarkCompletedModal.bind(this)}
                    open={this.state.showMarkCompletedModal}
                >
                    <Modal.Header>Mark Project Completed</Modal.Header>
                    <Modal.Content>
                        <Message icon info>
                            <Icon name='check' />
                            <Message.Content>
                                <Message.Header>Are you sure you want to mark this project as completed?</Message.Header>
                            </Message.Content>
                        </Message>
                    </Modal.Content>
                    <Modal.Actions>
                        <Button onClick={this.closeMarkCompletedModal.bind(this)}>Cancel</Button>
                        <Button color='green' onClick={this.markCompleted.bind(this)}>
                            <Icon name='check' />
                            Mark Completed
                        </Button>
                    </Modal.Actions>
                </Modal>
                {/* Project Deletion Modal */}
                <Modal
                    onClose={this.closeDeleteModal.bind(this)}
                    open={this.state.showDeleteModal}
                >
                    <Modal.Header>Confirm Project Deletion</Modal.Header>
                    <Modal.Content>
                        <Message icon negative>
                            <Icon name='warning sign' />
                            <Message.Content>
                                <Message.Header>Are you sure you want to delete the project <em>{this.state.title}</em> (ID: {this.state.id})?</Message.Header>
                                <p>This can not be undone.</p>
                            </Message.Content>
                        </Message>
                    </Modal.Content>
                    <Modal.Actions>
                        <Button onClick={this.closeDeleteModal.bind(this)}>Cancel</Button>
                        <Button negative onClick={this.deleteProject.bind(this)}>
                            <Icon name='trash' />
                            Confirm Deletion
                        </Button>
                    </Modal.Actions>
                </Modal>
                {/* Flag Project Modal */}
                <Modal
                    onClose={this.closeFlagModal.bind(this)}
                    open={this.state.showFlagModal}
                >
                    <Modal.Header>Flag Project</Modal.Header>
                    <Modal.Content>
                        <p>Flag this project to request help or further review from a LibreTexts administrator. Describe your issues in the <em>Notes</em> section of the project information page.</p>
                        <Dropdown
                            placeholder='Select administrator'
                            fluid
                            selection
                            options={this.state.adminOptions}
                            loading={this.state.loadingAdmins}
                            onChange={this.setAdminToFlag.bind(this)}
                        />
                    </Modal.Content>
                    <Modal.Actions>
                        <Button onClick={this.closeFlagModal.bind(this)}>Cancel</Button>
                        <Button color='orange' onClick={this.flagProject.bind(this)}>
                            <Icon name='flag' />
                            Flag Project
                        </Button>
                    </Modal.Actions>
                </Modal>
                {/* Unflag Project Modal */}
                <Modal
                    onClose={this.closeUnflagModal.bind(this)}
                    open={this.state.showUnflagModal}
                >
                    <Modal.Header>Unflag Project</Modal.Header>
                    <Modal.Content>
                        <p>Are you sure you want to unflag this project? This will remove the project from the selected admin's flagged queue.</p>
                    </Modal.Content>
                    <Modal.Actions>
                        <Button onClick={this.closeUnflagModal.bind(this)}>Cancel</Button>
                        <Button color='orange' onClick={this.unflagProject.bind(this)}>
                            <Icon name='flag outline' />
                            Unflag Project
                        </Button>
                    </Modal.Actions>
                </Modal>
            </Grid>
        );
    }
}

export default DevProjectDetail;
