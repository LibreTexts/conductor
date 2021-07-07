import './DevelopmentPortal.css';

import { DateInput } from 'semantic-ui-calendar-react';
import {
  Grid,
  Header,
  Segment,
  Divider,
  Message,
  Icon,
  Button,
  Container,
  Card,
  Image,
  Form,
  Input
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import React, { Component } from 'react';
import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';

import { UserContext } from '../../providers.js';

class DevAIOFeed extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
            rawAios: [],
            sortedAios: [],
            currentSortString: '',
            fromDate: '01-01-2021',
            toDate: ''
        };
    }

    componentDidMount() {
        document.title = "LibreTexts PTS | Development | AIO Feed";
        //const [user] = this.context;
        date.plugin(ordinal);
        const today = new Date();
        const todayString = `${today.getMonth()+1}-${today.getDate()}-${today.getFullYear()}`
        this.setState({
            toDate: todayString
        }, () => {
            this.getAIOFeed();
        });
    }

    getAIOFeed() {
        axios.get('/development/aio/all', {
            params: {
                fromDate: this.state.fromDate,
                toDate: this.state.toDate,
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.aios != null) {
                    this.setState({
                        rawAios: res.data.aios,
                        sortedAios: res.data.aios
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

    setSortString(e) {
        const rawAios = this.state.rawAios;
        var toSet = {
            currentSortString: e.target.value
        };
        if (e.target.value !== '') {
            let sorted = rawAios.filter((aio) => {
                const aioFields = [String(aio.accomplishments).toLowerCase(), String(aio.issues).toLowerCase(),
                        String(aio.issues).toLowerCase(), String(aio.issues).toLowerCase(),
                        String(aio.author.firstName).toLowerCase(), String(aio.author.lastName).toLowerCase()];
                var aioRawText = '';
                aioFields.forEach((elem, index) => {
                    if (index > 0) {
                        aioRawText = aioRawText + " ";
                    }
                    aioRawText = aioRawText + elem;
                });
                console.log(aioRawText);
                return aioRawText.search(String(e.target.value).toLowerCase()) >= 0;
            });
            toSet.sortedAios = sorted;
        } else {
            toSet.sortedAios = rawAios;
        }
        this.setState(toSet);
    }

    setFromDate(e, data) {
        this.setState({
            fromDate: data.value
        }, () => {
            this.getAIOFeed();
        });
    }

    setToDate(e, data) {
        this.setState({
            toDate: data.value
        }, () => {
            this.getAIOFeed();
        });
    }

    render() {
        return(
            <Grid className='component-container' divided='vertically'>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Header className='component-header' icon='feed' content='AIO Feed' />
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Segment>
                            <Container fluid>
                                <Link to='/development'>
                                    <Button color='blue' basic>
                                        <Button.Content>
                                            <Icon name='arrow left' />
                                            Back to Development
                                        </Button.Content>
                                    </Button>
                                </Link>
                            </Container>
                            <Divider />
                            <Segment basic className='component-innercontainer'>
                                <Grid>
                                    <Grid.Row divided>
                                        <Grid.Column width={4}>
                                            <Input
                                                icon='search'
                                                placeholder='Search feed...'
                                                onChange={this.setSortString.bind(this)}
                                                value={this.state.currentSortString}
                                                fluid
                                            />
                                            <Divider />
                                            <Form>
                                                <DateInput
                                                    name='fromdate'
                                                    label='From'
                                                    placeholder='From ...'
                                                    value={this.state.fromDate}
                                                    iconPosition='left'
                                                    onChange={this.setFromDate.bind(this)}
                                                    dateFormat='MM-DD-YYYY'
                                                    popupPosition='bottom center'
                                                />
                                                <DateInput
                                                    name='todate'
                                                    label='To'
                                                    placeholder='To ...'
                                                    value={this.state.toDate}
                                                    iconPosition='left'
                                                    onChange={this.setToDate.bind(this)}
                                                    dateFormat='MM-DD-YYYY'
                                                    popupPosition='bottom center'
                                                />
                                            </Form>
                                        </Grid.Column>
                                        <Grid.Column width={12}>
                                            <Header size='huge'>Feed</Header>
                                            <Divider />
                                            <div className='dev-aiofeed'>
                                                {this.state.sortedAios.map((item, index) => {
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
                                                {(this.state.sortedAios.length === 0) &&
                                                    <Message><p>There are no AIO updates in this date range.</p></Message>
                                                }
                                            </div>
                                        </Grid.Column>
                                    </Grid.Row>
                                </Grid>
                            </Segment>
                        </Segment>
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }
}

export default DevAIOFeed;
