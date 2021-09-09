import './Commons.css';

import {
    Grid,
    Segment,
    Header,
    Card,
    Image,
    Dropdown,
    Table,
    Breadcrumb
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

import Breakpoint from '../util/Breakpoints.js';
import useGlobalError from '../error/ErrorHooks.js';
import { catalogDisplayOptions } from '../util/CatalogOptions.js';

const CommonsLibraries = (_props) => {

    const { handleGlobalError } = useGlobalError();

    // UI
    const [loadedData, setLoadedData] = useState(false);
    const [displayChoice, setDisplayChoice] = useState('visual');

    // Data
    const [libraries, setLibraries] = useState([]);

    /**
     * Load directory from server.
     */
    useEffect(() => {
        document.title = "LibreCommons | Libraries";
        getLibraries();
    }, []);

    const getLibraries = () => {
        axios.get('/commons/libraries/main').then((res) => {
            if (!res.data.err) {
                console.log(res.data);
                if (res.data.libs && Array.isArray(res.data.libs)) {
                    setLibraries(res.data.libs);
                }
                setLoadedData(true);
            } else {
                handleGlobalError(res.data.errMsg);
            }
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedData(true);
        });
    };

    const VisualMode = () => {
        if (libraries.length > 0) {
            return (
                <Card.Group stackable centered>
                    {libraries.map((item, index) => {
                        return (
                            <Card
                                key={index}
                                as={Link}
                                to={`/libraries/${item.key}`}
                                className='commons-library-card'
                            >
                                <Image
                                    className='commons-library-card-img'
                                    src={(!item.thumbnail || item.thumbnail === '') ? '/mini_logo.png' : item.thumbnail}
                                    wrapped
                                    ui={false}
                                />
                                <Card.Content>
                                    <Card.Header>{item.name}</Card.Header>
                                </Card.Content>
                            </Card>
                        )
                    })}
                </Card.Group>
            )
        } else {
            return (
                <p className='text-center'><em>No library results are available right now.</em></p>
            )
        }
    };

    const ItemizedMode = () => {
        return (
            <Table celled>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell><Header sub>Name</Header></Table.HeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {(libraries.length > 0) &&
                        libraries.map((item, index) => {
                            return (
                                <Table.Row
                                    key={index}
                                >
                                    <Table.Cell>
                                        <p>
                                            <Link to={`/libraries/${item.key}`}>
                                                <strong>{item.name}</strong>
                                            </Link>
                                        </p>
                                    </Table.Cell>
                                </Table.Row>
                            )
                        })
                    }
                    {(libraries.length === 0) &&
                        <Table.Row>
                            <Table.Cell colSpan={1}>
                                <p className='text-center'><em>No library results are available right now.</em></p>
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
                            <Breadcrumb>
                                <Breadcrumb.Section active>
                                    Libraries
                                </Breadcrumb.Section>
                                <Breadcrumb.Divider icon='right chevron' />
                            </Breadcrumb>
                        </Segment>
                        <Segment>
                            <Breakpoint name='tabletOrDesktop'>
                                <div className='commons-content-pagemenu'>
                                    <div className='commons-content-pagemenu-left'>
                                        <Header as='h2'>Libraries</Header>
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
                                                setDisplayChoice(value);
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
                                            <Header as='h2' textAlign='center'>Libraries</Header>
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
                                                    setDisplayChoice(value);
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

export default CommonsLibraries;
