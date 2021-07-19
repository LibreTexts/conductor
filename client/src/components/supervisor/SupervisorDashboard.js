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
            rawAios:[],
            filtAios: [],
            dUsers: [],
            dUserFilter: '',
            rawAdmin: [],
            filtAdmin: [],
            aUsers: [],
            aUserFilter: '',
            hFromDate: '',
            hToDate: '',
            dFromDate: '',
            dToDate: '',
            aFromDate: '',
            aToDate: ''
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
            dFromDate: '01-01-2021',
            dToDate: todayString,
            aFromDate: '01-01-2021',
            aToDate: todayString,
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
            case 'development':
                this.getAIOs();
                break
            case 'admin':
                this.getAUpdates();
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

    setDFromDate(e, data) {
        this.setState({
            dFromDate: data.value
        }, () => {
            this.getAIOs();
        });
    }

    setDToDate(e, data) {
        this.setState({
            dToDate: data.value
        }, () => {
            this.getAIOs();
        });
    }

    setAFromDate(e, data) {
        this.setState({
            aFromDate: data.value
        }, () => {
            this.getAUpdates();
        });
    }

    setAToDate(e, data) {
        this.setState({
            aToDate: data.value
        }, () => {
            this.getAUpdates();
        });
    }

    setHUserFilter(e, { value }) {
        this.setState({
            hUserFilter: value
        }, () => {
            this.filterHUpdates();
        });
    }

    setDUserFilter(e, { value }) {
        this.setState({
            dUserFilter: value
        }, () => {
            this.filterAIOs();
        });
    }

    setAUserFilter(e, { value }) {
        this.setState({
            aUserFilter: value
        }, () => {
            this.filterAUpdates();
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

    getAIOs() {
        axios.get('/development/aio/all', {
            params: {
                fromDate: this.state.dFromDate,
                toDate: this.state.dToDate,
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.aios != null) {
                    var dUserResults = {};
                    var dUserOptions = [{ key: 'empty', text: 'Clear...', value: "" }];
                    res.data.aios.forEach((aio) => {
                        dUserResults[aio.author.uuid] = `${aio.author.firstName} ${aio.author.lastName}`;
                    });
                    for (const [user, name] of Object.entries(dUserResults)) {
                        dUserOptions.push({
                            key: user,
                            text: name,
                            value: user
                        });
                    }
                    this.setState({
                        dUsers: dUserOptions,
                        rawAios: res.data.aios,
                        filtAios: res.data.aios
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

    filterAIOs() {
        const rawAios = this.state.rawAios;
        let filtered = rawAios.filter((aio) => {
            if (this.state.dUserFilter === '') {
                return aio;
            } else if (this.state.dUserFilter === aio.author.uuid) {
                return aio;
            }
            return false;
        });
        this.setState({
            filtAios: filtered
        });
    }

    getAUpdates() {
        axios.get('admin/projects/updates/feed', {
            params: {
                fromDate: this.state.aFromDate,
                toDate: this.state.aToDate,
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.updates != null) {
                    var aUserResults = {};
                    var aUserOptions = [{ key: 'empty', text: 'Clear...', value: "" }];
                    res.data.updates.forEach((update) => {
                        aUserResults[update.author.uuid] = `${update.author.firstName} ${update.author.lastName}`;
                    });
                    for (const [user, name] of Object.entries(aUserResults)) {
                        aUserOptions.push({
                            key: user,
                            text: name,
                            value: user
                        });
                    }
                    this.setState({
                        aUsers: aUserOptions,
                        rawAdmin: res.data.updates,
                        filtAdmin: res.data.updates
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

    filterAUpdates() {
        const rawUpdates = this.state.rawAdmin;
        let filtered = rawUpdates.filter((update) => {
            if (this.state.aUserFilter === '') {
                return update;
            } else if (this.state.aUserFilter === update.author.uuid) {
                return update;
            }
            return false;
        });
        this.setState({
            filtAdmin: filtered
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
                case 'development':
                    return(
                        <Segment basic className='pane-segment'>
                            <h2>Development AIOs</h2>
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
                                                value={this.state.dFromDate}
                                                iconPosition='left'
                                                onChange={this.setDFromDate.bind(this)}
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
                                                value={this.state.dToDate}
                                                iconPosition='left'
                                                onChange={this.setDToDate.bind(this)}
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
                                                value={this.state.dUserFilter}
                                                options={this.state.dUsers}
                                                onChange={this.setDUserFilter.bind(this)}
                                            />
                                        </Form>
                                    </Grid.Column>
                                </Grid.Row>
                                <Grid.Row columns={1}>
                                    <Grid.Column>
                                        {this.state.filtAios.map((item, index) => {
                                            const itemDate = new Date(item.createdAt);
                                            item.date = date.format(itemDate, 'MMMM DDD, YYYY');
                                            item.time = date.format(itemDate, 'h:mm A')
                                            return (
                                                <Card fluid key={index}>
                                                    <Card.Content>
                                                        <Image
                                                            floated='left'
                                                            size='mini'
                                                            src={`${item.author.avatar}`}
                                                            circular
                                                        />
                                                        <Card.Header>{item.author.firstName} {item.author.lastName} - <Link to={`/development/projects/${item.project.projectID}`}><em>{item.project.title}</em></Link></Card.Header>
                                                        <Card.Meta>{item.date} | {item.time} — <em>{item.estimatedProgress}% <span className='gray-span'>(estimated)</span> - {item.estimatedHours} Hours <span className='gray-span'>(estimated)</span></em></Card.Meta>
                                                    </Card.Content>
                                                    <Card.Content>
                                                        <Header size='small'>Accomplishments</Header>
                                                        <Card.Description>{item.accomplishments}</Card.Description>
                                                        <Header size='small'>Issues</Header>
                                                        <Card.Description>{item.issues}</Card.Description>
                                                        <Header size='small'>Objectives</Header>
                                                        <Card.Description>{item.objectives}</Card.Description>
                                                    </Card.Content>
                                                    <Card.Content>
                                                        <Header size='small'>Other Notes</Header>
                                                        <Card.Description>
                                                            {item.notes}
                                                            {item.notes === '' &&
                                                                "N/A"
                                                            }
                                                        </Card.Description>
                                                    </Card.Content>
                                                </Card>
                                            )
                                        })}
                                        {(this.state.filtAios.length === 0) &&
                                            <Message><p>No AIOs found for that query.</p></Message>
                                        }
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Segment>
                    );
                case 'admin':
                    return(
                        <Segment basic className='pane-segment'>
                            <h2>Administration Updates</h2>
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
                                                value={this.state.aFromDate}
                                                iconPosition='left'
                                                onChange={this.setAFromDate.bind(this)}
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
                                                value={this.state.aToDate}
                                                iconPosition='left'
                                                onChange={this.setAToDate.bind(this)}
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
                                                value={this.state.aUserFilter}
                                                options={this.state.aUsers}
                                                onChange={this.setAUserFilter.bind(this)}
                                            />
                                        </Form>
                                    </Grid.Column>
                                </Grid.Row>
                                <Grid.Row columns={1}>
                                    <Grid.Column>
                                        {this.state.filtAdmin.map((item, index) => {
                                            const itemDate = new Date(item.createdAt);
                                            item.date = date.format(itemDate, 'MMMM DDD, YYYY');
                                            item.time = date.format(itemDate, 'h:mm A')
                                            return (
                                                <Card fluid key={index}>
                                                    <Card.Content>
                                                        <Image
                                                            floated='left'
                                                            size='mini'
                                                            src={`${item.author.avatar}`}
                                                            circular
                                                        />
                                                        <Card.Header><Link to={`/admin/projects/${item.project.projectID}`}>{item.project.title}</Link> — <em>{item.estimatedProgress}% <span className='gray-span'>(estimated)</span></em></Card.Header>
                                                        <Card.Meta>{item.author.firstName} {item.author.lastName} | {item.date} {item.time}</Card.Meta>
                                                        <Card.Description>{item.message}</Card.Description>
                                                    </Card.Content>
                                                </Card>
                                            )
                                        })}
                                        {(this.state.filtAdmin.length === 0) &&
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
                                            <Menu.Item
                                                name='development'
                                                active={this.state.activeItem === 'development'}
                                                onClick={this.handleMenuClick.bind(this)}
                                            >Development AIOs</Menu.Item>
                                            <Menu.Item
                                                name='admin'
                                                active={this.state.activeItem === 'admin'}
                                                onClick={this.handleMenuClick.bind(this)}
                                            >Administration Updates</Menu.Item>
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
