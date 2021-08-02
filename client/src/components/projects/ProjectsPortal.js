import './ProjectsPortal.css';

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
import React, { useEffect, useState } from 'react';
//import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import queryString from 'query-string';

const ProjectsPortal = (props) => {

    // UI
    const [searchString, setSearchString] = useState('');
    const [loadedProjects, setLoadedProjects] = useState(false);
    const [loadedFlagged, setLoadedFlagged] = useState(false);
    const [projectDeleted, setProjectDeleted] = useState(false);

    // Projects Data
    const [rawProjects, setRawProjects] = useState([]);
    const [currentProjects, setCurrentProjects] = useState([]);
    const [flaggedProjects, setFlaggedProjects] = useState([]);

    useEffect(() => {
        date.plugin(ordinal);
    }, []);

    useEffect(() => {
        document.title = "LibreTexts Conductor | Projects";
        const queryValues = queryString.parse(props.location.search);
        const projectDeleted = decodeURIComponent(queryValues.projectDeleted);
        if (projectDeleted === "true") {
            setProjectDeleted(true);
        }
    }, [props.location.search]);

    let CurrentDisplay;
    if (loadedProjects === true) {
        if (rawProjects.length > 0) {
            CurrentDisplay = (
                <Table celled>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell width={5}><Header sub>Title</Header></Table.HeaderCell>
                            <Table.HeaderCell width={4}><Header sub>Current Progress (%)</Header></Table.HeaderCell>
                            <Table.HeaderCell width={4}><Header sub>Last Updated At</Header></Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {currentProjects.map((item, index) => {
                            const itemDate = new Date(item.lastUpdate.createdAt);
                            item.updatedDate = date.format(itemDate, 'MMM DDD, YYYY');
                            item.updatedTime = date.format(itemDate, 'h:mm A');
                            return (
                                <Table.Row key={index}>
                                    <Table.Cell>
                                        <p><strong><Link to={`/projects/${item.projectID}`}>{item.title}</Link></strong></p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <p>{item.currentProgress}%</p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <p>{item.updatedDate} at {item.updatedTime}</p>
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
    if (loadedFlagged === true) {
        if (flaggedProjects.length > 0) {
            FlaggedDisplay = (
                <Table celled>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell width={5}><Header sub>Title</Header></Table.HeaderCell>
                            <Table.HeaderCell width={4}><Header sub>Current Progress (%)</Header></Table.HeaderCell>
                            <Table.HeaderCell width={4}><Header sub>Last Updated At</Header></Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {flaggedProjects.map((item, index) => {
                            const itemDate = new Date(item.lastUpdate.createdAt);
                            item.updatedDate = date.format(itemDate, 'MMM DDD, YYYY');
                            item.updatedTime = date.format(itemDate, 'h:mm A');
                            return (
                                <Table.Row key={index}>
                                    <Table.Cell>
                                        <p><strong><Link to={`/projects/${item.projectID}`}>{item.title}</Link></strong></p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <p>{item.currentProgress}%</p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <p>{item.updatedDate} at {item.updatedTime}</p>
                                    </Table.Cell>
                                </Table.Row>
                            )
                        })}
                    </Table.Body>
                </Table>
            )
        }
    } else {
        FlaggedDisplay = <Loader active inline='centered' />
    }
    return(
        <Grid className='component-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Projects</Header>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Menu widths={2}>
                        <Menu.Item as={Link} to='/projects/available' name='availableprojects' icon='folder open' content={<p>Available Projects</p>} />
                        <Menu.Item as={Link} to='/projects/completed' name='completedprojects' icon='check' content={<p>Completed Projects</p>} />
                    </Menu>
                    {((!loadedFlagged) || (flaggedProjects.length > 0)) &&
                        <Segment>
                            <Header as='h3'>Flagged Projects</Header>
                            <Divider />
                            {FlaggedDisplay}
                        </Segment>
                    }
                    <Segment>
                        <Segment basic className='component-innercontainer'>
                            {projectDeleted &&
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
                                onChange={(e) => { setSearchString(e.target.value) }}
                                value={searchString}
                            />
                            <Link to='/harvesting/targetlist?showNewProjectFlow=true'>
                                <Button floated='right' color='green'>
                                    <Button.Content>
                                        <Icon name='crosshairs' />
                                        New Project
                                    </Button.Content>
                                </Button>
                            </Link>
                            <Link to='/projects/addexisting'>
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
                </Grid.Column>
            </Grid.Row>
        </Grid>
    );

};

export default ProjectsPortal;
