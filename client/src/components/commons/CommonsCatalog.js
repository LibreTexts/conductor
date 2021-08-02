import './Commons.css';

import { Link } from 'react-router-dom';
import { Grid, Image, Dropdown, Segment, Input, Pagination, Card } from 'semantic-ui-react';
import React from 'react';
//import axios from 'axios';

import demoBooks from '../util/DemoBooks.js';

const CommonsCatalog = (props) => {

    return (
        <Grid className='commons-container'>
            <Grid.Row>
                <Grid.Column>
                    <Segment.Group raised>
                        <Segment>
                            <Grid>
                                <Grid.Row>
                                    <Grid.Column width={10}>
                                        <Dropdown
                                            placeholder='Library'
                                            floating
                                            selection
                                            button
                                        />
                                        <Dropdown
                                            placeholder='Subject'
                                            floating
                                            selection
                                            button
                                        />
                                        <Dropdown
                                            placeholder='Author'
                                            floating
                                            selection
                                            button
                                        />
                                        <Dropdown
                                            placeholder='License'
                                            floating
                                            selection
                                            button
                                        />
                                    </Grid.Column>
                                    <Grid.Column width={6}>
                                        <Input
                                            icon='search'
                                            placeholder='Search...'
                                            className='float-right'
                                        />
                                        <Dropdown
                                            placeholder='Sort by...'
                                            floating
                                            selection
                                            button
                                            className='float-right'
                                        />
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Segment>
                        <Segment>
                            <div className='commons-content-pagemenu'>
                                <div className='commons-content-pagemenu-left'>
                                    <span>Displaying </span>
                                    <Dropdown
                                        text='10'
                                        className='commons-content-pagemenu-dropdown'
                                    />
                                    <span> items per page of <strong>{demoBooks.length}</strong> results.</span>
                                </div>
                                <div className='commons-content-pagemenu-right'>
                                    <Pagination
                                        defaultActivePage={1}
                                        totalPages={10}
                                        boundaryRange={1}
                                        siblingRange={1}
                                        firstItem={null}
                                        lastItem={null}
                                    />
                                </div>
                            </div>
                        </Segment>
                        <Segment className='commons-content'>
                            <Card.Group itemsPerRow={5}>
                                {demoBooks.map((item, index) => {
                                    return (
                                        <Card
                                            key={index}
                                            as={Link}
                                            to={`/book/${item.id}`}
                                        >
                                            <Image className='commons-content-card-img' src={item.thumbnail} wrapped ui={false} />
                                            <Card.Content>
                                                <Card.Header>{item.title}</Card.Header>
                                                <Card.Meta>
                                                    <Image src='https://libretexts.org/img/LibreTexts/glyphs/chem.png' className='commons-content-glyph' />
                                                    {String(item.library).charAt(0).toUpperCase() + String(item.library).slice(1)}
                                                </Card.Meta>
                                                <Card.Description>
                                                    {item.author}
                                                </Card.Description>
                                            </Card.Content>
                                        </Card>
                                    )
                                })}
                            </Card.Group>
                        </Segment>
                    </Segment.Group>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )
}

export default CommonsCatalog;
