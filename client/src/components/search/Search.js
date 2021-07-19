import './Search.css';

import {
  Grid,
  Header,
  Segment,
  Message,
  Loader,
  Image,
  List
} from 'semantic-ui-react';
import React, { Component } from 'react';
import axios from 'axios';
import queryString from 'query-string';

import { UserContext } from '../../providers.js';

class Search extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
            query: '',
            resultCount: 0,
            userRes: [],
            aTaskRes: [],
            aProjRes: [],
            loadedResults: false
        };
    }

    componentDidMount() {
        document.title = "LibreTexts Conductor | Search Results";
        const queryValues = queryString.parse(this.props.location.search);
        const queryDecoded = decodeURIComponent(queryValues.query);
        this.setState({
            query: queryDecoded
        }, () => {
            this.getSearchResults();
        });
    }

    getSearchResults() {
        axios.get('/search', {
            params: {
                query: this.state.query
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.resultCount > 0) {
                    this.setState({
                        resultCount: res.data.resultCount,
                        userRes: res.data.users,
                        aTaskRes: res.data.adminTasks,
                        aProjRes: res.data.adminProjs,
                        loadedResults: true
                    });
                }
                console.log(res.data);
            } else {
                alert("Oops! We encountered an error.");
                console.log(res.data.errMsg);
            }
        }).catch((err) => {
            alert("Oops! We encountered an error.");
            console.log(err);
        });
    }

    render() {
        return(
            <Grid className='component-container' divided='vertically'>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Header className='component-header'>Search Results</Header>
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Segment>
                            <Grid>
                                <Grid.Row>
                                    <Grid.Column width={4}>
                                        <Header sub>Query</Header>
                                        <span>{this.state.query}</span>
                                    </Grid.Column>
                                    <Grid.Column width={10}>
                                        <Header sub>Results</Header>
                                        <span>{this.state.resultCount} results returned.</span>
                                    </Grid.Column>
                                    <Grid.Column width={2}>
                                        <Loader active={!this.state.loadedResults} />
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                            {(this.state.resultCount > 0) &&
                                <Segment>
                                    <Segment vertical>
                                        <h3>Projects</h3>
                                    </Segment>
                                    <Segment vertical>
                                        <h3>Harvesting — Textbook Targetlist</h3>
                                    </Segment>
                                    <Segment vertical>
                                        <h3>Development — Task Queue</h3>
                                    </Segment>
                                    <Segment vertical>
                                        <h3>Administration — Task Queue</h3>
                                    </Segment>
                                    <Segment vertical>
                                        <h3>Users</h3>
                                        <List divided relaxed>
                                            {this.state.userRes.map((item, index) => {
                                                return (
                                                    <List.Item key={index}>
                                                        <Image avatar src='/steve.jpg' />
                                                        <List.Content>
                                                            <List.Header>{item.firstName} {item.lastName}</List.Header>
                                                            <List.Description as='a'>LibreTexts member</List.Description>
                                                        </List.Content>
                                                    </List.Item>
                                                )
                                            })}
                                        </List>
                                    </Segment>
                                </Segment>
                            }
                            {(this.state.resultCount === 0) &&
                                <Message><p>No results found.</p></Message>
                            }
                        </Segment>
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }
}

export default Search;
