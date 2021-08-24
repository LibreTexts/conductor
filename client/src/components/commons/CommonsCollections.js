import './Commons.css';

import { Link } from 'react-router-dom';
import {
    Grid,
    Segment,
    Header,
    Card,
    Image,
    Popup,
    Dropdown,
    Table
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
//import axios from 'axios';

import Breakpoint from '../util/Breakpoints.js';

import { getDemoCollections } from '../util/DemoBooks.js';

const CommonsCollections = (props) => {

    // UI
    const [displayChoice, setDisplayChoice] = useState('visual');
    const [loadedData, setLoadedData] = useState(false);

    // Data
    const [collections, setCollections] = useState([]);

    const displayOptions = [
        { key: 'visual', text: 'Visual Mode', value: 'visual' },
        { key: 'itemized', text: 'Itemized Mode', value: 'itemized' }
    ];

    useEffect(() => {
        setCollections(getDemoCollections(process.env.REACT_APP_ORG_ID));
        setLoadedData(true);
    }, []);

    const VisualMode = () => {
        if (collections.length > 0) {
            return (
                <Card.Group itemsPerRow={5} stackable>
                    {collections.map((item, index) => {
                        return (
                            <Popup key={index} content='Collections are coming soon!' position='top center' trigger={
                                <Card
                                    key={index}
                                >
                                    <Image className='commons-content-card-img' src={item.thumbnail} wrapped ui={false} />
                                    <Card.Content>
                                        <Card.Header>{item.title}</Card.Header>
                                        <Card.Meta>
                                            {item.size}
                                        </Card.Meta>
                                    </Card.Content>
                                </Card>
                            } />
                        )
                    })}
                </Card.Group>
            )
        } else {
            return (
                <p className='text-center'><em>No collections available right now.</em></p>
            )
        }
    };

    const ItemizedMode = () => {
        if (collections.length > 0) {
            return (
                <Table celled>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell width={5}><Header sub>Name</Header></Table.HeaderCell>
                            <Table.HeaderCell width={11}><Header sub>Resources</Header></Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {collections.map((item, index) => {
                            return (
                                <Table.Row key={index}>
                                    <Table.Cell>
                                        <p><strong>{item.title}</strong></p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <p>{item.size}</p>
                                    </Table.Cell>
                                </Table.Row>
                            )
                        })}
                    </Table.Body>
                </Table>
            )
        } else {
            return (
                <p className='text-center'><em>No collections available right now.</em></p>
            )
        }
    };

    return (
        <Grid className='commons-container'>
            <Grid.Row>
                <Grid.Column>
                    <Segment.Group raised>
                        <Segment>
                            <Breakpoint name='tabletOrDesktop'>
                                <div className='commons-content-pagemenu'>
                                    <div className='commons-content-pagemenu-left'>
                                        <Header as='h2'>Collections</Header>
                                    </div>
                                    <div className='commons-content-pagemenu-right'>
                                        <Dropdown
                                            placeholder='Display mode...'
                                            floating
                                            selection
                                            button
                                            className='float-right'
                                            options={displayOptions}
                                            onChange={(e, { value }) => { setDisplayChoice(value) }}
                                            value={displayChoice}
                                        />
                                    </div>
                                </div>
                            </Breakpoint>
                            <Breakpoint name='mobile'>
                                <Grid>
                                    <Grid.Row>
                                        <Grid.Column>
                                            <Header as='h2' textAlign='center'>Collections</Header>
                                        </Grid.Column>
                                    </Grid.Row>
                                    <Grid.Row>
                                        <Grid.Column>
                                            <Dropdown
                                                placeholder='Display mode...'
                                                floating
                                                selection
                                                button
                                                fluid
                                                className='float-right'
                                                options={displayOptions}
                                                onChange={(e, { value }) => { setDisplayChoice(value) }}
                                                value={displayChoice}
                                            />
                                        </Grid.Column>
                                    </Grid.Row>
                                </Grid>
                            </Breakpoint>
                        </Segment>
                        {(displayChoice === 'visual')
                            ? (
                                <Segment className='commons-content' loading={!loadedData}>
                                    <VisualMode />
                                </Segment>
                            )
                            : (
                                <Segment className='commons-content commons-content-itemized' loading={!loadedData}>
                                    <ItemizedMode />
                                </Segment>
                            )
                        }
                    </Segment.Group>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )
}

export default CommonsCollections;

/*
as={Link}
to={`/collections/${item.id}`}
*/
