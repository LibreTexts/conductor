import './HarvestingPortal.css';

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
import {
    libraryOptions,
    getShelfOptions
} from '../util/HarvestingMasterOptions.js';

class HarvestingProjectAddExisting extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
            title: '',
            chapters: 0,
            textbookURL: '',
            libreURL: '',
            library: '',
            shelf: '',
            notes: '',
            currentShelfOptions: [],
            disableShelf: false,
            showErrModal: false,
            modalErrMsg: ''
        };
    }

    componentDidMount() {
        document.title = "LibreTexts Conductor | Harvesting | Add Existing Project";
        //const [user] = this.context;
    }

    setTitle(e) {
        this.setState({ title: e.target.value });
    }

    setChapters(e) {
        this.setState({ chapters: e.target.value });
    }

    setTextbookURL(e) {
        this.setState({ textbookURL: e.target.value });
    }

    setLibreURL(e) {
        this.setState({ libreURL: e.target.value });
    }

    setLibrary(e, { value }) {
        const shelfOptionsData = getShelfOptions(value);
        this.setState({
            library: value,
            shelf: '',
            currentShelfOptions: shelfOptionsData[0],
            disableShelf: shelfOptionsData[1]
        });
    }

    setShelf(e, { value }) {
        this.setState({ shelf: value });
    }

    setNotes(e) {
        this.setState({ notes: e.target.value });
    }

    submitProjectForm() {
        const newProject = {
            title: this.state.title,
            chapters: this.state.chapters,
            textbookURL: this.state.textbookURL,
            libreURL: this.state.libreURL,
            library: this.state.library,
            shelf: this.state.shelf,
            notes: this.state.notes
        };
        axios.post('/harvesting/projects/addexisting', newProject, {
            headers: {
                'Content-Type': 'application/json'
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.id !== null) {
                    this.props.history.push(`/harvesting/projects/${res.data.id}?showCreateSuccess=true`);
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
                        <Header className='component-header'>Harvesting</Header>
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Segment>
                            <Link to='/harvesting'>
                                <Button color='blue' basic>
                                    <Button.Content>
                                        <Icon name='arrow left' />
                                        Back to Harvesting
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
                                        <p>Use this form to add an existing project that is not listed in the Textbook Targetlist. Otherwise, visit the <Link to='/harvesting/targetlist'>Textbook Targetlist</Link> to select a target and start a new project.</p>
                                    </Message.Content>
                                </Message>
                                <Form onSubmit={this.submitProjectForm.bind(this)}>
                                    <Form.Input name='title' label='Title' type='text' placeholder="Enter the title..." required onChange={this.setTitle.bind(this)} value={this.state.title}/>
                                    <Form.Input name='chapters' label='Number of Chapters' type='number' placeholder="Enter number of chapters..." min='0' onChange={this.setChapters.bind(this)} value={this.state.chapters} />
                                    <Form.Input name='textbookURL' label='Original Textbook URL' placeholder="Enter the original resouce URL..." onChange={this.setTextbookURL.bind(this)} value={this.state.textbookURL} />
                                    <Form.Input name='libreURL' label='LibreTexts URL' placeholder="Enter the project's LibreTexts URL..." onChange={this.setLibreURL.bind(this)} value={this.state.libreURL} />
                                    <Form.Group widths='equal'>
                                        <Form.Select
                                            fluid
                                            label='Library'
                                            options={libraryOptions}
                                            placeholder='Library...'
                                            onChange={this.setLibrary.bind(this)}
                                            value={this.state.library}
                                        />
                                        <Form.Select
                                            fluid
                                            label='Shelf'
                                            options={this.state.currentShelfOptions}
                                            placeholder='Shelf...'
                                            disabled={this.state.disableShelf}
                                            onChange={this.setShelf.bind(this)}
                                            value={this.state.shelf}
                                        />
                                    </Form.Group>
                                    <Form.TextArea label='Notes' placeholder="Enter any notes here..." onChange={this.setNotes.bind(this)} value={this.state.notes} />
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

export default HarvestingProjectAddExisting;
