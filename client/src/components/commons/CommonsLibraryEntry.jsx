import './Commons.css';

import { Link } from 'react-router-dom';
import {
    Grid,
    Segment,
    Header,
    List,
    Breadcrumb,
    Icon
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useHistory } from 'react-router-dom';
import Breakpoint from '../util/Breakpoints.tsx';
import axios from 'axios';

import useGlobalError from '../error/ErrorHooks';

const CommonsLibraryEntry = (props) => {

    const { handleGlobalError } = useGlobalError();

    // Data
    const [libName, setLibName] = useState('');
    const [libLink, setLibLink] = useState('');
    const [libShelves, setLibShelves] = useState([]);

    /** UI **/
    const [loadedData, setLoadedData] = useState(false);

    /**
     * Load shelves from server
     */
    useEffect(() => {
        getLibraryShelves();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Update the page title based on
     * Organization information.
     */
    useEffect(() => {
        if (libName !== '') {
            document.title = "LibreCommons | Libraries " + libName;
        } else {
            document.title = "LibreCommons | Libraries";
        }
    }, [libName]);

    const getLibraryShelves = () => {
        axios.get('/commons/libraries/shelves', {
            params: {
                libname: props.match.params.lib
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.libName) {
                    setLibName(res.data.libName);
                }
                if (res.data.libLink) {
                    setLibLink(res.data.libLink);
                }
                if (res.data.shelves && Array.isArray(res.data.shelves)) {
                    setLibShelves(res.data.shelves);
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

    return (
        <Grid className='commons-container'>
            <Grid.Row>
                <Grid.Column>
                    <Segment.Group raised>
                        <Segment>
                            <Breadcrumb>
                                <Breadcrumb.Section as={Link} to='/libraries'>
                                    <span>
                                        <span className='muted-text'>You are on: </span>
                                        Libraries
                                    </span>
                                </Breadcrumb.Section>
                                <Breadcrumb.Divider icon='right chevron' />
                                <Breadcrumb.Section active>
                                    {libName}
                                </Breadcrumb.Section>
                            </Breadcrumb>
                        </Segment>
                        <Segment>
                            <Breakpoint name='desktop'>
                                <Header size='large' as='h2'><a href={libLink} target='_blank' rel='noopener noreferrer'>{libName}</a></Header>
                            </Breakpoint>
                            <Breakpoint name='mobileOrTablet'>
                                <Header size='large' textAlign='center'><a href={libLink} target='_blank' rel='noopener noreferrer'>{libName}</a></Header>
                            </Breakpoint>
                        </Segment>
                        <Segment loading={!loadedData}>
                            {(libShelves.length > 0) &&
                                <List selection verticalAlign='middle'>
                                    {libShelves.map((item, idx) => {
                                        return (
                                            <List.Item
                                                key={idx}
                                            >
                                                <List.Content floated='right'>
                                                    <Icon name='external' />
                                                </List.Content>
                                                <List.Content>
                                                    <List.Header
                                                        as='a'
                                                        href={item.link}
                                                        target='_blank'
                                                        rel='noopener noreferrer'
                                                    >
                                                        {item.name}
                                                    </List.Header>
                                                </List.Content>
                                            </List.Item>
                                        )
                                    })}
                                </List>
                            }
                            {(libShelves.length === 0) &&
                                <p className='mt-2r mb-2r'><em>No entries available right now.</em></p>
                            }
                        </Segment>
                    </Segment.Group>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )
}

export default CommonsLibraryEntry;
