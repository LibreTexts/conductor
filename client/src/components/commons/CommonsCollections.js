import './Commons.css';

import { Link } from 'react-router-dom';
import { Grid, Segment, Header, Card, Image, Popup } from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
//import axios from 'axios';

import { getDemoCollections } from '../util/DemoBooks.js';

const CommonsCollections = (props) => {

    const [collections, setCollections] = useState([]);

    useEffect(() => {
        setCollections(getDemoCollections(process.env.REACT_APP_ORG_ID));
    }, []);

    return (
        <Grid className='commons-container'>
            <Grid.Row>
                <Grid.Column>
                    <Segment.Group raised>
                        <Segment>
                            <Header as='h2'>Collections</Header>
                        </Segment>
                        <Segment>
                            {(collections.length > 0) &&
                                <Card.Group itemsPerRow={5}>
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
                            }
                            {(collections.length === 0) &&
                                <p className='text-center'><em>No collections available right now.</em></p>
                            }
                        </Segment>
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
