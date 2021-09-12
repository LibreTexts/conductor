import './Commons.css';

import { Link, useLocation, Switch, Route } from 'react-router-dom';
import {
    Grid,
    Menu,
    Image,
    Icon,
    Modal,
    Button,
    Message
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';

import Breakpoint from '../util/Breakpoints.js';

import CommonsNavbar from './CommonsNavbar.js';
import CommonsFooter from './CommonsFooter.js';

import CommonsCatalog from './CommonsCatalog.js';
import CommonsCollections from './CommonsCollections.js';
import CommonsCollectionView from './CommonsCollectionView.js';
import CommonsBook from './CommonsBook.js';
import CommonsHomework from './CommonsHomework.js';
import CommonsLibraries from './CommonsLibraries.js';
import CommonsLibraryEntry from './CommonsLibraryEntry.js';

const Commons = (_props) => {

    // Global State and Location
    const location = useLocation();
    const dispatch = useDispatch();
    const org = useSelector((state) => state.org);

    // UI
    const [activeItem, setActiveItem] = useState('');
    const [showNoOrg, setShowNoOrg] = useState(false);

    /**
     * Verify the application has an ORG_ID
     * environment variable, show a
     * warning message otherwise.
     */
    useEffect(() => {
        if (!process.env.REACT_APP_ORG_ID) {
            setShowNoOrg(true);
        }
    }, []);

    /**
     * Run getOrgInfo() if information is missing.
     */
    useEffect(() => {
        if (org.orgID === '') {
            getOrgInfo();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [org]);

    /**
     * Retrieve information about the environment
     * Organization via GET request.
     */
    const getOrgInfo = () => {
        axios.get('org/info', {
            params: {
                orgID: process.env.REACT_APP_ORG_ID
            }
        }).then((res) => {
            if (!res.data.err) {
                var orgData = res.data;
                delete orgData.err;
                dispatch({
                    type: 'SET_ORG_INFO',
                    payload: orgData
                });
            } else {
                console.log(res.data.errMsg);
            }
        }).catch((err) => {
            console.log(err);
        });
    };

    /**
     * Subscribe to changes to location
     * and update the Menu with the
     * active page.
     */
    useEffect(() => {
        const currentPath = location.pathname;
        if (currentPath === '/') {
            setActiveItem('catalog');
        } else if (currentPath.includes('/catalog')) {
            setActiveItem('catalog');
        } else if (currentPath.includes('/collection')) {
            setActiveItem('collections');
        } else if (currentPath.includes('/homework')) {
            setActiveItem('homework');
        } else if (currentPath.includes('/libraries')) {
            setActiveItem('libraries');
        } else {
            setActiveItem('catalog');
        }
    }, [location.pathname]);

    const jumbotronStyle = {
        backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(' + org.coverPhoto + ')'
    };

    const Jumbotron = () => {
        if (process.env.REACT_APP_ORG_ID !== 'libretexts') {
            return (
                <div id='commons-jumbotron-inner'>
                    <Image id='commons-jumbotron-logo' src={org.largeLogo} centered />
                    <h1 id='commons-header'>Campus Commons</h1>
                </div>
            )
        } else {
            return (
                <Grid>
                    <Grid.Row>
                        <Grid.Column>
                            <h3 id='commons-libresubheader'>WELCOME TO</h3>
                            <h1 id='commons-libreheader'>LibreCommons</h1>
                        </Grid.Column>
                    </Grid.Row>
                </Grid>
            )
        }
    };

    return (
        <div className='commons'>
            <CommonsNavbar />
            <div id='commons-jumbotron' style={jumbotronStyle}>
                <Jumbotron />
            </div>
            <Breakpoint name='tabletOrDesktop'>
                <div id='commons-menu'>
                    <div id='commons-menu-center'>
                        <Menu secondary pointing fluid widths={(process.env.REACT_APP_ORG_ID === 'libretexts') ? 4 : 2} id='commons-menu-pointing'>
                            <Menu.Item
                                name='catalog'
                                active={activeItem === 'catalog'}
                                className='commons-menu-item'
                                as={Link}
                                to='/catalog'
                            >
                                Catalog
                            </Menu.Item>
                            {(process.env.REACT_APP_ORG_ID === 'libretexts') &&
                                <Menu.Item
                                    name='libraries'
                                    active={activeItem === 'libraries'}
                                    className='commons-menu-item'
                                    as={Link}
                                    to='/libraries'
                                >
                                    Libraries
                                </Menu.Item>
                            }
                            <Menu.Item
                                name='collections'
                                active={activeItem === 'collections'}
                                className='commons-menu-item'
                                as={Link}
                                to='/collections'
                            >
                                Collections
                            </Menu.Item>
                            {(process.env.REACT_APP_ORG_ID === 'libretexts') &&
                                <Menu.Item
                                    name='homework'
                                    active={activeItem === 'homework'}
                                    className='commons-menu-item'
                                    as={Link}
                                    to='/homework'
                                >
                                    Homework
                                </Menu.Item>
                            }
                        </Menu>
                    </div>
                </div>
            </Breakpoint>
            <Breakpoint name='mobile'>
                <Menu id='commons-mobilemenu' pointing secondary labeled='icon' fluid widths={(process.env.REACT_APP_ORG_ID === 'libretexts') ? 4 : 2}>
                    <Menu.Item
                        name='catalog'
                        active={activeItem === 'catalog'}
                        className='commons-menu-item'
                        as={Link}
                        to='/catalog'
                    >
                        Catalog
                    </Menu.Item>
                    {(process.env.REACT_APP_ORG_ID === 'libretexts') &&
                        <Menu.Item
                            name='libraries'
                            active={activeItem === 'libraries'}
                            className='commons-menu-item'
                            as={Link}
                            to='/libraries'
                        >
                            Libraries
                        </Menu.Item>
                    }
                    <Menu.Item
                        name='collections'
                        active={activeItem === 'collections'}
                        className='commons-menu-item'
                        as={Link}
                        to='/collections'
                    >
                        Collections
                    </Menu.Item>
                    {(process.env.REACT_APP_ORG_ID === 'libretexts') &&
                        <Menu.Item
                            name='homework'
                            active={activeItem === 'homework'}
                            className='commons-menu-item'
                            as={Link}
                            to='/homework'
                        >
                            Homework
                        </Menu.Item>
                    }
                </Menu>
            </Breakpoint>
            {(process.env.REACT_APP_INT_MAINT === 'true') &&
                <Message
                    info
                    className='mt-2p ml-1p mr-1p'
                >
                    <Message.Header>Maintenance in Progress</Message.Header>
                    <Message.Content>
                        <span>This site is currently undergoing background maintenance. You may experience intermittent service interruptions. This message will disappear when maintenance is complete.</span>
                    </Message.Content>
                </Message>
            }
            <Switch>
                <Route exact path='/' component={CommonsCatalog} />
                <Route exact path='/catalog' component={CommonsCatalog} />
                <Route exact path='/collections' component={CommonsCollections} />
                {process.env.REACT_APP_ORG_ID === 'libretexts' &&
                    <Route exact path='/homework' component={CommonsHomework} />
                }
                {process.env.REACT_APP_ORG_ID === 'libretexts' &&
                    <Route exact path='/libraries' component={CommonsLibraries} />
                }
                {process.env.REACT_APP_ORG_ID === 'libretexts' &&
                    <Route exact path='/libraries/:lib' component={CommonsLibraryEntry} />
                }
                <Route exact path='/collection/:id' component={CommonsCollectionView} />
                <Route exact path='/book/:id' component={CommonsBook} />
            </Switch>
            <CommonsFooter />
            <Modal
                onClose={() => { setShowNoOrg(false) }}
                open={showNoOrg}
            >
                <Modal.Header>LibreTexts Conductor Platform: Error</Modal.Header>
                <Modal.Content>
                    <Modal.Description>
                        <p>It appears you are using a Conductor instance that is missing an Organization identifier.</p>
                        <p><strong>This may lead to unexpected or faulty behavior.</strong></p>
                    </Modal.Description>
                </Modal.Content>
                <Modal.Actions>
                    <Button negative onClick={() => { setShowNoOrg(false) }}>Bypass</Button>
                </Modal.Actions>
            </Modal>
        </div>
    )
}

export default Commons;
