import './DevelopmentPortal.css';

import {
  Grid,
  Header,
  Menu,
  Input,
  Segment,
  Divider,
  Message,
  Icon,
  Button,
  Table,
  Loader
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import React, { Component } from 'react';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import queryString from 'query-string';

import { UserContext } from '../../providers.js';


class DevelopmentPortal extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
            rawProjects: [],
            sortedProjects: [],
            flaggedProjects: [],
            completedProjects: [],
            currentSortString: '',
            showProjectDeleteSuccess: false,
            showTextPlacedBack: false,
            loadedCurrentProjects: false,
            loadedFlaggedProjects: false,
            loadedCompletedProjects: false
        };
    }

    componentDidMount() {
        document.title = "LibreTexts PTS | Development";
        //const [user] = this.context;
        const queryValues = queryString.parse(this.props.location.search);
        const projectDeleteSuccess = decodeURIComponent(queryValues.showProjectDeleteSuccess);
        var setProjectDeleteSuccess = false;
        if (projectDeleteSuccess === "true") {
            setProjectDeleteSuccess = true;
        }
        date.plugin(ordinal);
        this.setState({
            showProjectDeleteSuccess: setProjectDeleteSuccess
        }, () => {
            this.getCurrentProjects();
        });
    }

    getCurrentProjects() {
        axios.get('/development/projects/current').then((res) => {
            if (!res.data.err) {
                if (res.data.projects != null) {
                    this.setState({
                        rawProjects: res.data.projects,
                        sortedProjects: res.data.projects,
                        loadedCurrentProjects: true,
                        currentSortString: ''
                    });
                }
            } else {
                alert("Oops! We encountered an error.");
                console.log(res.data.errMsg);
            }
            this.getFlaggedProjects();
        }).catch((err) => {
            alert("Oops! We encountered an error.");
            console.log(err);
        });
    }

    getFlaggedProjects() {
        axios.get('/development/projects/flagged').then((res) => {
            if (!res.data.err) {
                if (res.data.projects != null) {
                    this.setState({
                        flaggedProjects: res.data.projects,
                        loadedFlaggedProjects: true
                    });
                }
            } else {
                alert("Oops! We encountered an error.");
                console.log(res.data.errMsg);
            }
            this.getRecentlyCompletedProjects();
        }).catch((err) => {
            alert("Oops! We encountered an error.");
            console.log(err);
        });
    }

    getRecentlyCompletedProjects() {
        axios.get('/development/projects/recentlycompleted').then((res) => {
            if (!res.data.err) {
                if (res.data.projects != null) {
                    this.setState({
                        completedProjects: res.data.projects,
                        loadedCompletedProjects: true
                    });
                }
            } else {
                alert("Oops! We encountered an error.");
                console.log(res.data.errMsg);
            }
        }).catch((err) => {
            alert("Oops! We encountered an error.");
            console.log(err);
        });
    }

    setSortString(e) {
        const rawProjects = this.state.rawProjects;
        var toSet = {
            currentSortString: e.target.value
        };
        if (e.target.value !== '') {
            let sorted = rawProjects.filter((target) => {
                return String(target.title).toLowerCase().indexOf(String(e.target.value).toLowerCase()) >= 0;
            });
            toSet.sortedProjects = sorted;
        } else {
            toSet.sortedProjects = rawProjects;
        }
        this.setState(toSet);
    }

    render() {
        let CurrentDisplay;
        if (this.state.loadedCurrentProjects === true) {
            if (this.state.rawProjects.length > 0) {
                CurrentDisplay = (
                    <Table celled>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell width={4}><Header sub>Title</Header></Table.HeaderCell>
                                <Table.HeaderCell width={2}><Header sub>Current Progress (%)</Header></Table.HeaderCell>
                                <Table.HeaderCell width={2}><Header sub>Status</Header></Table.HeaderCell>
                                <Table.HeaderCell width={3}><Header sub>Last Updated At</Header></Table.HeaderCell>
                                <Table.HeaderCell width={1}></Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {this.state.sortedProjects.map((item, index) => {
                                if (item.status === 'ready') {
                                    item.status = 'Ready';
                                } else if (item.status === 'ip') {
                                    item.status = 'In Progress';
                                }
                                const itemDate = new Date(item.lastUpdate.createdAt);
                                item.updatedDate = date.format(itemDate, 'MMM DDD, YYYY');
                                item.updatedTime = date.format(itemDate, 'h:mm A');
                                return (
                                    <Table.Row key={index}>
                                        <Table.Cell>
                                            <p><strong><Link to={`/development/projects/${item.projectID}`} className='dproject-table-link'>{item.title}</Link></strong></p>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <p>{item.currentProgress}%</p>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <p>{item.status}</p>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <p>{item.updatedDate} at {item.updatedTime}</p>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Link to={`/development/projects/${item.projectID}`}>
                                                <Button color='blue' fluid>
                                                    <Button.Content>
                                                        <Icon name='folder open outline' />
                                                    </Button.Content>
                                                </Button>
                                            </Link>
                                        </Table.Cell>
                                    </Table.Row>
                                )
                            })}
                        </Table.Body>
                    </Table>
                )
            } else {
                CurrentDisplay = <Message><p>You have no projects open right now.</p></Message>
            }
        } else {
            CurrentDisplay = <Loader active inline='centered' />
        }
        let FlaggedDisplay;
        let CompletedDisplay;
        if (this.state.loadedFlaggedProjects === true) {
            if (this.state.flaggedProjects.length > 0) {
                FlaggedDisplay = (
                    <Table celled>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell width={5}><Header sub>Title</Header></Table.HeaderCell>
                                <Table.HeaderCell width={4}><Header sub>Current Progress (%)</Header></Table.HeaderCell>
                                <Table.HeaderCell width={5}><Header sub>Last Updated At</Header></Table.HeaderCell>
                                <Table.HeaderCell width={1}></Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {this.state.flaggedProjects.map((item, index) => {
                                const itemDate = new Date(item.lastUpdate.createdAt);
                                item.updatedDate = date.format(itemDate, 'MMM DDD, YYYY');
                                item.updatedTime = date.format(itemDate, 'h:mm A');
                                return (
                                    <Table.Row key={index}>
                                        <Table.Cell>
                                            <p><strong><Link to={`/development/projects/${item.projectID}`} className='dproject-table-link'>{item.title}</Link></strong></p>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <p>{item.currentProgress}%</p>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <p>{item.updatedDate} at {item.updatedTime}</p>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Link to={`/development/projects/${item.projectID}`}>
                                                <Button color='blue' fluid>
                                                    <Button.Content>
                                                        <Icon name='folder open outline' />
                                                    </Button.Content>
                                                </Button>
                                            </Link>
                                        </Table.Cell>
                                    </Table.Row>
                                )
                            })}
                        </Table.Body>
                    </Table>
                )
            } else {
                FlaggedDisplay = <Message><p>You have no flagged projects right now.</p></Message>
            }
        } else {
            FlaggedDisplay = <Loader active inline='centered' />
        }
        if (this.state.loadedCompletedProjects === true) {
            if (this.state.completedProjects.length > 0) {
                CompletedDisplay = (
                    <Table celled>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell width={10}><Header sub>Title</Header></Table.HeaderCell>
                                <Table.HeaderCell width={4}><Header sub>Last Updated At</Header></Table.HeaderCell>
                                <Table.HeaderCell width={1}></Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {this.state.completedProjects.map((item, index) => {
                                const itemDate = new Date(item.lastUpdate.createdAt);
                                item.updatedDate = date.format(itemDate, 'MMM DDD, YYYY');
                                item.updatedTime = date.format(itemDate, 'h:mm A');
                                return (
                                    <Table.Row key={index}>
                                        <Table.Cell>
                                            <p><strong><Link to={`/development/projects/${item.projectID}`} className='dproject-table-link'>{item.title}</Link></strong></p>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <p>{item.updatedDate} at {item.updatedTime}</p>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Link to={`/development/projects/${item.projectID}`}>
                                                <Button color='blue' fluid>
                                                    <Button.Content>
                                                        <Icon name='folder open outline' />
                                                    </Button.Content>
                                                </Button>
                                            </Link>
                                        </Table.Cell>
                                    </Table.Row>
                                )
                            })}
                        </Table.Body>
                    </Table>
                )
            } else {
                CompletedDisplay = <Message><p>You have no completed projects right now.</p></Message>
            }
        } else {
            CompletedDisplay = <Loader active inline='centered' />
        }
        return(
            <Grid className='component-container' divided='vertically'>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Header className='component-header'>Development</Header>
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Menu widths={3}>
                            <Menu.Item as={Link} to='/development/taskqueue' name='taskqueue' icon='tasks' content={<p>Task Queue</p>} />
                            <Menu.Item as={Link} to='/development/projects/completed' name='completed' icon='check' content={<p>View All Completed Projects</p>} />
                            <Menu.Item as={Link} to='/development/aiofeed' name='aio' icon='feed' content={<p>AIO Feed</p>} />
                        </Menu>
                        <Segment>
                            <h3>Current Development Projects</h3>
                            <Divider />
                            <Segment basic className='component-innercontainer'>
                                {this.state.showProjectDeleteSuccess &&
                                    <Segment basic>
                                        <Message floating icon info>
                                            <Icon name='delete' />
                                            <Message.Content>
                                                <Message.Header>Project successfully deleted.</Message.Header>
                                                <p>If the task is still viable, make sure to re-add it to the <Link to='/development/taskqueue'>Task Queue</Link>.</p>
                                            </Message.Content>
                                        </Message>
                                    </Segment>
                                }
                                <Input
                                    icon='search'
                                    placeholder='Search current projects...'
                                    onChange={this.setSortString.bind(this)}
                                    value={this.state.currentSortString}
                                />
                                <Link to='/development/taskqueue?showNewProjectFlow=true'>
                                    <Button floated='right' color='green'>
                                        <Button.Content>
                                            <Icon name='crosshairs' />
                                            New Project
                                        </Button.Content>
                                    </Button>
                                </Link>
                                <Link to='/development/projects/addexisting'>
                                    <Button floated='right' color='green' basic>
                                        <Button.Content>
                                            <Icon name='add' />
                                            Add Existing Project
                                        </Button.Content>
                                    </Button>
                                </Link>
                                <Divider />
                                {CurrentDisplay}
                            </Segment>
                        </Segment>
                        <Segment>
                            <Header as='h3'>Flagged Development Projects</Header>
                            <Divider />
                            {FlaggedDisplay}
                        </Segment>
                        <Segment>
                            <Header as='h3'>Recently Completed Development Projects</Header>
                            <Divider />
                            {CompletedDisplay}
                        </Segment>
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }
}

export default DevelopmentPortal;
