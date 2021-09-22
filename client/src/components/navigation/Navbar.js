import './Navbar.css';

import { Link, useLocation } from 'react-router-dom';
import {
    Menu,
    Image,
    Dropdown,
    Icon,
    Button,
    Input
} from 'semantic-ui-react';
import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';


import {
    getLibGlyphURL,
} from '../util/LibraryOptions.js';
import AuthHelper from '../util/AuthHelper.js';

const Navbar = (_props) => {

    // Global State and Location
    const location = useLocation();
    const dispatch = useDispatch();
    const user = useSelector((state) => state.user);
    const org = useSelector((state) => state.org);

    // Data fetch flags
    const loadedUser = useRef(false);

    // UI
    const [activeItem, setActiveItem] = useState('');
    //const [searchInput, setSearchInput] = useState('');

    /**
     * Check if the browser has an auth token.
     * (Updates global state var 'isAuthenticated')
     */
    useEffect(() => {
        dispatch({
            type: 'CHECK_AUTH'
        });
    }, [dispatch]);

    /**
     * Check if user is authenticated and if
     * user information has NOT been fetched,
     * retrieve it via GET request.
     */
    useEffect(() => {
        if (user.isAuthenticated && !loadedUser.current) {
            axios.get('/user/basicinfo').then((res) => {
                if (!res.data.err) {
                    if (res.data.user != null) {
                        dispatch({
                            type: 'SET_USER_INFO',
                            payload: {
                                firstName: res.data.user.firstName,
                                lastName: res.data.user.lastName,
                                avatar: res.data.user.avatar,
                                roles: res.data.user.roles
                            }
                        });
                        loadedUser.current = true;
                    } else {
                        console.log(res.data.errMsg);
                    }
                } else {
                    console.log(res.data.errMsg);
                }
            }).catch((err) => {
                if (err.response.data.tokenExpired !== true) {
                    alert("Oops, we encountered an error.");
                }
            });
        }
    }, [user.isAuthenticated, dispatch]);

    /**
     * Check if Organization info is already
     * in global store, otherwise
     * retrieve it via GET request.
     */
    useEffect(() => {
        if (org.orgID === '') {
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
        }
    }, [org, dispatch]);

    /**
     * Subscribe to changes to location
     * and update the Navbar with the
     * active page.
     */
    useEffect(() => {
        const currentPath = location.pathname;
        if (currentPath.includes('/dashboard')) {
            setActiveItem('dashboard');
        } else if (currentPath.includes('/harvesting')) {
            setActiveItem('harvesting');
        } else if (currentPath.includes('/projects')) {
            setActiveItem('projects');
        } else {
            setActiveItem('');
        }
    }, [location.pathname]);

    /**
     * Clear user information from the
     * global state, clear auth tokens
     * from the browser, then redirect
     * to main page.
     */
    const logOut = () => {
        AuthHelper.logout();
        window.location.assign('/');
    };

    /*
    const handleSearchClick = (e, data) => {
        if (searchInput.trim() !== '') {
            history.push('/search?query=' + encodeURIComponent(searchInput.trim()));
        }
    };

    const handleSearchInputChange = (e, data, props) => {
        setSearchInput(data.value);
    };
    */

    if (user.isAuthenticated) {
        return (
            <Menu className='nav-menu' secondary >
                <Menu.Item
                    as={Link}
                    to='/dashboard'
                    header
                    name='dashboard'
                    id='nav-logo-item'
                    onClick={(_e, data) => {
                        setActiveItem(data.name);
                    }}
                >
                    <Image src='/mini_logo.png' id='nav-logo' />
                    <span className='nav-title'>Conductor</span>
                    {(process.env.REACT_APP_ORG_ID !== 'libretexts') &&
                        <Image src={org.mediumLogo} id='nav-org-logo' />
                    }
                </Menu.Item>
                <Menu.Item
                    name='dashboard'
                    as={Link}
                    to='/dashboard'
                    active={activeItem === 'dashboard'}
                    onClick={(_e, data) => {
                        setActiveItem(data.name);
                    }}
                />
                <Menu.Item
                    name='projects'
                    as={Link}
                    to='/projects'
                    active={activeItem === 'projects'}
                    onClick={(_e, data) => {
                        setActiveItem(data.name);
                    }}
                />
                <Menu.Menu position='right'>
                    <Menu.Item>
                        <Input
                            disabled // TODO: implement search
                            type='text'
                            placeholder='Search...'
                            action={
                                <Button basic icon='search' />
                            }
                        />
                    </Menu.Item>
                    <Menu.Item>
                        <Icon name='book' />
                        <Dropdown inline text='Libraries'>
                            <Dropdown.Menu>
                                <Dropdown.Item as='a' href='https://bio.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Image src={getLibGlyphURL('bio')} className='nav-lib-glyph' />
                                    Biology
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://biz.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Image src={getLibGlyphURL('biz')} className='nav-lib-glyph' />
                                    Business
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://chem.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Image src={getLibGlyphURL('chem')} className='nav-lib-glyph' />
                                    Chemistry
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://eng.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Image src={getLibGlyphURL('eng')} className='nav-lib-glyph' />
                                    Engineering
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://espanol.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Image src={getLibGlyphURL('espanol')} className='nav-lib-glyph' />
                                    Español
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://geo.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Image src={getLibGlyphURL('geo')} className='nav-lib-glyph' />
                                    Geosciences
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://human.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Image src={getLibGlyphURL('human')} className='nav-lib-glyph' />
                                    Humanities
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://k12.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Image src={getLibGlyphURL('k12')} className='nav-lib-glyph' />
                                    K12 Education
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://math.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Image src={getLibGlyphURL('math')} className='nav-lib-glyph' />
                                    Mathematics
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://med.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Image src={getLibGlyphURL('med')} className='nav-lib-glyph' />
                                    Medicine
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://phys.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Image src={getLibGlyphURL('phys')} className='nav-lib-glyph' />
                                    Physics
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://socialsci.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Image src={getLibGlyphURL('socialsci')} className='nav-lib-glyph' />
                                    Social Science
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://stats.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Image src={getLibGlyphURL('stats')} className='nav-lib-glyph' />
                                    Statistics
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://workforce.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Image src={getLibGlyphURL('workforce')} className='nav-lib-glyph' />
                                    Workforce
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                    </Menu.Item>
                    <Menu.Item>
                        <Icon name='wrench' />
                        <Dropdown inline text='Tools'>
                            <Dropdown.Menu>
                                <Dropdown.Item as='a' href='https://adapt.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='pencil' />
                                    ADAPT Homework System
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://groups.io/g/Libretexts-ConstructionForum' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='rss' />
                                    Construction Forum
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://commons.libretexts.org/harvestrequest' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='plus' />
                                    Harvesting Request
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://imathas.libretexts.org/imathas/' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='percent' />
                                    IMathAS
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://jupyter.libretexts.org/hub/login' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='server' />
                                    JupyterHub
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://libremaps.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='map' />
                                    LibreMaps
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://studio.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='puzzle' />
                                    LibreStudio
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://webwork.libretexts.org/webwork2' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='laptop' />
                                    WeBWorK
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                    </Menu.Item>
                    <Menu.Item>
                        <Image src={`${user.avatar}`} avatar />
                        <Dropdown inline text={user.firstName + ' ' + user.lastName}>
                            <Dropdown.Menu>
                                {(user.isCampusAdmin || user.isSuperAdmin) &&
                                    <Dropdown.Item as={Link} to='/controlpanel'>
                                        <Icon name='dashboard' />
                                        Control Panel
                                    </Dropdown.Item>
                                }
                                {(user.isCampusAdmin || user.isSuperAdmin) &&
                                    <Dropdown.Divider />
                                }
                                <Dropdown.Item as={Link} to='/' >
                                    <Icon name='handshake' />
                                    {(process.env.REACT_APP_ORG_ID === 'libretexts')
                                        ? 'LibreCommons'
                                        : 'Campus Commons'
                                    }
                                </Dropdown.Item>
                                <Dropdown.Divider />
                                <Dropdown.Item as={Link} to='/account' >
                                    <Icon name='settings' />
                                    Settings
                                </Dropdown.Item>
                                <Dropdown.Item onClick={logOut}>
                                    <Icon name='log out' />
                                    Log out
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                    </Menu.Item>
                </Menu.Menu>
            </Menu>
        )
    } else {
        return (null);
    }
}

/*

*/

export default Navbar;
