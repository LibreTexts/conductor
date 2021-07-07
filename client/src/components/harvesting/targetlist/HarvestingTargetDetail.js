import '../HarvestingPortal.css';

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
import {
    libraryOptions,
    allShelfMap,
    getShelfOptions
} from '../../util/HarvestingMasterOptions.js';

class HarvestingTargetDetail extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
            id: '',
            isAdmin: false,
            title: '',
            library: '',
            shelf: '',
            originalURL: '',
            type: '',
            status: '',
            notes: '',
            libraryDisplay: '',
            shelfDisplay: '',
            typeDisplay: '',
            currentShelfOptions: [],
            disableShelf: false,
            showCreateSuccess: false,
            showUpdateSuccess: false,
            showDeleteModal: false,
            showNewProjectModal: false,
            showAssigneeProjectModal: false,
            assigneeOptions: [],
            loadingAssignees: false,
            NPTitle: '',
            NPChapters: 0,
            NPTextbookURL: '',
            NPLibreURL: '',
            NPLibrary: '',
            NPShelf: '',
            NPNotes: '',
            NPAssignee: ''
        };
    }

    componentDidMount() {
        document.title = "LibreTexts PTS | Harvesting | Targetlist | Detail";
        const [user] = this.context;
        var isAdmin = false;
        if (user.roles.includes('admin')) {
            isAdmin = true;
        }
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
            showUpdateSuccess: setUpdateSuccess,
            isAdmin: isAdmin
        }, () => {
            this.getTargetDetail();
        });
    }

    getTargetDetail() {
        if (this.state.id !== '') {
            axios.get('/harvesting/targetlist/targets/detail', {
                params: {
                    id: this.state.id
                }
            }).then((res) => {
                if (!res.data.err) {
                    if (res.data.target !== null) {
                        this.setState({
                            title: res.data.target.title,
                            library: res.data.target.library,
                            shelf: res.data.target.shelf,
                            originalURL: res.data.target.originalURL,
                            type: res.data.target.type,
                            status: res.data.target.status,
                            notes: res.data.target.notes
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

    getAssignees() {
        const [user] = this.context;
        axios.get('/user/getharvesters').then((res) => {
            if (!res.data.err) {
                if (res.data.harvesters !== undefined) {
                    var harvestList = [{
                        key: 'empty',
                        text: 'Clear...',
                        value: ''
                    }];
                    res.data.harvesters.forEach((item, index) => {
                        if (item.lastName !== user.lastName) {
                            harvestList.push({
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
                        assigneeOptions: harvestList,
                        loadingAssignees: false
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

    openDeleteModal() {
        this.setState({ showDeleteModal: true });
    }

    closeDeleteModal() {
        this.setState({ showDeleteModal: false });
    }

    openNewProjectModal() {
        const shelfOptionsData = getShelfOptions(this.state.library);
        this.setState({
            NPTitle: this.state.title,
            NPTextbookURL: this.state.originalURL,
            NPLibrary: this.state.library,
            NPShelf: this.state.shelf,
            NPNotes: this.state.notes,
            currentShelfOptions: shelfOptionsData[0],
            disableShelf: shelfOptionsData[1],
            showNewProjectModal: true
        });
    }

    closeNewProjectModal() {
        this.setState({
            showNewProjectModal: false,
            NPTitle: '',
            NPChapters: 0,
            NPTextbookURL: '',
            NPLibreURL: '',
            NPLibrary: '',
            NPShelf: '',
            NPNotes: ''
        });
    }

    openAssigneeProjectModal() {
        const shelfOptionsData = getShelfOptions(this.state.library);
        this.setState({
            NPTitle: this.state.title,
            NPTextbookURL: this.state.originalURL,
            NPLibrary: this.state.library,
            NPShelf: this.state.shelf,
            NPNotes: this.state.notes,
            currentShelfOptions: shelfOptionsData[0],
            disableShelf: shelfOptionsData[1],
            showAssigneeProjectModal: true,
            loadingAssignees: true
        }, () => {
            this.getAssignees();
        });
    }

    closeAssigneeProjectModal() {
        this.setState({
            showAssigneeProjectModal: false,
            NPTitle: '',
            NPChapters: 0,
            NPTextbookURL: '',
            NPLibreURL: '',
            NPLibrary: '',
            NPShelf: '',
            NPNotes: '',
            NPAssignee: ''
        });
    }

    editTarget() {
        this.props.history.push(`/harvesting/targetlist/${this.state.id}/edit`);
    }

    deleteTarget() {
        const toDelete = {
            id: this.state.id
        };
        axios.post('/harvesting/targetlist/targets/delete', toDelete, {
            headers: {
                'Content-Type': 'application/json'
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.deletedTarget) {
                    this.props.history.push('/harvesting/targetlist?showDeleteSuccess=true');
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

    setNPTitle(e) {
        this.setState({ NPTitle: e.target.value });
    }

    setNPChapters(e) {
        this.setState({ NPChapters: e.target.value });
    }

    setNPTextbookURL(e) {
        this.setState({ NPTextbookURL: e.target.value });
    }

    setNPLibreURL(e) {
        this.setState({ NPLibreURL: e.target.value });
    }

    setNPLibrary(e, { value }) {
        let shelfOptionsData = getShelfOptions(value);
        this.setState({
            NPLibrary: value,
            NPShelf: '',
            currentShelfOptions: shelfOptionsData[0],
            disableShelf: shelfOptionsData[1],
        });
    }

    setNPShelf(e, { value }) {
        this.setState({ NPShelf: value });
    }

    setNPAssignee(e, { value }) {
        this.setState({ NPAssignee: value });
    }

    setNPNotes(e) {
        this.setState({ NPNotes: e.target.value });
    }

    createNewProject() {
        const newProject = {
            textbookTargetID: this.state.id,
            title: this.state.NPTitle,
            chapters: this.state.NPChapters,
            textbookURL: this.state.NPTextbookURL,
            libreURL: this.state.NPLibreURL,
            library: this.state.NPLibrary,
            shelf: this.state.NPShelf,
            notes: this.state.NPNotes
        };
        axios.post('/harvesting/projects/newfromtarget', newProject, {
            headers: {
                'Content-Type': 'application/json'
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.id !== null) {
                    this.props.history.push(`/harvesting/projects/${res.data.id}?showCreateSuccess=true`);
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

    createAssigneeProject() {
        if (this.state.NPAssignee !== '') {
            const newProject = {
                textbookTargetID: this.state.id,
                title: this.state.NPTitle,
                chapters: this.state.NPChapters,
                textbookURL: this.state.NPTextbookURL,
                libreURL: this.state.NPLibreURL,
                library: this.state.NPLibrary,
                shelf: this.state.NPShelf,
                notes: this.state.NPNotes,
                assignee: this.state.NPAssignee
            };
            axios.post('/harvesting/projects/newforassignee', newProject, {
                headers: {
                    'Content-Type': 'application/json'
                }
            }).then((res) => {
                if (!res.data.err) {
                    if (res.data.id !== null) {
                        this.props.history.push(`/harvesting/projects/${res.data.id}?showCreateFASuccess=true`);
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
        } else {
            alert("Please fill out the missing fields.");
        }
    }

    render() {
        var libraryDisplay = '';
        var shelfDisplay = '';
        var typeDisplay = '';
        var statusDisplay = '';
        libraryOptions.forEach((lib) => {
            if (lib.value === this.state.library) {
                libraryDisplay = lib.text;
            }
        });
        const mappedShelf = allShelfMap.get(this.state.shelf);
        if (mappedShelf !== undefined) {
            shelfDisplay = mappedShelf;
        }
        if (this.state.type === 'pdf') {
            typeDisplay = 'PDF';
        } else if (this.state.type === 'eBook') {
            typeDisplay = 'External eBook';
        } else if (this.state.type === 'hardcopy') {
            typeDisplay = 'Hardcopy';
        } else if (this.state.type === 'EPUB') {
            typeDisplay = 'EPUB';
        }
        if (this.state.status === 'ready') {
            statusDisplay = 'Ready';
        } else if (this.state.status === 'wait') {
            statusDisplay = 'Waiting for permission';
        } else if (this.state.status === 'review') {
            statusDisplay = 'Needs further review';
        }
        return(
            <Grid className='component-container' divided='vertically'>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Header className='component-header'>Target: <span className='targetlist-detail-titleheader'>{this.state.title}</span></Header>
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Segment>
                            <Container fluid>
                                <Link to='/harvesting/targetlist'>
                                    <Button color='blue' basic>
                                        <Button.Content>
                                            <Icon name='arrow left' />
                                            Back to Targetlist
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
                                        <Message.Header>Textbook target successfully created!</Message.Header>
                                    </Message>
                                }
                                {this.state.showUpdateSuccess &&
                                    <Message floating positive icon>
                                        <Icon name='check square' />
                                        <Message.Header>Textbook target successfully updated!</Message.Header>
                                    </Message>
                                }
                                <Container fluid>
                                    <Button color='blue' floated='right' onClick={this.editTarget.bind(this)}>
                                        <Icon name='edit' />
                                        Edit Target
                                    </Button>
                                    {this.state.isAdmin &&
                                        <Button color='red' floated='right' onClick={this.openDeleteModal.bind(this)}>
                                            <Icon name='trash' />
                                            Delete Target
                                        </Button>
                                    }
                                    <Grid className='clear-grid'>
                                        <Grid.Row columns={1}>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Title</Header>
                                                <span className='targetlist-detail-text'>{this.state.title}</span>
                                            </Grid.Column>
                                        </Grid.Row>
                                        <Grid.Row columns={2}>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Library</Header>
                                                {libraryDisplay === '' ?
                                                    <span className='gray-span'><em>Unspecified</em></span>
                                                    :
                                                    <span className='targetlist-detail-text'>{libraryDisplay}</span>
                                                }
                                            </Grid.Column>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Shelf</Header>
                                                {shelfDisplay === '' ?
                                                    <span className='gray-span'><em>Unspecified</em></span>
                                                    :
                                                    <span className='targetlist-detail-text'>{shelfDisplay}</span>
                                                }
                                            </Grid.Column>
                                        </Grid.Row>
                                        <Grid.Row columns={1}>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Original URL</Header>
                                                {this.state.originalURL === '' ?
                                                    <span className='gray-span'><em>Unspecified</em></span>
                                                    :
                                                    <a href={String(this.state.originalURL).includes('http') ?
                                                        this.state.originalURL :
                                                        `https://${this.state.originalURL}`
                                                    } target='_blank' className='targetlist-detail-text' rel='noreferrer'>{this.state.originalURL}</a>
                                                }
                                            </Grid.Column>
                                        </Grid.Row>
                                        <Grid.Row columns={2}>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Type</Header>
                                                {typeDisplay === '' ?
                                                    <span className='gray-span'><em>Unspecified</em></span>
                                                    :
                                                    <span className='targetlist-detail-text'>{typeDisplay}</span>
                                                }
                                            </Grid.Column>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Status</Header>
                                                {statusDisplay === '' ?
                                                    <span className='gray-span'><em>Unspecified</em></span>
                                                    :
                                                    <span className='targetlist-detail-text'>{statusDisplay}</span>
                                                }
                                            </Grid.Column>
                                        </Grid.Row>
                                        <Grid.Row columns={1}>
                                            <Grid.Column>
                                                <Header size='medium' dividing>Notes</Header>
                                                {this.state.notes === '' ?
                                                    <span className='gray-span'><em>Unspecified</em></span>
                                                    :
                                                    <span className='targetlist-detail-text multiline-display'>{this.state.notes}</span>
                                                }
                                            </Grid.Column>
                                        </Grid.Row>
                                    </Grid>
                                    <Segment basic>
                                        <Button color='green' fluid onClick={this.openNewProjectModal.bind(this)}>
                                            <Icon name='crosshairs' />
                                            Start New Project
                                        </Button>
                                        {this.state.isAdmin &&
                                            <Button color='olive' fluid onClick={this.openAssigneeProjectModal.bind(this)} className='targetlist-projectassignee-btn'>
                                                <Icon name='user plus' />
                                                Start New Project for Assignee
                                            </Button>
                                        }
                                    </Segment>
                                </Container>
                            </Segment>
                        </Segment>
                    </Grid.Column>
                </Grid.Row>
                {/* New Project From Target Modal */}
                <Modal
                    onClose={this.closeNewProjectModal.bind(this)}
                    open={this.state.showNewProjectModal}
                >
                    <Modal.Header>New Project from Target</Modal.Header>
                    <Modal.Content>
                        <Form>
                            <Form.Input name='title' label='Title' type='text' placeholder="Enter the title..." required onChange={this.setNPTitle.bind(this)} value={this.state.NPTitle}/>
                            <Form.Input name='chapters' label='Number of Chapters' type='number' placeholder="Enter number of chapters..." min='0' onChange={this.setNPChapters.bind(this)} value={this.state.NPChapters} />
                            <Form.Input name='textbookURL' label='Original Textbook URL' placeholder="Enter the original resouce URL..." onChange={this.setNPTextbookURL.bind(this)} value={this.state.NPTextbookURL} />
                            <Form.Input name='libreURL' label='LibreTexts URL' placeholder="Enter the project's LibreTexts URL..." onChange={this.setNPLibreURL.bind(this)} value={this.state.NPLibreURL} />
                            <Form.Group widths='equal'>
                                <Form.Select
                                    fluid
                                    label='Library'
                                    options={libraryOptions}
                                    placeholder='Library...'
                                    onChange={this.setNPLibrary.bind(this)}
                                    value={this.state.NPLibrary}
                                />
                                <Form.Select
                                    fluid
                                    label='Shelf'
                                    options={this.state.currentShelfOptions}
                                    placeholder='Shelf...'
                                    disabled={this.state.disableShelf}
                                    onChange={this.setNPShelf.bind(this)}
                                    value={this.state.NPShelf}
                                />
                            </Form.Group>
                            <Form.TextArea label='Notes' placeholder="Enter any notes here..." onChange={this.setNPNotes.bind(this)} value={this.state.NPNotes} />
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
                {/* New Assignee Project Modal */}
                <Modal
                    onClose={this.closeAssigneeProjectModal.bind(this)}
                    open={this.state.showAssigneeProjectModal}
                >
                    <Modal.Header>New Project from Target (for Assignee)</Modal.Header>
                    <Modal.Content>
                        <Form>
                            <Form.Input name='title' label='Title' type='text' placeholder="Enter the title..." required onChange={this.setNPTitle.bind(this)} value={this.state.NPTitle}/>
                            <Form.Input name='chapters' label='Number of Chapters' type='number' placeholder="Enter number of chapters..." min='0' onChange={this.setNPChapters.bind(this)} value={this.state.NPChapters} />
                            <Form.Input name='textbookURL' label='Original Textbook URL' placeholder="Enter the original resouce URL..." onChange={this.setNPTextbookURL.bind(this)} value={this.state.NPTextbookURL} />
                            <Form.Input name='libreURL' label='LibreTexts URL' placeholder="Enter the project's LibreTexts URL..." onChange={this.setNPLibreURL.bind(this)} value={this.state.NPLibreURL} />
                            <Form.Group widths='equal'>
                                <Form.Select
                                    fluid
                                    label='Library'
                                    options={libraryOptions}
                                    placeholder='Library...'
                                    onChange={this.setNPLibrary.bind(this)}
                                    value={this.state.NPLibrary}
                                />
                                <Form.Select
                                    fluid
                                    label='Shelf'
                                    options={this.state.currentShelfOptions}
                                    placeholder='Shelf...'
                                    disabled={this.state.disableShelf}
                                    onChange={this.setNPShelf.bind(this)}
                                    value={this.state.NPShelf}
                                />
                            </Form.Group>
                            <Form.TextArea label='Notes' placeholder="Enter any notes here..." onChange={this.setNPNotes.bind(this)} value={this.state.NPNotes} />
                            <Form.Select
                                fluid
                                label='Assignee'
                                options={this.state.assigneeOptions}
                                placeholder='Choose Assignee...'
                                onChange={this.setNPAssignee.bind(this)}
                                value={this.state.NPAssignee}
                                loading={this.state.loadingAssignees}
                                required
                            />
                        </Form>
                    </Modal.Content>
                    <Modal.Actions>
                        <Button onClick={this.closeAssigneeProjectModal.bind(this)}>Cancel</Button>
                        <Button color='green' onClick={this.createAssigneeProject.bind(this)}>
                            <Icon name='add' />
                            Create Project for Assignee
                        </Button>
                    </Modal.Actions>
                </Modal>
                {/* Confirm Target Deletion Modal */}
                <Modal
                    onClose={this.closeDeleteModal.bind(this)}
                    open={this.state.showDeleteModal}
                >
                    <Modal.Header>Confirm Target Deletion</Modal.Header>
                    <Modal.Content>
                        <Message icon negative>
                            <Icon name='warning sign' />
                            <Message.Content>
                                <Message.Header>Are you sure you want to delete the target <em>{this.state.title}</em>?</Message.Header>
                                <p>This can not be undone.</p>
                            </Message.Content>
                        </Message>
                    </Modal.Content>
                    <Modal.Actions>
                        <Button onClick={this.closeDeleteModal.bind(this)}>Cancel</Button>
                        <Button negative onClick={this.deleteTarget.bind(this)}>
                            <Icon name='trash' />
                            Confirm Deletion
                        </Button>
                    </Modal.Actions>
                </Modal>
            </Grid>
        );
    }
}

export default HarvestingTargetDetail;
