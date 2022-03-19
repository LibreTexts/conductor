import './Commons.css';

import { Link, useLocation, Switch, Route } from 'react-router-dom';
import {
    Grid,
    Menu,
    Image,
    Modal,
    Button,
    Message,
    Icon
} from 'semantic-ui-react';
import React, { useEffect, useState, useCallback } from 'react';
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

    // System Announcement Message
    const [showSystemAnnouncement, setShowSystemAnnouncement] = useState(false);
    const [systemAnnouncementData, setSystemAnnouncementData] = useState({});


    /**
     * Retrieve information about the environment
     * Organization via GET request.
     */
    const getOrgInfo = useCallback(() => {
        axios.get('org/info', {
            params: {
                orgID: process.env.REACT_APP_ORG_ID
            }
        }).then((res) => {
            if (!res.data.err) {
                let orgData = res.data;
                delete orgData.err;
                console.log(orgData);
                dispatch({
                    type: 'SET_ORG_INFO',
                    payload: orgData
                });
            } else {
                console.error(res.data.errMsg); // fail silently
            }
        }).catch((err) => {
            console.error(err); // fail silently
        });
    }, [dispatch]);

    /**
     * Checks if a System Announcement is available and updates the UI accordingly if so.
     */
    const getSystemAnnouncement = useCallback(() => {
        axios.get('/announcements/system').then((res) => {
            if (!res.data.err) {
                if (res.data.sysAnnouncement !== null) {
                    setShowSystemAnnouncement(true);
                    setSystemAnnouncementData(res.data.sysAnnouncement);
                }
            } else {
                console.error(res.data.errMsg); // fail silently
            }
        }).catch((err) => {
            console.error(err); // fail silently
        });
    }, [setShowSystemAnnouncement, setSystemAnnouncementData]);

    /**
     * Initialization: Check that an OrgID is present, and if there are active
     * system announcements.
     */
    useEffect(() => {
        if (!process.env.REACT_APP_ORG_ID) setShowNoOrg(true);
        getSystemAnnouncement();
    }, [setShowNoOrg, getSystemAnnouncement]);

    /**
     * Retrieve Organization info if it missing.
     */
    useEffect(() => {
        if (org.orgID === '') getOrgInfo();
    }, [org, getOrgInfo]);

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
            {showSystemAnnouncement && (
                <div className='mt-2p ml-2p mr-2p'>
                    <Message icon info>
                        <Icon name='info circle' />
                        <Message.Content>
                            <Message.Header>{systemAnnouncementData.title}</Message.Header>
                            <p>{systemAnnouncementData.message}</p>
                        </Message.Content>
                    </Message>
                </div>
            )}
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
                {process.env.REACT_APP_ORG_ID === 'libretexts' &&
                    <Route exact path='/underdevelopment' component={CommonsUnderDevelopment} />
                }
                <Route exact path='/collection/:id' component={CommonsCollectionView} />
                <Route exact path='/book/:id' component={CommonsBook} />
            </Switch>
            <CommonsFooter />
            {/* No OrgID Modal */}
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
