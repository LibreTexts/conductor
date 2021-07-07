import '../HarvestingPortal.css';

import {
  Grid,
  Header,
  Input,
  Segment,
  Divider,
  Icon,
  Button,
  Container,
  Table,
  Dropdown,
  Label,
  Message
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

class HarvestingTargetlist extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
            filtering: false,
            roles: [],
            currentShelfFilter: '',
            currentLibraryFilter: '',
            currentSortString: '',
            rawTargets: [],
            sortedTargets: [],
            finalSortedTargets: [],
            currentShelfOptions: [],
            disableShelfFilter: true,
            showDeleteSuccess: false,
            showNewProjectFlow: false
        };
    }

    componentDidMount() {
        document.title = "LibreTexts PTS | Harvesting | Textbook Targetlist";
        const [user] = this.context;
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
            showNewProjectFlow: setNewProjectFlow,
            roles: user.roles
        });
        this.getAllTargets();
    }

    getAllTargets() {
        axios.get('/harvesting/targetlist/all').then((res) => {
            if (!res.data.err) {
                if (res.data.targets !== null) {
                    this.setState({
                        rawTargets: res.data.targets,
                        sortedTargets: res.data.targets
                    }, () => {
                        this.finalSortTargets();
                    });
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

    filterByLibraryAndShelf() {
        const rawTargets = this.state.rawTargets;
        let sorted = rawTargets.filter((target) => {
            if (this.state.currentLibraryFilter === '') {
                return target;
            } else if ((this.state.currentLibraryFilter !== '') && (this.state.currentShelfFilter !== '')) {
                if ((target.library === this.state.currentLibraryFilter) && (target.shelf === this.state.currentShelfFilter)) {
                    return target;
                }
            } else if (this.state.currentLibraryFilter !== '') {
                if (target.library === this.state.currentLibraryFilter) {
                    return target;
                }
            }
            return false;
        });
        this.setState({
            sortedTargets: sorted
        }, () => {
            this.finalSortTargets();
        });
    }

    setLibraryFilter(e, { value }) {
        const shelfOptionsData = getShelfOptions(value);
        this.setState({
            currentLibraryFilter: value,
            currentShelfFilter: '',
            currentShelfOptions: shelfOptionsData[0],
            disableShelfFilter: shelfOptionsData[1]
        }, () => {
            this.filterByLibraryAndShelf();
        });
    }

    setShelfFilter(e, { value }) {
        this.setState({
            currentShelfFilter: value
        }, () => {
            this.filterByLibraryAndShelf();
        });
    }

    setSortString(e) {
        this.setState({
            currentSortString: e.target.value
        }, () => {
            this.finalSortTargets();
        })
    }

    finalSortTargets() {
        const rawTasks = this.state.sortedTargets;
        var toSet = {};
        if (this.state.currentSortString !== '') {
            let sorted = rawTasks.filter((elem) => {
                return String(elem.title).toLowerCase().indexOf(String(this.state.currentSortString).toLowerCase()) >= 0;
            });
            toSet.finalSortedTargets = sorted;
        } else {
            toSet.finalSortedTargets = rawTasks;
        }
        this.setState(toSet);
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
                                <Grid>
                                    {this.state.showDeleteSuccess &&
                                        <Grid.Row columns={1}>
                                            <Grid.Column>
                                                <Message floating icon info>
                                                    <Icon name='delete' />
                                                    <Message.Header>Target successfully deleted.</Message.Header>
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
                                                        <p>Select and open a textbook target to begin a new project.</p>
                                                    </Message.Content>
                                                </Message>
                                            </Grid.Column>
                                        </Grid.Row>
                                    }
                                    <Grid.Row>
                                        <Grid.Column width={3}>
                                            <Input
                                                icon='search'
                                                placeholder='Search current targets...'
                                                onChange={this.setSortString.bind(this)}
                                                value={this.state.currentSortString}
                                            />
                                        </Grid.Column>
                                        <Grid.Column width={8}>
                                            <Dropdown
                                                placeholder='Filter by Library'
                                                icon='folder open outline'
                                                floating
                                                selection
                                                labeled
                                                className='icon'
                                                button
                                                options={libraryOptions}
                                                value={this.state.currentLibraryFilter}
                                                onChange={this.setLibraryFilter.bind(this)}
                                            />
                                            <Dropdown
                                                placeholder='Filter by Shelf'
                                                icon='book'
                                                floating
                                                selection
                                                labeled
                                                button
                                                options={this.state.currentShelfOptions}
                                                className='icon'
                                                disabled={this.state.disableShelfFilter}
                                                onChange={this.setShelfFilter.bind(this)}
                                            />
                                        </Grid.Column>
                                        <Grid.Column width={5}>
                                            {this.state.roles.includes('admin') &&
                                                <Link to='/harvesting/targetlist/add'>
                                                    <Button floated='right' color='green'>
                                                        <Button.Content>
                                                            <Icon name='add' />
                                                            Add Target
                                                        </Button.Content>
                                                    </Button>
                                                </Link>
                                            }
                                        </Grid.Column>
                                    </Grid.Row>
                                </Grid>
                                <Divider />
                                <Container fluid className={this.filtering ? '' : 'container-hidden'}>
                                    <span className='filterby-span'>Filtering by:</span>
                                    <Label>
                                        <Icon name='book' />
                                        Chemistry
                                        <Icon name='delete' />
                                    </Label>
                                    <Label>
                                        <Icon name='folder open outline' />
                                        Chemistry
                                        <Icon name='delete' />
                                    </Label>
                                </Container>
                                {this.state.rawTargets.length > 0 &&
                                    <Table celled>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.HeaderCell width={4}><Header sub>Title</Header></Table.HeaderCell>
                                                <Table.HeaderCell width={2}><Header sub>Library</Header></Table.HeaderCell>
                                                <Table.HeaderCell width={3}><Header sub>Shelf</Header></Table.HeaderCell>
                                                <Table.HeaderCell width={2}><Header sub>Type</Header></Table.HeaderCell>
                                                <Table.HeaderCell width={3}><Header sub>Status</Header></Table.HeaderCell>
                                                <Table.HeaderCell width={1}></Table.HeaderCell>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {this.state.finalSortedTargets.map((item, index) => {
                                                item.libraryDisplay = '';
                                                item.shelfDisplay = '';
                                                libraryOptions.forEach((lib) => {
                                                    if (lib.value === item.library) {
                                                        item.libraryDisplay = lib.text;
                                                    }
                                                });
                                                const mappedShelf = allShelfMap.get(item.shelf);
                                                if (mappedShelf !== undefined) {
                                                    item.shelfDisplay = mappedShelf;
                                                }
                                                if (item.type === 'pdf') {
                                                    item.type = 'PDF';
                                                } else if (item.type === 'eBook') {
                                                    item.type = 'External eBook';
                                                } else if (item.type === 'hardcopy') {
                                                    item.type = 'Hardcopy';
                                                } else if (item.type === 'epub') {
                                                    item.type = 'EPUB';
                                                }
                                                if (item.status === 'ready') {
                                                    item.status = 'Ready';
                                                } else if (item.status === 'wait') {
                                                    item.status = 'Waiting for permission';
                                                } else if (item.status === 'review') {
                                                    item.status = 'Needs further review';
                                                }
                                                return (
                                                    <Table.Row key={index}>
                                                        <Table.Cell>
                                                            <p><strong><Link to={`/harvesting/targetlist/${item.id}`} className='hproject-table-link'>{item.title}</Link></strong></p>
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            {item.libraryDisplay === '' ?
                                                                <p className='gray-span'><em>Unspecified</em></p>
                                                                :
                                                                <p>{item.libraryDisplay}</p>
                                                            }
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            {item.shelfDisplay === '' ?
                                                                <p className='gray-span'><em>Unspecified</em></p>
                                                                :
                                                                <p>{item.shelfDisplay}</p>
                                                            }
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            {item.type === '' ?
                                                                <p className='gray-span'><em>Unspecified</em></p>
                                                                :
                                                                <p>{item.type}</p>
                                                            }
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            {item.status === '' ?
                                                                <p className='gray-span'><em>Unspecified</em></p>
                                                                :
                                                                <p>{item.status}</p>
                                                            }
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <Link to={`/harvesting/targetlist/${item.id}`}>
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
                                {this.state.rawTargets.length === 0 &&
                                    <Message><p>There are no targets right now.</p></Message>
                                }
                            </Segment>
                        </Segment>
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }
}

export default HarvestingTargetlist;
