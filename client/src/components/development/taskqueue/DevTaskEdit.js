import './taskqueuestyles.css';

import {
  Grid,
  Header,
  Segment,
  Divider,
  Icon,
  Button,
  Form,
  Modal
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import React, { Component } from 'react';
import axios from 'axios';

import { UserContext } from '../../../providers.js';
import { statusOptions } from '../../util/DevMasterOptions.js';

class DevTaskEdit extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
            id: '',
            title: '',
            status: '',
            description: '',
            resourceURL: '',
            showErrModal: false,
            modalErrMsg: '',
            previous: {
                title: '',
                status: '',
                description: '',
                resourceURL: ''
            }
        };
    }

    componentDidMount() {
        document.title = "LibreTexts PTS | Development | Task Queue | Edit Task";
        //const [user] = this.context;
        this.setState({
            id: this.props.match.params.id
        }, () => {
            this.getTaskInfo();
        });
    }

    setTitle(e) {
        this.setState({ title: e.target.value });
    }

    setStatus(e, { value }) {
        this.setState({ status: value });
    }

    setDescription(e) {
        this.setState({ description: e.target.value });
    }

    setResourceURL(e) {
        this.setState({ resourceURL: e.target.value });
    }

    getTaskInfo() {
        if (this.state.id !== '') {
            axios.get('/development/taskqueue/tasks/detail', {
                params: {
                    id: this.state.id
                }
            }).then((res) => {
                if (!res.data.err) {
                    if (res.data.task !== null) {
                        this.setState({
                            title: res.data.task.title,
                            status: res.data.task.status,
                            description: res.data.task.description,
                            resourceURL: res.data.task.resourceURL,
                            previous: {
                                title: res.data.task.title,
                                status: res.data.task.status,
                                description: res.data.task.description,
                                resourceURL: res.data.task.resourceURL
                            }
                        });
                    }
                } else {
                    alert(`Oops! We encountered an error: ${res.data.errMsg}`);
                }
            }).catch((err) => {
                alert(`Oops! We encountered an error: ${err}`);
            });
        }
    }

    saveChanges() {
        const newTask = {
            id: this.state.id,
            title: this.state.title,
            status: this.state.status,
            description: this.state.description,
            resourceURL: this.state.resourceURL
        };
        var toSend = {
            id: newTask.id
        };
        if (newTask.title !== this.state.previous.title) {
            toSend.title = newTask.title;
        }
        if (newTask.status !== this.state.previous.status) {
            toSend.status = newTask.status;
        }
        if (newTask.description !== this.state.previous.description) {
            toSend.description = newTask.description;
        }
        if (newTask.resourceURL !== this.state.previous.resourceURL) {
            toSend.resourceURL = newTask.resourceURL;
        }
        axios.post('/development/taskqueue/tasks/update', toSend, {
            headers: {
                'Content-Type': 'application/json'
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.id) {
                    this.props.history.push(`/development/taskqueue/${res.data.id}?showUpdateSuccess=true`);
                }
            } else {
                this.setState({ showErrModal: true, modalErrMsg: res.data.errMsg });
            }
        }).catch((err) => {
            this.setState({ showErrModal: true, modalErrMsg: err });
        });
    }

    cancelChanges() {
        this.props.history.push(`/development/taskqueue/${this.state.id}`);
    }

    closeModal() {
        this.setState({ showErrModal: false, modalErrMsg: '' });
    }

    render() {
        return(
            <Grid className='component-container' divided='vertically'>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Header className='component-header'>Task: <span className='taskqueue-detail-titleheader'>{this.state.previous.title}</span></Header>
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Segment>
                            <Link to={`/development/taskqueue/${this.state.id}`}>
                                <Button color='blue' basic>
                                    <Button.Content>
                                        <Icon name='arrow left' />
                                        Back to Task Detail
                                    </Button.Content>
                                </Button>
                            </Link>
                            <Divider />
                            <Segment basic className='component-innercontainer'>
                                <Header as='h2' className='formheader'>Edit Development Task</Header>
                                <Form onSubmit={this.saveChanges.bind(this)}>
                                    <Form.Input name='title' label='Title' type='text' placeholder="Enter the title..." required onChange={this.setTitle.bind(this)} value={this.state.title}/>
                                    <Form.Select
                                        fluid
                                        label='Status'
                                        options={statusOptions}
                                        placeholder='Status...'
                                        onChange={this.setStatus.bind(this)}
                                        value={this.state.status}
                                    />
                                    <Form.Input label='Resource URL' type='text' placeholder="Enter a relevant resource URL..." onChange={this.setResourceURL.bind(this)} value={this.state.resourceURL}/>
                                    <Form.TextArea label='Description & Notes' placeholder="Describe the task here..." onChange={this.setDescription.bind(this)} value={this.state.description} />
                                    <Button type='submit' color='green' floated='right'>
                                        <Icon name='save outline' />
                                        Save Changes
                                    </Button>
                                    <Button className='button-float-right' onClick={this.cancelChanges.bind(this)}>Cancel</Button>
                                </Form>
                            </Segment>
                        </Segment>
                    </Grid.Column>
                </Grid.Row>
                <Modal
                    onClose={this.closeModal.bind(this)}
                    open={this.state.showErrModal}
                >
                    <Modal.Header>Edit Task: Error</Modal.Header>
                    <Modal.Content>
                        <Modal.Description>
                            <p>{this.state.modalErrMsg}</p>
                        </Modal.Description>
                    </Modal.Content>
                    <Modal.Actions>
                        <Button color="black" onClick={this.closeModal.bind(this)}>Okay</Button>
                    </Modal.Actions>
                </Modal>
            </Grid>
        );
    }
}

export default DevTaskEdit;
