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

class DevTaskAdd extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
            title: '',
            status: '',
            description: '',
            resourceURL: '',
            showErrModal: false,
            modalErrMsg: ''
        };
    }

    componentDidMount() {
        document.title = "LibreTexts Conductor | Development | Task Queue | Add Task";
        //const [user] = this.context;
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

    submitTaskForm() {
        const newTask = {
            title: this.state.title,
            status: this.state.status,
            description: this.state.description,
            resourceURL: this.state.resourceURL
        };
        axios.post('/development/taskqueue/add', newTask, {
            headers: {
                'Content-Type': 'application/json'
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.id !== null) {
                    this.props.history.push(`/development/taskqueue/${res.data.id}?showCreateSuccess=true`);
                } else {
                    this.setState({ showErrModal: true, modalErrMsg: "Oops! We encountered an error creating the task." });
                }
            } else {
                this.setState({ showErrModal: true, modalErrMsg: res.data.errMsg.toString() });
            }
        }).catch((err) => {
            this.setState({ showErrModal: true, modalErrMsg: err.toString() });
        });
    }

    closeModal() {
        this.setState({ showErrModal: false, modalErrMsg: '' });
    }

    render() {
        return(
            <Grid className='component-container' divided='vertically'>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Header className='component-header'>Task Queue</Header>
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Segment>
                            <Link to='/development/taskqueue'>
                                <Button color='blue' basic>
                                    <Button.Content>
                                        <Icon name='arrow left' />
                                        Back to Task Queue
                                    </Button.Content>
                                </Button>
                            </Link>
                            <Divider />
                            <Segment basic className='component-innercontainer'>
                                <Header as='h2' className='formheader'>Add a Development Task</Header>
                                <Form onSubmit={this.submitTaskForm.bind(this)}>
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
                                    <Button type='submit' color='green' className='button-float-right'>Add Task</Button>
                                </Form>
                            </Segment>
                        </Segment>
                    </Grid.Column>
                </Grid.Row>
                <Modal
                    onClose={this.closeModal.bind(this)}
                    open={this.state.showErrModal}
                >
                    <Modal.Header>Add Task: Error</Modal.Header>
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

export default DevTaskAdd;
