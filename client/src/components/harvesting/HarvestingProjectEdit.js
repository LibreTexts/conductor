import './HarvestingPortal.css';

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

import {
    libraryOptions,
    getShelfOptions
} from '../util/HarvestingMasterOptions.js';

class HarvestingProjectEdit extends Component {

    constructor(props) {
        super(props);
        this.state = {
            id: '',
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
            modalErrMsg: '',
            previous: {
                title: '',
                chapters: 0,
                textbookURL: '',
                libreURL: '',
                library: '',
                shelf: '',
                notes: ''
            }
        };
    }

    componentDidMount() {
        document.title = "LibreTexts Conductor | Harvesting | Projects | Edit";
        this.setState({ id: this.props.match.params.id }, () => {
            this.getProjectInfo();
        });
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
        if (value !== this.state.library) {
            const shelfOptionsData = getShelfOptions(value);
            this.setState({
                library: value,
                shelf: '',
                currentShelfOptions: shelfOptionsData[0],
                disableShelf: shelfOptionsData[1]
            });
        }
    }

    setShelf(e, { value }) {
        this.setState({ shelf: value });
    }

    setNotes(e) {
        this.setState({ notes: e.target.value });
    }

    getProjectInfo() {
        if (this.state.id !== '') {
            axios.get('/harvesting/projects/detail', {
                params: {
                    id: this.state.id
                }
            }).then((res) => {
                if (!res.data.err) {
                    if (res.data.project !== null) {
                        const shelfOptionsData = getShelfOptions(res.data.project.library);
                        this.setState({
                            id: res.data.project.projectID,
                            title: res.data.project.title,
                            chapters: res.data.project.chapters,
                            textbookURL: res.data.project.textbookURL,
                            libreURL: res.data.project.libreURL,
                            library: res.data.project.library,
                            shelf: res.data.project.shelf,
                            notes: res.data.project.notes,
                            currentShelfOptions: shelfOptionsData[0],
                            disableShelf: shelfOptionsData[1],
                            previous: {
                                id: res.data.project.id,
                                title: res.data.project.title,
                                chapters: res.data.project.chapters,
                                textbookURL: res.data.project.textbookURL,
                                libreURL: res.data.project.libreURL,
                                library: res.data.project.library,
                                shelf: res.data.project.shelf,
                                notes: res.data.project.notes
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
            chapters: this.state.chapters,
            textbookURL: this.state.textbookURL,
            libreURL: this.state.libreURL,
            library: this.state.library,
            shelf: this.state.shelf,
            notes: this.state.notes
        };
        var toSend = {
            id: newProject.id
        };

        if (newProject.title !== this.state.previous.title) {
            toSend.title = newProject.title;
        }
        if (newProject.chapters !== this.state.previous.chapters) {
            toSend.chapters = newProject.chapters;
        }
        if (newProject.textbookURL !== this.state.previous.textbookURL) {
            toSend.textbookURL = newProject.textbookURL;
        }
        if (newProject.libreURL !== this.state.previous.libreURL) {
            toSend.libreURL = newProject.libreURL;
        }
        if (newProject.library !== this.state.previous.library) {
            toSend.library = newProject.library;
        }
        if (newProject.shelf !== this.state.previous.shelf) {
            toSend.shelf = newProject.shelf;
        }
        if (newProject.notes !== this.state.previous.notes) {
            toSend.notes = newProject.notes;
        }
        axios.post('/harvesting/projects/update', toSend, {
            headers: {
                'Content-Type': 'application/json'
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.id) {
                    this.props.history.push(`/harvesting/projects/${res.data.id}?showUpdateSuccess=true`);
                }
            } else {
                this.setState({ showErrModal: true, modalErrMsg: res.data.errMsg });
            }
        }).catch((err) => {
            this.setState({ showErrModal: true, modalErrMsg: err });
        });
    }

    cancelChanges() {
        this.props.history.push(`/harvesting/projects/${this.state.id}`);
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
                            <Link to={`/harvesting/projects/${this.state.id}`}>
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
                                    <Form.Input name='chapters' label='Number of Chapters' type='number' placeholder="Enter number of chapters..." onChange={this.setChapters.bind(this)} value={this.state.chapters} />
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

export default HarvestingProjectEdit;
