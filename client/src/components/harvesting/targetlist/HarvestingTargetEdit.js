import './targetliststyles.css';

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
import {
    libraryOptions,
    typeOptions,
    statusOptions,
    getShelfOptions
} from '../../util/HarvestingMasterOptions.js';

class HarvestingTargetEdit extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
            id: '',
            title: '',
            library: '',
            shelf: '',
            originalURL: '',
            type: '',
            status: '',
            notes: '',
            currentShelfOptions: [],
            disableShelf: false,
            showErrModal: false,
            modalErrMsg: '',
            previous: {
                title: '',
                library: '',
                shelf: '',
                originalURL: '',
                type: '',
                status: '',
                notes: '',
            }
        };
    }

    componentDidMount() {
        document.title = "LibreTexts Conductor | Harvesting | Targetlist | Edit Target";
        //const [user] = this.context;
        this.setState({
            id: this.props.match.params.id
        }, () => {
            this.getTargetInfo();
        });
    }

    setTitle(e) {
        this.setState({ title: e.target.value });
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

    setType(e, { value }) {
        this.setState({ type: value });
    }

    setOURL(e) {
        this.setState({ originalURL: e.target.value });
    }

    setStatus(e, { value }) {
        this.setState({ status: value });
    }

    setNotes(e) {
        this.setState({ notes: e.target.value });
    }

    getTargetInfo() {
        if (this.state.id !== '') {
            axios.get('/harvesting/targetlist/targets/detail', {
                params: {
                    id: this.state.id
                }
            }).then((res) => {
                if (!res.data.err) {
                    if (res.data.target !== null) {
                        const shelfOptionsData = getShelfOptions(res.data.target.library);
                        this.setState({
                            title: res.data.target.title,
                            library: res.data.target.library,
                            shelf: res.data.target.shelf,
                            originalURL: res.data.target.originalURL,
                            type: res.data.target.type,
                            status: res.data.target.status,
                            notes: res.data.target.notes,
                            currentShelfOptions: shelfOptionsData[0],
                            disableShelf: shelfOptionsData[1],
                            previous: {
                                title: res.data.target.title,
                                library: res.data.target.library,
                                shelf: res.data.target.shelf,
                                originalURL: res.data.target.originalURL,
                                type: res.data.target.type,
                                status: res.data.target.status,
                                notes: res.data.target.notes
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
        const newTarget = {
            id: this.state.id,
            title: this.state.title,
            library: this.state.library,
            shelf: this.state.shelf,
            type: this.state.type,
            originalURL: this.state.originalURL,
            status: this.state.status,
            notes: this.state.notes
        };
        var toSend = {
            id: newTarget.id
        };
        if (newTarget.title !== this.state.previous.title) {
            toSend.title = newTarget.title;
        }
        if (newTarget.library !== this.state.previous.library) {
            toSend.library = newTarget.library;
        }
        if (newTarget.shelf !== this.state.previous.shelf) {
            toSend.shelf = newTarget.shelf;
        }
        if (newTarget.type !== this.state.previous.type) {
            toSend.type = newTarget.type;
        }
        if (newTarget.originalURL !== this.state.previous.originalURL) {
            toSend.originalURL = newTarget.originalURL;
        }
        if (newTarget.status !== this.state.previous.status) {
            toSend.status = newTarget.status;
        }
        if (newTarget.notes !== this.state.previous.notes) {
            toSend.notes = newTarget.notes;
        }
        axios.post('/harvesting/targetlist/targets/update', toSend, {
            headers: {
                'Content-Type': 'application/json'
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.id) {
                    this.props.history.push(`/harvesting/targetlist/${res.data.id}?showUpdateSuccess=true`);
                }
            } else {
                this.setState({ showErrModal: true, modalErrMsg: res.data.errMsg });
            }
        }).catch((err) => {
            this.setState({ showErrModal: true, modalErrMsg: err });
        });
    }

    cancelChanges() {
        this.props.history.push(`/harvesting/targetlist/${this.state.id}`);
    }

    closeModal() {
        this.setState({ showErrModal: false, modalErrMsg: '' });
    }

    render() {
        return(
            <Grid className='component-container' divided='vertically'>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Header className='component-header'>Target: <span className='targetlist-detail-titleheader'>{this.state.previous.title}</span></Header>
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Segment>
                            <Link to={`/harvesting/targetlist/${this.state.id}`}>
                                <Button color='blue' basic>
                                    <Button.Content>
                                        <Icon name='arrow left' />
                                        Back to Target Detail
                                    </Button.Content>
                                </Button>
                            </Link>
                            <Divider />
                            <Segment basic className='component-innercontainer'>
                                <Header as='h2' className='formheader'>Edit Textbook Target</Header>
                                <Form onSubmit={this.saveChanges.bind(this)}>
                                    <Form.Input name='title' label='Title' type='text' placeholder="Enter the title..." required onChange={this.setTitle.bind(this)} value={this.state.title}/>
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
                                    <Form.Input label='Original URL' type='text' placeholder="Enter the original resource URL..." onChange={this.setOURL.bind(this)} value={this.state.originalURL}/>
                                    <Form.Group widths='equal'>
                                        <Form.Select
                                            fluid
                                            label='Type'
                                            options={typeOptions}
                                            placeholder='Resource type...'
                                            onChange={this.setType.bind(this)}
                                            value={this.state.type}
                                        />
                                        <Form.Select
                                            fluid
                                            label='Status'
                                            options={statusOptions}
                                            placeholder='Status...'
                                            onChange={this.setStatus.bind(this)}
                                            value={this.state.status}
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
                    <Modal.Header>Edit Target: Error</Modal.Header>
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

export default HarvestingTargetEdit;
