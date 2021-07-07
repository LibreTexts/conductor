import './HarvestingPortal.css';

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
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';

import { UserContext } from '../../providers.js';


class HarvestingCompletedProjects extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
            rawProjects: [],
            sortedProjects: [],
            currentSortString: ''
        };
    }

    componentDidMount() {
        document.title = "LibreTexts PTS | Harvesting | Completed Projects";
        date.plugin(ordinal);
        this.getCompletedProjects();
    }

    getCompletedProjects() {
        axios.get('/harvesting/projects/completed').then((res) => {
            if (!res.data.err) {
                if (res.data.projects != null) {
                    this.setState({
                        rawProjects: res.data.projects,
                        sortedProjects: res.data.projects,
                        currentSortString: ''
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
        return(
            <Grid className='component-container' divided='vertically'>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Header className='component-header'>Completed Harvesting Projects</Header>
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
                                <Input
                                    icon='search'
                                    placeholder='Search completed projects...'
                                    onChange={this.setSortString.bind(this)}
                                    value={this.state.currentSortString}
                                />
                                <Divider />
                                {this.state.sortedProjects.length > 0 &&
                                    <Table celled>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.HeaderCell width={4}><Header sub>Title</Header></Table.HeaderCell>
                                                <Table.HeaderCell width={2}><Header sub>Current Progress (%)</Header></Table.HeaderCell>
                                                <Table.HeaderCell width={3}><Header sub>Total Chapters</Header></Table.HeaderCell>
                                                <Table.HeaderCell width={5}><Header sub>Last Updated At</Header></Table.HeaderCell>
                                                <Table.HeaderCell width={1}></Table.HeaderCell>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {this.state.sortedProjects.map((item, index) => {
                                                const itemDate = new Date(item.lastUpdate.createdAt);
                                                item.updatedDate = date.format(itemDate, 'MMM DDD, YYYY');
                                                item.updatedTime = date.format(itemDate, 'h:mm A');
                                                return (
                                                    <Table.Row key={index}>
                                                        <Table.Cell>
                                                            <p><strong><Link to={`/harvesting/projects/${item.projectID}`} className='hproject-table-link'>{item.title}</Link></strong></p>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <p>{item.currentProgress}%</p>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <p>{item.chapters}</p>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <p>{item.updatedDate} at {item.updatedTime}</p>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <Link to={`/harvesting/projects/${item.projectID}`}>
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
                                {this.state.sortedProjects.length === 0 &&
                                    <Message><p>You have no completed projects right now.</p></Message>
                                }
                            </Segment>
                        </Segment>
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }
}

export default HarvestingCompletedProjects;
