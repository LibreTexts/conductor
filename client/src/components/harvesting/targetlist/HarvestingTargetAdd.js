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

class HarvestingTargetAdd extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
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
            modalErrMsg: ''
        };
    }

    componentDidMount() {
        document.title = "LibreTexts PTS | Harvesting | Targetlist | Add Target";
        //const [user] = this.context;
    }

    setTitle(e) {
        this.setState({ title: e.target.value });
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

    submitTargetForm() {
        const newTarget = {
            title: this.state.title,
            library: this.state.library,
            shelf: this.state.shelf,
            type: this.state.type,
            originalURL: this.state.originalURL,
            status: this.state.status,
            notes: this.state.notes
        };
        axios.post('/harvesting/targetlist/add', newTarget, {
            headers: {
                'Content-Type': 'application/json'
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.id !== null) {
                    this.props.history.push(`/harvesting/targetlist/${res.data.id}?showCreateSuccess=true`);
                } else {
                    this.setState({ showErrModal: true, modalErrMsg: "Oops! We encountered an error creating the target." });
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
                        <Header className='component-header'>Textbook Targetlist</Header>
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Segment>
                            <Link to='/harvesting/targetlist'>
                                <Button color='blue' basic>
                                    <Button.Content>
                                        <Icon name='arrow left' />
                                        Back to Targetlist
                                    </Button.Content>
                                </Button>
                            </Link>
                            <Divider />
                            <Segment basic className='component-innercontainer'>
                                <Header as='h2' className='formheader'>Add a Textbook Target</Header>
                                <Form onSubmit={this.submitTargetForm.bind(this)}>
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
                                    <Button type='submit' color='green' className='button-float-right'>Add Target</Button>
                                </Form>
                            </Segment>
                        </Segment>
                    </Grid.Column>
                </Grid.Row>
                <Modal
                    onClose={this.closeModal.bind(this)}
                    open={this.state.showErrModal}
                >
                    <Modal.Header>Add Target: Error</Modal.Header>
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

export default HarvestingTargetAdd;
