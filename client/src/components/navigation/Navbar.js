import './Navbar.css';

import { Link, useLocation } from 'react-router-dom';
import { Menu, Image, Dropdown, Icon } from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import axios from 'axios';

import { useUserState } from '../../providers.js';

const Navbar = (props) => {

    const location = useLocation();

    const [{firstName, lastName, isAuthenticated, roles}, dispatch] = useUserState();

    const [activeItem, setActiveItem] = useState('');
    //const [searchInput, setSearchInput] = useState('');

    useEffect(() => {
        dispatch({
            type: 'CHECK_LOCAL_TOKEN'
        });
    }, [dispatch]);

    useEffect(() => {
        if (isAuthenticated) {
            axios.get('/user/basicinfo').then((res) => {
                if (!res.data.err) {
                    if (res.data.user != null) {
                        dispatch({
                            type: 'SET_USER_INFO',
                            firstName: res.data.user.firstName,
                            lastName: res.data.user.lastName,
                            avatar: res.data.user.avatar,
                            roles: res.data.user.roles
                        });
                    } else {
                        console.log(res.data.errMsg);
                    }
                } else {
                    console.log(res.data.errMsg);
                }
            }).catch((err) => {
                if (err.response.data.tokenIsExp) {
                    dispatch({
                        type: 'CLEAR_USER_INFO'
                    });
                    dispatch({
                        type: 'CLEAR_LOCAL_DATA'
                    });
                    window.location.assign('/login?src=expired');
                }
            });
        }
    }, [isAuthenticated, dispatch]);

    useEffect(() => {
        const currentPath = window.location.pathname;
        if (currentPath.includes('/dashboard')) {
            setActiveItem('dashboard');
        } else if (currentPath.includes('/harvesting')) {
            setActiveItem('harvesting');
        } else if (currentPath.includes('/development')) {
            setActiveItem('development');
        } else if (currentPath.includes('/admin')) {
            setActiveItem('administration');
        } else {
            setActiveItem('dashboard');
        }
    }, [location]);

    const logOut = () => {
        dispatch({
            type: 'CLEAR_USER_INFO'
        });
        dispatch({
            type: 'CLEAR_LOCAL_DATA'
        });
        window.location.assign('/login');
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

    var isHarvest = roles.includes('harvest');
    var isDev = roles.includes('dev');
    var isAdmin = roles.includes('admin');
    if (isAuthenticated) {
        return (
            <Menu className='nav-menu' secondary >
                <Menu.Item as={Link} to='/' header className='nav-logo-item' name='dashboard' onClick={handleNavClick}>
                    <Image src='/libretexts_logo.png' className='nav-logo' />
                    <span className='nav-title'>PTS</span>
                </Menu.Item>
                <Menu.Item name='dashboard' as={Link} to ='/' active={activeItem === 'dashboard'} onClick={handleNavClick} />
                <Menu.Item name='harvesting' as={(isHarvest || isAdmin) ? Link : ''} to ='/harvesting' active={activeItem === 'harvesting'} onClick={handleNavClick} disabled={!(isHarvest || isAdmin)} />
                <Menu.Item name='development' as={(isDev || isAdmin) ? Link : ''} to ='/development' active={activeItem === 'development'} onClick={handleNavClick} disabled={!(isDev || isAdmin)} />
                <Menu.Item name='administration' as={isAdmin ? Link : ''} to ='/admin' active={activeItem === 'administration'} onClick={handleNavClick} disabled={!isAdmin}/>
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
                        <Icon name='user' />
                        <Dropdown inline text={firstName + ' ' + lastName}>
                            <Dropdown.Menu>
                                {isAdmin &&
                                    <Dropdown.Item as={Link} to='/supervisors' ><Icon name='sitemap' />Supervisor Dashboard</Dropdown.Item>
                                }
                                <Dropdown.Item as={Link} to='/account/settings/' ><Icon name='settings' />Account Settings</Dropdown.Item>
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
