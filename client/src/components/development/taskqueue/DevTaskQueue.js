import '../DevelopmentPortal.css';

import {
  Grid,
  Header,
  Input,
  Segment,
  Divider,
  Icon,
  Button,
  Table,
  Message
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import React, { Component } from 'react';
import axios from 'axios';
import queryString from 'query-string';

import { UserContext } from '../../../providers.js';

class DevTaskQueue extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
            rawTasks: [],
            sortedTasks: [],
            currentSortString: '',
            showDeleteSuccess: false,
            showNewProjectFlow: false
        };
    }

    componentDidMount() {
        document.title = "LibreTexts PTS | Development | Task Queue";
        //const [user] = this.context;
        const queryValues = queryString.parse(this.props.location.search);
        const deleteSuccess = decodeURIComponent(queryValues.showDeleteSuccess);
        const newProjectFlow = decodeURIComponent(queryValues.showNewProjectFlow);
        var setDeleteSuccess = false;
        var setNewProjectFlow = false;
        if (deleteSuccess === "true") {
            setDeleteSuccess = true;
        }
        if (newProjectFlow === "true") {
            setNewProjectFlow = true;
        }
        this.setState({
            showDeleteSuccess: setDeleteSuccess,
            showNewProjectFlow: setNewProjectFlow
        });
        this.getAllTasks();
    }

    getAllTasks() {
        axios.get('/development/taskqueue/all').then((res) => {
            if (!res.data.err) {
                if (res.data.tasks !== null) {
                    this.setState({ rawTasks: res.data.tasks, sortedTasks: res.data.tasks });
                }
            } else {
                alert("Oops! We encountered an error.");
                console.log(res.data.err);
            }
        }).catch((err) => {
            alert("Oops! We encountered an error.");
            console.log(err);
        });
    }

    setSortString(e) {
        const rawTasks = this.state.rawTasks;
        var toSet = {
            currentSortString: e.target.value
        };
        if (e.target.value !== '') {
            let sorted = rawTasks.filter((elem) => {
                return String(elem.title).toLowerCase().indexOf(String(e.target.value).toLowerCase()) >= 0;
            });
            toSet.sortedTasks = sorted;
        } else {
            toSet.sortedTasks = rawTasks;
        }
        this.setState(toSet);
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
                                <Grid>
                                    {this.state.showDeleteSuccess &&
                                        <Grid.Row columns={1}>
                                            <Grid.Column>
                                                <Message floating icon info>
                                                    <Icon name='delete' />
                                                    <Message.Header>Task successfully deleted.</Message.Header>
                                                </Message>
                                            </Grid.Column>
                                        </Grid.Row>
                                    }
                                    {this.state.showNewProjectFlow &&
                                        <Grid.Row columns={1}>
                                            <Grid.Column>
                                                <Message floating icon positive>
                                                    <Icon name='crosshairs' />
                                                    <Message.Content>
                                                        <Message.Header>New Project</Message.Header>
                                                        <p>Select and open a task to begin a new project.</p>
                                                    </Message.Content>
                                                </Message>
                                            </Grid.Column>
                                        </Grid.Row>
                                    }
                                    <Grid.Row>
                                        <Grid.Column width={11}>
                                            <Input
                                                icon='search'
                                                placeholder='Search tasks...'
                                                onChange={this.setSortString.bind(this)}
                                                value={this.state.currentSortString}
                                            />
                                        </Grid.Column>
                                        <Grid.Column width={5}>
                                            <Link to='/development/taskqueue/add'>
                                                <Button floated='right' color='green'>
                                                    <Button.Content>
                                                        <Icon name='add' />
                                                        Add Task
                                                    </Button.Content>
                                                </Button>
                                            </Link>
                                        </Grid.Column>
                                    </Grid.Row>
                                </Grid>
                                <Divider />
                                {this.state.rawTasks.length > 0 &&
                                    <Table celled>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.HeaderCell width={10}><Header sub>Title</Header></Table.HeaderCell>
                                                <Table.HeaderCell width={4}><Header sub>Status</Header></Table.HeaderCell>
                                                <Table.HeaderCell width={2}></Table.HeaderCell>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {this.state.sortedTasks.map((item, index) => {
                                                if (item.status === 'ready') {
                                                    item.status = 'Ready';
                                                } else if (item.status === 'wait') {
                                                    item.status = 'Waiting for more information';
                                                } else if (item.status === 'review') {
                                                    item.status = 'Needs further review';
                                                }
                                                return (
                                                    <Table.Row key={index}>
                                                        <Table.Cell>
                                                            <p><strong><Link to={`/development/taskqueue/${item.id}`} className='dproject-table-link'>{item.title}</Link></strong></p>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            {item.status === '' ?
                                                                <p className='gray-span'><em>Unspecified</em></p>
                                                                :
                                                                <p>{item.status}</p>
                                                            }
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <Link to={`/development/taskqueue/${item.id}`}>
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
                                }
                                {this.state.rawTasks.length === 0 &&
                                    <Message><p>There are no tasks right now.</p></Message>
                                }
                            </Segment>
                        </Segment>
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }
}

export default DevTaskQueue;
