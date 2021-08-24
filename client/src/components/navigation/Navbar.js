import './Navbar.css';

import { Link, useLocation } from 'react-router-dom';
import { Menu, Image, Dropdown, Icon } from 'semantic-ui-react';
import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import Cookies from 'js-cookie';

const Navbar = (props) => {

    const location = useLocation();
    const dispatch = useDispatch();

    const user = useSelector((state) => state.user);

    const loadedUser = useRef(false);

    const [activeItem, setActiveItem] = useState('');
    //const [searchInput, setSearchInput] = useState('');

    useEffect(() => {
        dispatch({
            type: 'CHECK_AUTH'
        });
    }, [dispatch]);

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

    useEffect(() => {
        const currentPath = location.pathname;
        if (currentPath.includes('/dashboard')) {
            setActiveItem('dashboard');
        } else if (currentPath.includes('/harvesting')) {
            setActiveItem('harvesting');
        } else if (currentPath.includes('/projects')) {
            setActiveItem('projects');
        }
    }, [location]);

    const logOut = () => {
        dispatch({
            type: 'CLEAR_USER_INFO'
        });
        var domains = String(process.env.PRODUCTIONURLS).split(',');
        console.log(domains);
        Cookies.remove('access_token', { path: '/', domain: '.' + domains[0] });
        if (process.env.NODE_ENV === 'development') {
            Cookies.remove('access_token', { path: '/', domain: 'localhost' });
        }
        window.location.assign('/?src=logout');
    };

    const handleNavClick = (e, data) => {
        setActiveItem(data.name);
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

    var isAdmin = true;
    if (user.isAuthenticated) {
        return (
            <Menu className='nav-menu' secondary >
                <Menu.Item as={Link} to='/dashboard' header className='nav-logo-item' name='dashboard' onClick={handleNavClick}>
                    <Image src='/mini_logo.png' className='nav-logo' />
                    <span className='nav-title'>Conductor</span>
                </Menu.Item>
                <Menu.Item name='dashboard' as={Link} to='/dashboard' active={activeItem === 'dashboard'} onClick={handleNavClick} />
                <Menu.Item name='harvesting' as={Link} to='/harvesting' active={activeItem === 'harvesting'} onClick={handleNavClick} />
                <Menu.Item name='projects' as={Link} to='/projects' active={activeItem === 'projects'} onClick={handleNavClick} />
                <Menu.Menu position='right'>
                    <Menu.Item>
                        <Icon name='bookmark' />
                        <Dropdown inline text='Libraries'>
                            <Dropdown.Menu>
                                <Dropdown.Item as='a' href='https://bio.libretexts.org/' target='_blank'>
                                    <Icon name='dna' />
                                    Biology
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://biz.libretexts.org/' target='_blank'>
                                    <Icon name='dollar' />
                                    Business
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://chem.libretexts.org/' target='_blank'>
                                    <Icon name='flask' />
                                    Chemistry
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://eng.libretexts.org/' target='_blank'>
                                    <Icon name='wrench' />
                                    Engineering
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://espanol.libretexts.org/' target='_blank'>
                                    <Icon name='language' />
                                    Español
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://geo.libretexts.org/' target='_blank'>
                                    <Icon name='globe' />
                                    Geosciences
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://human.libretexts.org/' target='_blank'>
                                    <Icon name='address book' />
                                    Humanities
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://math.libretexts.org/' target='_blank'>
                                    <Icon name='subscript' />
                                    Mathematics
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://med.libretexts.org/' target='_blank'>
                                    <Icon name='first aid' />
                                    Medicine
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://phys.libretexts.org/' target='_blank'>
                                    <Icon name='rocket' />
                                    Physics
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://socialsci.libretexts.org/' target='_blank'>
                                    <Icon name='users' />
                                    Social Science
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://stats.libretexts.org/' target='_blank'>
                                    <Icon name='chart pie' />
                                    Statistics
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://workforce.libretexts.org/' target='_blank'>
                                    <Icon name='briefcase' />
                                    Workforce
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                    </Menu.Item>
                    <Menu.Item>
                        <Icon name='wrench' />
                        <Dropdown inline text='Tools'>
                            <Dropdown.Menu>
                                <Dropdown.Item as='a' href='https://adapt.libretexts.org/' target='_blank'>
                                    <Icon name='pencil' />
                                    ADAPT Homework System
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://groups.io/g/Libretexts-ConstructionForum' target='_blank'>
                                    <Icon name='rss' />
                                    Construction Forum
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://commons.libretexts.org/harvestrequest' target='_blank'>
                                    <Icon name='plus' />
                                    Harvesting Request
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://imathas.libretexts.org/imathas/' target='_blank'>
                                    <Icon name='percent' />
                                    IMathAS
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://jupyter.libretexts.org/hub/login' target='_blank'>
                                    <Icon name='server' />
                                    JupyterHub
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://libremaps.libretexts.org/' target='_blank'>
                                    <Icon name='map' />
                                    LibreMaps
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://studio.libretexts.org/' target='_blank'>
                                    <Icon name='puzzle' />
                                    LibreStudio
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://webwork.libretexts.org/webwork2' target='_blank'>
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
                                {isAdmin &&
                                    <Dropdown.Item as={Link} to='/supervisors'><Icon name='sitemap' />Supervisor Dashboard</Dropdown.Item>
                                }
                                {(isAdmin && process.env.REACT_APP_ORG_ID === 'libretexts') &&
                                    <div>
                                        <Dropdown.Item as={Link} to='/adoptionreports'><Icon name='file alternate' />Adoption Reports</Dropdown.Item>
                                        <Dropdown.Item as={Link} to='/harvestingrequests'><Icon name='file alternate' />Harvesting Requests</Dropdown.Item>
                                    </div>
                                }
                                <Dropdown.Divider />
                                <Dropdown.Item as={Link} to='/account/settings/' ><Icon name='settings' />Settings</Dropdown.Item>
                                <Dropdown.Item onClick={logOut}><Icon name='log out' />Log out</Dropdown.Item>
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
<Menu.Item>
    <Input
        type='text'
        placeholder='Search...'
        action={
            <Button basic onClick={handleSearchClick} icon='search' />
        }
        onChange={handleSearchInputChange}
    />
</Menu.Item>
*/

export default Navbar;
