import './AdministrationPortal.css';

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

import { UserContext } from '../../providers.js';

class AdminProjectEdit extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
            id: '',
            title: '',
            progress: 0,
            description: '',
            disableShelf: false,
            showErrModal: false,
            modalErrMsg: '',
            previous: {
                title: '',
                description: ''
            }
        };
    }

    componentDidMount() {
        document.title = "LibreTexts PTS | Administration | Projects | Edit";
        //const [user] = this.context;
        this.setState({ id: this.props.match.params.id }, () => {
            this.getProjectInfo();
        });
    }

    setTitle(e) {
        this.setState({ title: e.target.value });
    }

    setDescription(e) {
        this.setState({ description: e.target.value });
    }

    getProjectInfo() {
        if (this.state.id !== '') {
            axios.get('/admin/projects/detail', {
                params: {
                    id: this.state.id
                }
            }).then((res) => {
                if (!res.data.err) {
                    if (res.data.project !== null) {
                        this.setState({
                            id: res.data.project.projectID,
                            title: res.data.project.title,
                            progress: res.data.project.currentProgress,
                            description: res.data.project.description,
                            previous: {
                                id: res.data.project.id,
                                title: res.data.project.title,
                                description: res.data.project.description
                            }
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

    saveChanges() {
        const newProject = {
            id: this.state.id,
            title: this.state.title,
            description: this.state.description
        };
        var toSend = {
            id: newProject.id
        };
        if (newProject.title !== this.state.previous.title) {
            toSend.title = newProject.title;
        }
        if (newProject.description !== this.state.previous.description) {
            toSend.description = newProject.description;
        }
        axios.post('/admin/projects/update', toSend, {
            headers: {
                'Content-Type': 'application/json'
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.id) {
                    this.props.history.push(`/admin/projects/${res.data.id}?showUpdateSuccess=true`);
                }
            } else {
                this.setState({ showErrModal: true, modalErrMsg: res.data.errMsg });
            }
        }).catch((err) => {
            this.setState({ showErrModal: true, modalErrMsg: err });
        });
    }

    cancelChanges() {
        this.props.history.push(`/admin/projects/${this.state.id}`);
    }

    closeModal() {
        this.setState({ showErrModal: false, modalErrMsg: '' });
    }

    render() {
        return(
            <Grid className='component-container' divided='vertically'>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Header className='component-header'>Project: <span className='project-detail-titleheader'>{this.state.previous.title}</span></Header>
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Segment>
                            <Link to={`/admin/projects/${this.state.id}`}>
                                <Button color='blue' basic>
                                    <Button.Content>
                                        <Icon name='arrow left' />
                                        Back to Project Detail
                                    </Button.Content>
                                </Button>
                            </Link>
                            <Divider />
                            <Segment basic className='component-innercontainer'>
                                <Header as='h2' className='formheader'>Edit Project</Header>
                                <Form onSubmit={this.saveChanges.bind(this)}>
                                    <Form.Input name='title' label='Title' type='text' placeholder="Enter the title..." required onChange={this.setTitle.bind(this)} value={this.state.title}/>
                                    <Form.Input name='progress' label='Current Progress' type='number' placeholder="Enter the current progress..." value={this.state.progress} disabled />
                                    <Form.TextArea label='Description & Notes' placeholder="Describe the project here..." onChange={this.setDescription.bind(this)} value={this.state.description} />
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
                    <Modal.Header>Edit Project: Error</Modal.Header>
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

export default AdminProjectEdit;
