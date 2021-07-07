import '../AdministrationPortal.css';

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
  Form
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import React, { Component } from 'react';
import axios from 'axios';
import queryString from 'query-string';

import { UserContext } from '../../../providers.js';

class AdminTaskDetail extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
            id: '',
            title: '',
            status: '',
            description: '',
            showCreateSuccess: false,
            showUpdateSuccess: false,
            showDeleteModal: false,
            showNewProjectModal: false,
            NPTitle: '',
            NPDescription: ''
        };
    }

    componentDidMount() {
        document.title = "LibreTexts PTS | Administration | Task Queue | Detail";
        //const [user] = this.context;
        const queryValues = queryString.parse(this.props.location.search);
        const createSuccess = decodeURIComponent(queryValues.showCreateSuccess);
        const updateSuccess = decodeURIComponent(queryValues.showUpdateSuccess);
        var setCreateSuccess = false;
        var setUpdateSuccess = false;
        if (createSuccess === "true") {
            setCreateSuccess = true;
        }
        if (updateSuccess === "true") {
            setUpdateSuccess = true;
        }
        this.setState({
            id: this.props.match.params.id,
            showCreateSuccess: setCreateSuccess,
            showUpdateSuccess: setUpdateSuccess
        }, () => {
            this.getTaskDetail();
        });
    }

    getTaskDetail() {
        if (this.state.id !== '') {
            axios.get('/admin/taskqueue/tasks/detail', {
                params: {
                    id: this.state.id
                }
            }).then((res) => {
                if (!res.data.err) {
                    if (res.data.task !== null) {
                        this.setState({
                            title: res.data.task.title,
                            status: res.data.task.status,
                            description: res.data.task.description
                        });
                    }
                } else {
                    alert(`Oops! We encountered an error: ${res.data.errMsg.toString()}`);
                    console.log(res.data.errMsg.toString());
                }
            }).catch((err) => {
                alert("Oops! We encountered an error.");
                console.log(err.toString());
            });
        }
    }

    openDeleteModal() {
        this.setState({ showDeleteModal: true });
    }

    closeDeleteModal() {
        this.setState({ showDeleteModal: false });
    }

    openNewProjectModal() {
        this.setState({
            NPTitle: this.state.title,
            NPDescription: this.state.description,
            showNewProjectModal: true
        });
    }

    closeNewProjectModal() {
        this.setState({
            showNewProjectModal: false,
            NPTitle: '',
            NPDescription: ''
        });
    }

    editTask() {
        this.props.history.push(`/admin/taskqueue/${this.state.id}/edit`);
    }

    deleteTask() {
        const toDelete = {
            id: this.state.id
        };
        axios.post('/admin/taskqueue/tasks/delete', toDelete, {
            headers: {
                'Content-Type': 'application/json'
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.deletedTask) {
                    this.props.history.push('/admin/taskqueue?showDeleteSuccess=true');
                } else {
                    alert("Oops! We're having trouble deleting that task.");
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

    setNPTitle(e) {
        this.setState({ NPTitle: e.target.value });
    }

    setNPDescription(e) {
        this.setState({ NPDescription: e.target.value });
    }

    createNewProject() {
        const newProject = {
            adminTaskID: this.state.id,
            title: this.state.NPTitle,
            description: this.state.NPDescription
        };
        axios.post('/admin/projects/newfromtask', newProject, {
            headers: {
                'Content-Type': 'application/json'
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.id !== null) {
                    this.props.history.push(`/admin/projects/${res.data.id}?showCreateSuccess=true`);
                } else {
                    alert(res.data.errMsg);
                }
            } else {
                alert(res.data.errMsg);
            }
        }).catch((err) => {
            alert(err.toString());
            console.log(err);
        });
    }

    render() {
        var statusDisplay = '';
        if (this.state.status === 'ready') {
            statusDisplay = 'Ready';
        } else if (this.state.status === 'wait') {
            statusDisplay = 'Waiting for more information';
        } else if (this.state.status === 'review') {
            statusDisplay = 'Needs further review';
        }
        return(
            <Grid className='component-container' divided='vertically'>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Header className='component-header'>Task: <span className='taskqueue-detail-titleheader'>{this.state.title}</span></Header>
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Segment>
                            <Container fluid>
                                <Link to='/admin/taskqueue'>
                                    <Button color='blue' basic>
                                        <Button.Content>
                                            <Icon name='arrow left' />
                                            Back to Task Queue
                                        </Button.Content>
                                    </Button>
                                </Link>
                                <span className='resource-id-span'>ID: {this.state.id}</span>
                            </Container>
                            <Divider />
                            <Segment basic className='component-innercontainer'>
                                {this.state.showCreateSuccess &&
                                    <Message floating positive icon>
                                        <Icon name='check square' />
                                        <Message.Header>Task successfully created!</Message.Header>
                                    </Message>
                                }
                                {this.state.showUpdateSuccess &&
                                    <Message floating positive icon>
                                        <Icon name='check square' />
                                        <Message.Header>Task successfully updated!</Message.Header>
                                    </Message>
                                }
                                <Container fluid>
                                    <Button color='blue' floated='right' onClick={this.editTask.bind(this)}>
                                        <Icon name='edit' />
                                        Edit Task
                                    </Button>
                                    <Button color='red' floated='right' onClick={this.openDeleteModal.bind(this)}>
                                        <Icon name='trash' />
                                        Delete Task
                                    </Button>
                                    <Grid className='clear-grid'>
                                        <Grid.Row columns={1}>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Title</Header>
                                                <span className='taskqueue-detail-text'>{this.state.title}</span>
                                            </Grid.Column>
                                        </Grid.Row>
                                        <Grid.Row columns={1}>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Status</Header>
                                                {statusDisplay === '' ?
                                                    <span className='gray-span'><em>Unspecified</em></span>
                                                    :
                                                    <span className='taskqueue-detail-text'>{statusDisplay}</span>
                                                }
                                            </Grid.Column>
                                        </Grid.Row>
                                        <Grid.Row columns={1}>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Description & Notes</Header>
                                                {this.state.description === '' ?
                                                    <span className='gray-span'><em>Unspecified</em></span>
                                                    :
                                                    <span className='taskqueue-detail-text multiline-display'>{this.state.description}</span>
                                                }
                                            </Grid.Column>
                                        </Grid.Row>
                                    </Grid>
                                    <Segment basic>
                                        <Button color='green' fluid onClick={this.openNewProjectModal.bind(this)}>
                                            <Icon name='crosshairs' />
                                            Start New Project
                                        </Button>
                                    </Segment>
                                </Container>
                            </Segment>
                        </Segment>
                    </Grid.Column>
                </Grid.Row>
                {/* New Project From Task Modal */}
                <Modal
                    onClose={this.closeNewProjectModal.bind(this)}
                    open={this.state.showNewProjectModal}
                >
                    <Modal.Header>New Project from Task</Modal.Header>
                    <Modal.Content>
                        <Form>
                            <Form.Input name='title' label='Title' type='text' placeholder="Enter the title..." required onChange={this.setNPTitle.bind(this)} value={this.state.NPTitle}/>
                            <Form.TextArea label='Description & Notes' placeholder="Describe the project here..." onChange={this.setNPDescription.bind(this)} value={this.state.NPDescription} />
                        </Form>
                    </Modal.Content>
                    <Modal.Actions>
                        <Button onClick={this.closeNewProjectModal.bind(this)}>Cancel</Button>
                        <Button color='green' onClick={this.createNewProject.bind(this)}>
                            <Icon name='add' />
                            Create Project
                        </Button>
                    </Modal.Actions>
                </Modal>
                {/* Confirm Task Deletion Modal */}
                <Modal
                    onClose={this.closeDeleteModal.bind(this)}
                    open={this.state.showDeleteModal}
                >
                    <Modal.Header>Confirm Task Deletion</Modal.Header>
                    <Modal.Content>
                        <Message icon negative>
                            <Icon name='warning sign' />
                            <Message.Content>
                                <Message.Header>Are you sure you want to delete the task <em>{this.state.title}</em>?</Message.Header>
                                <p>This can not be undone.</p>
                            </Message.Content>
                        </Message>
                    </Modal.Content>
                    <Modal.Actions>
                        <Button onClick={this.closeDeleteModal.bind(this)}>Cancel</Button>
                        <Button negative onClick={this.deleteTask.bind(this)}>
                            <Icon name='trash' />
                            Confirm Deletion
                        </Button>
                    </Modal.Actions>
                </Modal>
            </Grid>
        );
    }
}

export default AdminTaskDetail;
