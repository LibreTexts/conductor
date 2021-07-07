import './AdministrationPortal.css';

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


class AdministrationPortal extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
            rawProjects: [],
            sortedProjects: [],
            completedProjects: [],
            currentSortString: '',
            showProjectDeleteSuccess: false,
            loadedCurrentProjects: false,
            loadedCompletedProjects: false
        };
    }

    componentDidMount() {
        document.title = "LibreTexts PTS | Administration";
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
        axios.get('/admin/projects/current').then((res) => {
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
            this.getRecentlyCompletedProjects();
        }).catch((err) => {
            alert("Oops! We encountered an error.");
            console.log(err);
        });
    }

    getRecentlyCompletedProjects() {
        axios.get('/admin/projects/recentlycompleted').then((res) => {
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
            let sorted = rawProjects.filter((elem) => {
                return String(elem.title).toLowerCase().indexOf(String(e.target.value).toLowerCase()) >= 0;
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
                                <Table.HeaderCell width={6}><Header sub>Title</Header></Table.HeaderCell>
                                <Table.HeaderCell width={2}><Header sub>Current Progress (%)</Header></Table.HeaderCell>
                                <Table.HeaderCell width={2}><Header sub>Status</Header></Table.HeaderCell>
                                <Table.HeaderCell width={4}><Header sub>Last Updated At</Header></Table.HeaderCell>
                                <Table.HeaderCell width={2}></Table.HeaderCell>
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
                                            <p><strong><Link to={`/admin/projects/${item.projectID}`} className='aproject-table-link'>{item.title}</Link></strong></p>
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
                                            <Link to={`/admin/projects/${item.projectID}`}>
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
        let CompletedDisplay;
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
                                            <p><strong><Link to={`/admin/projects/${item.projectID}`} className='aproject-table-link'>{item.title}</Link></strong></p>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <p>{item.updatedDate} at {item.updatedTime}</p>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Link to={`/admin/projects/${item.projectID}`}>
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
                        <Header className='component-header'>Administration</Header>
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Menu widths={2}>
                            <Menu.Item as={Link} to='/admin/taskqueue' name='taskqueue' icon='tasks' content={<p>Task Queue</p>} />
                            <Menu.Item as={Link} to='/admin/projects/completed' name='completed' icon='check' content={<p>View All Completed Projects</p>} />
                        </Menu>
                        <Segment>
                            <h3>Current Administration Projects</h3>
                            <Divider />
                            <Segment basic className='component-innercontainer'>
                                {this.state.showProjectDeleteSuccess &&
                                    <Segment basic>
                                        <Message floating icon info>
                                            <Icon name='delete' />
                                            <Message.Content>
                                                <Message.Header>Project successfully deleted.</Message.Header>
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
                                <Link to='/admin/taskqueue?showNewProjectFlow=true'>
                                    <Button floated='right' color='green'>
                                        <Button.Content>
                                            <Icon name='crosshairs' />
                                            New Project
                                        </Button.Content>
                                    </Button>
                                </Link>
                                <Link to='/admin/projects/addexisting'>
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
                            <Header as='h3'>Recently Completed Administration Projects</Header>
                            <Divider />
                            {CompletedDisplay}
                        </Segment>
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }
}

export default AdministrationPortal;
