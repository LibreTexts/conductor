import './Commons.css';

//import { Link } from 'react-router-dom';
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
import { useLocation, useHistory } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import queryString from 'query-string';

import Breakpoint from '../util/Breakpoints.js';
import useGlobalError from '../error/ErrorHooks.js';
import { catalogDisplayOptions } from '../util/CatalogOptions.js';
import { updateParams } from '../util/HelperFunctions.js';

const CommonsDirectory = (_props) => {

    const { handleGlobalError } = useGlobalError();

    // UI
    const [loadedData, setLoadedData] = useState(false);
    const [displayChoice, setDisplayChoice] = useState('visual');

    // Data
    const [directory, setDirectory] = useState([]);

    /**
     * Load directory from server.
     */
    useEffect(() => {
        document.title = "LibreCommons | Directory";
        getDirectory();
    }, []);

    const getDirectory = () => {
        axios.get('/commons/directory').then((res) => {
            if (!res.data.err) {
                if (res.data.directory && Array.isArray(res.data.directory)) {
                    setDirectory(res.data.directory);
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
        if (directory.length > 0) {
            return (
                <Card.Group itemsPerRow={6} stackable>
                    {directory.map((item, index) => {
                        return (
                            <Card
                                key={index}
                                as={Link}
                                to={`/directory/${item.key}`}
                            >
                                <Image
                                    className='commons-content-card-img'
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
                <p className='text-center'><em>No directory results are available right now.</em></p>
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
                    {(directory.length > 0) &&
                        directory.map((item, index) => {
                            return (
                                <Table.Row
                                    key={index}
                                >
                                    <Table.Cell>
                                        <p>
                                            <Link to={`/directory/${item.key}`}>
                                                <strong>{item.name}</strong>
                                            </Link>
                                        </p>
                                    </Table.Cell>
                                </Table.Row>
                            )
                        })
                    }
                    {(directory.length === 0) &&
                        <Table.Row>
                            <Table.Cell colSpan={1}>
                                <p className='text-center'><em>No directory results are available right now.</em></p>
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
                                    Directory
                                </Breadcrumb.Section>
                                <Breadcrumb.Divider icon='right chevron' />
                            </Breadcrumb>
                        </Segment>
                        <Segment>
                            <Breakpoint name='tabletOrDesktop'>
                                <div className='commons-content-pagemenu'>
                                    <div className='commons-content-pagemenu-left'>
                                        <Header as='h2'>Directory</Header>
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
                                            <Header as='h2' textAlign='center'>Directory</Header>
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

export default CommonsDirectory;
