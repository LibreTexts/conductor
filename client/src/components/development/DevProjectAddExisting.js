import './DevelopmentPortal.css';

import {
  Grid,
  Header,
  Segment,
  Divider,
  Icon,
  Button,
  Form,
  Modal,
  Message
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import React, { Component } from 'react';
import axios from 'axios';

import { UserContext } from '../../providers.js';

class DevProjectAddExisting extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
            title: '',
            progress: 0,
            resourceURL: '',
            description: '',
            showErrModal: false,
            modalErrMsg: ''
        };
    }

    componentDidMount() {
        document.title = "LibreTexts Conductor | Development | Add Existing Project";
        //const [user] = this.context;
    }

    setTitle(e) {
        this.setState({ title: e.target.value });
    }

    setProgress(e) {
        this.setState({ progress: e.target.value });
    }

    setResourceURL(e) {
        this.setState({ resourceURL: e.target.value });
    }

    setDescription(e) {
        this.setState({ description: e.target.value });
    }

    submitProjectForm() {
        const newProject = {
            title: this.state.title,
            estimatedProgress: this.state.progress,
            resourceURL: this.state.resourceURL,
            description: this.state.description
        };
        axios.post('/development/projects/addexisting', newProject, {
            headers: {
                'Content-Type': 'application/json'
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.id !== undefined) {
                    this.props.history.push(`/development/projects/${res.data.id}?showCreateSuccess=true`);
                } else {
                    this.setState({ showErrModal: true, modalErrMsg: "Oops! We encountered an error creating the project." });
                }
            } else {
                this.setState({ showErrModal: true, modalErrMsg: res.data.errMsg });
            }
        }).catch((err) => {
            this.setState({ showErrModal: true, modalErrMsg: err });
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
                        <Header className='component-header'>Development</Header>
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Segment>
                            <Link to='/development'>
                                <Button color='blue' basic>
                                    <Button.Content>
                                        <Icon name='arrow left' />
                                        Back to Development
                                    </Button.Content>
                                </Button>
                            </Link>
                            <Divider />
                            <Segment basic className='component-innercontainer'>
                                <Header as='h2' className='formheader'>Add an Existing Project</Header>
                                <Message icon>
                                    <Icon name='info circle' />
                                    <Message.Content>
                                        <Message.Header>Adding an existing project</Message.Header>
                                        <p>Use this form to add an existing project that is not listed in the Task Queue. Otherwise, visit the <Link to='/development/taskqueue'>Task Queue</Link> to select a task and start a new project.</p>
                                    </Message.Content>
                                </Message>
                                <Form onSubmit={this.submitProjectForm.bind(this)}>
                                    <Form.Input name='title' label='Title' type='text' placeholder="Enter the title..." required onChange={this.setTitle.bind(this)} value={this.state.title}/>
                                    <Form.Input name='progress' label='Current Estimated Progress (%)' type='number' placeholder="Enter the estimated progress here..." min='0' onChange={this.setProgress.bind(this)} value={this.state.progress} />
                                    <Form.Input name='resourceURL' label='Resource URL' placeholder="Enter the relevant resource URL..." onChange={this.setResourceURL.bind(this)} value={this.state.resourceURL} />
                                    <Form.TextArea label='Description & Notes' placeholder="Describe the project here..." onChange={this.setDescription.bind(this)} value={this.state.description} />
                                    <Button type='submit' color='green' className='button-float-right'>Add Project</Button>
                                </Form>
                            </Segment>
                        </Segment>
                    </Grid.Column>
                </Grid.Row>
                <Modal
                    onClose={this.closeModal.bind(this)}
                    open={this.state.showErrModal}
                >
                    <Modal.Header>Add Existing Project: Error</Modal.Header>
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

export default DevProjectAddExisting;
