import './Commons.css';

import { Link, useLocation, Switch, Route } from 'react-router-dom';
import {
    Grid,
    Menu,
    Image,
    Modal,
    Button,
    Message
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';

import Breakpoint from '../util/Breakpoints.jsx';

import CommonsNavbar from './CommonsNavbar.jsx';
import CommonsFooter from './CommonsFooter.jsx';

import CommonsCatalog from './CommonsCatalog.jsx';
import CommonsCollections from './CommonsCollections.jsx';
import CommonsCollectionView from './CommonsCollectionView.jsx';
import CommonsBook from './CommonsBook.jsx';
import CommonsHomework from './CommonsHomework.jsx';
import CommonsLibraries from './CommonsLibraries.jsx';
import CommonsLibraryEntry from './CommonsLibraryEntry.jsx';
import CommonsUnderDevelopment from './CommonsUnderDevelopment.jsx';

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
        } else if (currentPath.includes('/underdevelopment')) {
            setActiveItem('underdev');
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
                            <h1 id='commons-libresubheader'>Welcome to</h1>
                            <h1 id='commons-libreheader'>LibreCommons</h1>
                        </Grid.Column>
                    </Grid.Row>
                </Grid>
            )
        }
    };

    const menuContent = (
        <>
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
                <>
                    <Menu.Item
                        name='homework'
                        active={activeItem === 'homework'}
                        className='commons-menu-item'
                        as={Link}
                        to='/homework'
                    >
                        Homework
                    </Menu.Item>
                    <Menu.Item
                        name='underdev'
                        active={activeItem === 'underdev'}
                        className='commons-menu-item'
                        as={Link}
                        to='/underdevelopment'
                    >
                        Under Development
                    </Menu.Item>
                </>
            }
        </>
    );

    const menuProps = {
        secondary: true,
        pointing: true,
        fluid: true,
        widths: (process.env.REACT_APP_ORG_ID === 'libretexts') ? 5 : 2,
        id: 'commons-menu',
        stackable: true
    };

    const mobileMenuProps = {
        ...menuProps,
        pointing: false
    };

    return (
        <div className='commons'>
            <CommonsNavbar />
            <div id='commons-jumbotron' style={jumbotronStyle}>
                <Jumbotron />
            </div>
            <Breakpoint name='tabletOrDesktop'>
                <Menu {...menuProps}>
                    {menuContent}
                </Menu>
            </Breakpoint>
            <Breakpoint name='mobile'>
                <Menu {...mobileMenuProps}>
                    {menuContent}
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
                    <>
                        <Route exact path='/homework' component={CommonsHomework} />
                        <Route exact path='/libraries' component={CommonsLibraries} />
                        <Route exact path='/libraries/:lib' component={CommonsLibraryEntry} />
                        <Route exact path='/underdevelopment' component={CommonsUnderDevelopment} />
                    </>
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
