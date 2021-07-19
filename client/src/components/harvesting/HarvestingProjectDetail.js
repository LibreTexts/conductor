import './HarvestingPortal.css';

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
import {
    libraryOptions,
    allShelfMap
} from '../util/HarvestingMasterOptions.js';

class HarvestingProjectDetail extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
            id: '',
            title: '',
            status: '',
            chapters: 0,
            currentChapter: 0,
            currentProgress: 0,
            textbookURL: '',
            libreURL: '',
            library: '',
            shelf: '',
            notes: '',
            updates: [],
            assignees: '',
            showCreateSuccess: false,
            showCreateFASuccess: false,
            showUpdateSuccess: false,
            showCompletedSuccess: false,
            showDeleteModal: false,
            showFlagModal: false,
            showUnflagModal: false,
            loadingAdmins: false,
            adminOptions: [],
            flaggedAdmin: '',
            showUpdateModal: false,
            showDeleteProgressModal: false,
            showEditProgressModal: false,
            showMarkCompletedModal: false,
            updateDate: '',
            updateChapter: 0,
            updateMessage: '',
            deleteProgressID: '',
            deleteProgressTitle: ''
        };
    }

    componentDidMount() {
        document.title = "LibreTexts Conductor | Harvesting | Projects | Detail";
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
            axios.get('/harvesting/projects/detail', {
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
                            chapters: res.data.project.chapters,
                            currentChapter: res.data.project.currentChapter,
                            currentProgress: res.data.project.currentProgress,
                            textbookURL: res.data.project.textbookURL,
                            libreURL: res.data.project.libreURL,
                            library: res.data.project.library,
                            shelf: res.data.project.shelf,
                            notes: res.data.project.notes,
                            assignees: assigneesArray.join(', ')
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

    openDeleteModal() {
        this.setState({ showDeleteModal: true });
    }

    closeDeleteModal() {
        this.setState({ showDeleteModal: false });
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
            updateChapter: 0,
            updateMessage: ''
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
        this.props.history.push(`/harvesting/projects/${this.state.id}/edit`);
    }

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

    flagProject() {
        if (this.state.flaggedAdmin !== '') {
            if (this.state.id !== '') {
                const toFlag = {
                    id: this.state.id,
                    newAssignee: this.state.flaggedAdmin
                };
                axios.post('/harvesting/projects/flag', toFlag, {
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
            axios.post('/harvesting/projects/unflag', toUnflag, {
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

    deleteProject() {
        const toDelete = {
            id: this.state.id
        };
        axios.post('/harvesting/projects/delete', toDelete, {
            headers: {
                'Content-Type': 'application/json'
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.deletedProject) {
                    this.props.history.push('/harvesting?showProjectDeleteSuccess=true');
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

    setUpdateChapter(e) {
        this.setState({ updateChapter: e.target.value });
    }

    setUpdateMessage(e) {
        this.setState({ updateMessage: e.target.value });
    }

    /*
    setEditUpdateChapter(e) {
        this.setState({ editUpdateChapter: e.target.value });
    }

    setEditUpdateMessage(e) {
        this.setState({ editUpdateMessage: e.target.value });
    }
    */

    setAdminToFlag(e, { value }) {
        this.setState({
            flaggedAdmin: value
        });
    }

    getProgressUpdates() {
        axios.get('/harvesting/projects/updates/all', {
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
        if (this.state.updateMessage !== '' && this.state.updateChapter !== 0) {
            const toSubmit = {
                projectID: this.state.id,
                message: this.state.updateMessage,
                chapterCompleted: this.state.updateChapter
            };
            axios.post('/harvesting/projects/updates/new', toSubmit, {
                headers: {
                    'Content-Type': 'application/json'
                }
            }).then((res) => {
                if (!res.data.err) {
                    this.setState({
                        updateDate: '',
                        updateChapter: 0,
                        updateMessage: '',
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
            axios.post('/harvesting/projects/updates/delete', toDelete, {
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
        axios.post('/harvesting/projects/markcompleted', toComplete, {
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
        var libraryDisplay = '';
        var shelfDisplay = '';
        var statusDisplay = '';
        if (this.state.library !== '') {
            libraryOptions.forEach((lib) => {
                if (lib.value === this.state.library) {
                    libraryDisplay = lib.text;
                }
            });
        }
        const mappedShelf = allShelfMap.get(this.state.shelf);
        if (mappedShelf !== undefined) {
            shelfDisplay = mappedShelf;
        }
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
                                <Link to='/harvesting'>
                                    <Button color='blue' basic>
                                        <Button.Content>
                                            <Icon name='arrow left' />
                                            Back to Harvesting
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
                                {this.state.showCreateFASuccess &&
                                    <Message floating positive icon>
                                        <Icon name='check square' />
                                        <Message.Header>Project successfully created for assignee!</Message.Header>
                                    </Message>
                                }
                                {this.state.showUpdateSuccess &&
                                    <Message floating positive icon>
                                        <Icon name='check square' />
                                        <Message.Header>Project successfully updated!</Message.Header>
                                    </Message>
                                }
                                <Container fluid>
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
                                    <Button color='blue' floated='right' onClick={this.editProject.bind(this)}>
                                        <Icon name='edit' />
                                        Edit Project
                                    </Button>
                                    <Button color='red' floated='right' onClick={this.openDeleteModal.bind(this)}>
                                        <Icon name='trash' />
                                        Delete Project
                                    </Button>
                                    <Grid className='clear-grid'>
                                        <Grid.Row columns={2}>
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
                                        </Grid.Row>
                                        <Grid.Row columns={3}>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Current Progress</Header>
                                                <span className='project-detail-text'>{this.state.currentProgress}%</span>
                                            </Grid.Column>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Current Chapter</Header>
                                                <span className='project-detail-text'>{this.state.currentChapter}</span>
                                            </Grid.Column>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Total Chapters</Header>
                                                <span className='project-detail-text'>{this.state.chapters}</span>
                                            </Grid.Column>
                                        </Grid.Row>
                                        <Grid.Row columns={1}>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Textbook URL</Header>
                                                <a href={String(this.state.textbookURL).includes('http') ?
                                                    this.state.textbookURL :
                                                    `https://${this.state.textbookURL}`
                                                } target='_blank' className='project-detail-text' rel='noreferrer'>{this.state.textbookURL}</a>
                                            </Grid.Column>
                                        </Grid.Row>
                                        <Grid.Row columns={1}>
                                            <Grid.Column>
                                                <Header size='medium' dividing>LibreTexts URL</Header>
                                                <a href={String(this.state.libreURL).includes('http') ?
                                                    this.state.libreURL :
                                                    `https://${this.state.libreURL}`
                                                } target='_blank' className='project-detail-text' rel='noreferrer'>{this.state.libreURL}</a>
                                            </Grid.Column>
                                        </Grid.Row>
                                        <Grid.Row columns={2}>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Library</Header>
                                                {libraryDisplay === '' ?
                                                    <span className='gray-span'><em>Unspecified</em></span>
                                                    :
                                                    <span className='project-detail-text'>{libraryDisplay}</span>
                                                }
                                            </Grid.Column>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Shelf</Header>
                                                {shelfDisplay === '' ?
                                                    <span className='gray-span'><em>Unspecified</em></span>
                                                    :
                                                    <span className='project-detail-text'>{shelfDisplay}</span>
                                                }
                                            </Grid.Column>
                                        </Grid.Row>
                                        <Grid.Row columns={1}>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Notes</Header>
                                                <p className='project-detail-text multiline-display'>{this.state.notes}</p>
                                            </Grid.Column>
                                        </Grid.Row>
                                        <Grid.Row columns={1}>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Assignees</Header>
                                                <span className='project-detail-text'>{this.state.assignees}</span>
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
                                                    item.progress = Number.parseFloat(Math.floor((item.chapterCompleted / this.state.chapters)*100)).toFixed(0);
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
                                                                <Card.Header>{item.date} — <em>{item.progress}%</em></Card.Header>
                                                                <Card.Meta>{item.author.firstName} {item.author.lastName} | {item.time}</Card.Meta>
                                                                <Card.Description>{item.message}</Card.Description>
                                                            </Card.Content>
                                                            <Card.Content extra>
                                                                <Icon name='clipboard check' />
                                                                Chapter {item.chapterCompleted} / {this.state.chapters}
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
                            <Form.Input fluid type='number' label='Current Chapter' placeholder="Enter the current completed chapter number..." onChange={this.setUpdateChapter.bind(this)} value={this.state.updateChapter}/>
                            <Form.TextArea label='Message/Notes' placeholder="Describe project progress since the last update..." onChange={this.setUpdateMessage.bind(this)} value={this.state.updateMessage} />
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

export default HarvestingProjectDetail;
