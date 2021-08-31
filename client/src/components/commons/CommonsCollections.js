import './Commons.css';

//import { Link } from 'react-router-dom';
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
import { useLocation, useHistory } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import queryString from 'query-string';

import Breakpoint from '../util/Breakpoints.js';
import useGlobalError from '../error/ErrorHooks.js';
import { getDemoCollections } from '../util/DemoBooks.js';
import { catalogDisplayOptions } from '../util/CatalogOptions.js';
import { updateParams } from '../util/HelperFunctions.js';

const CommonsCollections = (_props) => {

    const { handleGlobalError } = useGlobalError();

    // Global State and Location/History
    const dispatch = useDispatch();
    const location = useLocation();
    const history = useHistory();
    const org = useSelector((state) => state.org);

    // UI
    const displayChoice = useSelector((state) => state.filters.collections.mode);
    const [loadedData, setLoadedData] = useState(false);

    // Data
    const [collections, setCollections] = useState([]);

    /**
     * Load collections from server.
     */
    useEffect(() => {
        getCollections();
    }, []);

    /**
     * Update the page title based on
     * Organization information.
     */
    useEffect(() => {
        if (process.env.REACT_APP_ORG_ID && process.env.REACT_APP_ORG_ID !== 'libretexts' && org.shortName) {
            document.title = org.shortName + " Commons | Collections";
        } else {
            document.title = "LibreCommons | Collections";
        }
    }, [org]);

    /**
     * Subscribe to changes in the URL search string
     * and update state accordingly.
     */
    useEffect(() => {
        var params = queryString.parse(location.search);
        if (params.mode && params.mode !== displayChoice) {
            if ((params.mode === 'visual') || (params.mode === 'itemized')) {
                dispatch({
                    type: 'SET_COLLECTIONS_MODE',
                    payload: params.mode
                });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search]);

    const getCollections = () => {
        axios.get('/commons/collections').then((res) => {
            if (!res.data.err) {
                if (res.data.colls && Array.isArray(res.data.colls) && res.data.colls.length > 0) {
                    setCollections(res.data.colls);
                    console.log(res.data.colls);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedData(true);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedData(true);
        });
    };

    const VisualMode = () => {
        if (collections.length > 0) {
            return (
                <Card.Group itemsPerRow={6} stackable>
                    {collections.map((item, index) => {
                        return (
                            <Popup key={index} content='Collections are coming soon!' position='top center' trigger={
                                <Card
                                    key={index}
                                >
                                    <Image
                                        className='commons-content-card-img'
                                        src={(item.coverPhoto === '') ? '/mini_logo.png' : item.coverPhoto}
                                        wrapped
                                        ui={false}
                                    />
                                    <Card.Content>
                                        <Card.Header>{item.title}</Card.Header>
                                        <Card.Meta>
                                            {item.resources} resources
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
        return (
            <Table celled>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell width={5}><Header sub>Name</Header></Table.HeaderCell>
                        <Table.HeaderCell width={11}><Header sub>Resources</Header></Table.HeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {(collections.length > 0) &&
                        collections.map((item, index) => {
                            return (
                                <Table.Row key={index}>
                                    <Table.Cell>
                                        <p><strong>{item.title}</strong></p>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <p>{item.resources} resources</p>
                                    </Table.Cell>
                                </Table.Row>
                            )
                        })
                    }
                    {(collections.length === 0) &&
                        <Table.Row>
                            <Table.Cell colSpan='2'>
                                <p className='text-center'><em>No results found.</em></p>
                            </Table.Cell>
                        </Table.Row>
                    }
                </Table.Body>
            </Table>
        )
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
                                            options={catalogDisplayOptions}
                                            onChange={(_e, { value }) => {
                                                history.push({
                                                    pathname: location.pathname,
                                                    search: updateParams(location.search, 'mode', value)
                                                });
                                            }}
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
                                                options={catalogDisplayOptions}
                                                onChange={(_e, { value }) => {
                                                    history.push({
                                                        pathname: location.pathname,
                                                        search: updateParams(location.search, 'mode', value)
                                                    });
                                                }}
                                                value={displayChoice}
                                            />
                                        </Grid.Column>
                                    </Grid.Row>
                                </Grid>
                            </Breakpoint>
                        </Segment>
                        <Segment className={(displayChoice === 'visual') ? 'commons-content' : 'commons-content commons-content-itemized'} loading={!loadedData}>
                            {(displayChoice === 'visual')
                                ? (<VisualMode />)
                                : (<ItemizedMode />)
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
