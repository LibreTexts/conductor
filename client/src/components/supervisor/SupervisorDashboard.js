import './SupervisorDashboard.css';

import { DateInput } from 'semantic-ui-calendar-react';
import {
  Grid,
  Header,
  Menu,
  Image,
  Segment,
  Divider,
  Message,
  Icon,
  Form,
  Card
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import React, { Component } from 'react';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';

import { UserContext } from '../../providers.js';

class SupervisorDashboard extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
            firstName: '',
            lastName: '',
            roles: [],
            date: '',
            activeItem: 'harvesting',
            rawHarvesting: [],
            filtHarvesting: [],
            hUsers: [],
            hUserFilter: '',
            hFromDate: '',
            hToDate: '',
        };
    }

    componentDidMount() {
        document.title = "LibreTexts Conductor | Supervisor Dashboard";
        const [user] = this.context;
        date.plugin(ordinal);
        if (user.firstName !== this.state.firstName) {
            this.setState({ firstName: user.firstName });
        }
        if (this.state.roles.length === 0 && user.roles.length !== 0) {
            this.setState({ roles: user.roles });
        }
        const today = new Date();
        //const weekAgo = new Date();
        //weekAgo.setDate(today.getDate() - 7);
        const todayString = `${today.getMonth()+1}-${today.getDate()}-${today.getFullYear()}`;
        //const weekAgoString = `${weekAgo.getMonth()+1}-${weekAgo.getDate()}-${weekAgo.getFullYear()}`;
        this.setState({
            hFromDate: '01-01-2021',
            hToDate: todayString,
            date: today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        }, () => {
            this.getHUpdates();
        });
    }

    componentDidUpdate() {
        const [user] = this.context;
        if (user.firstName !== this.state.firstName) {
            this.setState({ firstName: user.firstName });
        }
        if (user.lastName !== this.state.lastName) {
            this.setState({ lastName: user.lastName });
        }
        if (this.state.roles.length === 0 && user.roles.length !== 0) {
            this.setState({ roles: user.roles });
        }
    }

    handleMenuClick(e, data) {
        this.setState({ activeItem: data.name });
        switch(data.name) {
            case 'harvesting':
                this.getHUpdates();
                break
            default:
                break // silence React warning
        }
    }

    setHFromDate(e, data) {
        this.setState({
            hFromDate: data.value
        }, () => {
            this.getHUpdates();
        });
    }

    setHToDate(e, data) {
        this.setState({
            hToDate: data.value
        }, () => {
            this.getHUpdates();
        });
    }

    getHUpdates() {
        axios.get('harvesting/projects/updates/feed', {
            params: {
                fromDate: this.state.hFromDate,
                toDate: this.state.hToDate,
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.updates != null) {
                    var hUserResults = {};
                    var hUserOptions = [{ key: 'empty', text: 'Clear...', value: "" }];
                    res.data.updates.forEach((update) => {
                        hUserResults[update.author.uuid] = `${update.author.firstName} ${update.author.lastName}`;
                    });
                    for (const [user, name] of Object.entries(hUserResults)) {
                        hUserOptions.push({
                            key: user,
                            text: name,
                            value: user
                        });
                    }
                    this.setState({
                        hUsers: hUserOptions,
                        rawHarvesting: res.data.updates,
                        filtHarvesting: res.data.updates
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

    filterHUpdates() {
        const rawUpdates = this.state.rawHarvesting;
        let filtered = rawUpdates.filter((update) => {
            if (this.state.hUserFilter === '') {
                return update;
            } else if (this.state.hUserFilter === update.author.uuid) {
                return update;
            }
            return false;
        });
        this.setState({
            filtHarvesting: filtered
        });
    }

    parseDateAndTime(dateInput) {
        const dateInstance = new Date(dateInput);
        const timeString = date.format(dateInstance, 'h:mm A');
        return {
            date: dateInstance.toDateString(),
            time: timeString
        }
    }

    render() {
        const Pane = (props) => {
            switch(this.state.activeItem) {
                case 'harvesting':
                    return(
                        <Segment basic className='pane-segment'>
                            <h2>Harvesting Updates</h2>
                            <Divider />
                            <Grid>
                                <Grid.Row columns={3}>
                                    <Grid.Column>
                                        <Form>
                                            <DateInput
                                                name='fromdate'
                                                label='From'
                                                inlineLabel
                                                placeholder='From ...'
                                                value={this.state.hFromDate}
                                                iconPosition='left'
                                                onChange={this.setHFromDate.bind(this)}
                                                dateFormat='MM-DD-YYYY'
                                                popupPosition='bottom center'
                                            />
                                        </Form>
                                    </Grid.Column>
                                    <Grid.Column>
                                        <Form>
                                            <DateInput
                                                name='todate'
                                                label='To'
                                                inlineLabel
                                                placeholder='To ...'
                                                value={this.state.hToDate}
                                                iconPosition='left'
                                                onChange={this.setHToDate.bind(this)}
                                                dateFormat='MM-DD-YYYY'
                                                popupPosition='bottom center'
                                            />
                                        </Form>
                                    </Grid.Column>
                                    <Grid.Column>
                                        <Form>
                                            <Form.Select
                                                placeholder='Filter by user...'
                                                label='User'
                                                inline
                                                value={this.state.hUserFilter}
                                                options={this.state.hUsers}
                                                onChange={this.setHUserFilter.bind(this)}
                                            />
                                        </Form>
                                    </Grid.Column>
                                </Grid.Row>
                                <Grid.Row columns={1}>
                                    <Grid.Column>
                                        {this.state.filtHarvesting.map((item, index) => {
                                            const itemDate = new Date(item.createdAt);
                                            item.date = date.format(itemDate, 'MMMM DDD, YYYY');
                                            item.time = date.format(itemDate, 'h:mm A')
                                            item.progress = Number.parseFloat(Math.floor((item.chapterCompleted / item.project.chapters)*100)).toFixed(0);
                                            return (
                                                <Card fluid key={index}>
                                                    <Card.Content>
                                                        <Image
                                                            floated='left'
                                                            size='mini'
                                                            src={`${item.author.avatar}`}
                                                            circular
                                                        />
                                                        <Card.Header><Link to={`/harvesting/projects/${item.project.projectID}`}>{item.project.title}</Link> — <em>{item.progress}%</em></Card.Header>
                                                        <Card.Meta>{item.author.firstName} {item.author.lastName} | {item.date} {item.time}</Card.Meta>
                                                        <Card.Description>{item.message}</Card.Description>
                                                    </Card.Content>
                                                    <Card.Content extra>
                                                        <Icon name='clipboard check' />
                                                        Chapter {item.chapterCompleted} / {item.project.chapters}
                                                    </Card.Content>
                                                </Card>
                                            )
                                        })}
                                        {(this.state.filtHarvesting.length === 0) &&
                                            <Message><p>No progress updates found for that query.</p></Message>
                                        }
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Segment>
                    );
                default:
                    break
            }
        };
        return(
            <Grid className='component-container' divided='vertically'>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Header className='component-header'>Supervisor Dashboard</Header>
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Segment>
                            <Grid>
                                <Grid.Row>
                                    <Grid.Column width={4}>
                                        <strong>SIGNED IN AS: </strong>{this.state.lastName}, {this.state.firstName} ({this.state.roles.map((item) => { return item })})
                                    </Grid.Column>
                                    <Grid.Column width={8}>
                                    </Grid.Column>
                                    <Grid.Column width={4} textAlign='right'>
                                        <strong>DATE: </strong>{this.state.date}
                                    </Grid.Column>
                                </Grid.Row>
                                <Grid.Row>
                                    <Grid.Column width={3}>
                                        <Menu fluid vertical color='blue' secondary pointing className='fullheight-menu'>
                                            <Menu.Item
                                                name='harvesting'
                                                active={this.state.activeItem === 'harvesting'}
                                                onClick={this.handleMenuClick.bind(this)}
                                            >Harvesting Updates</Menu.Item>
                                        </Menu>
                                    </Grid.Column>
                                    <Grid.Column stretched width={13}>
                                        <Pane />
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Segment>
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }
}

export default SupervisorDashboard;
