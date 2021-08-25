import './Commons.css';

import { Link } from 'react-router-dom';
import { Menu, Image, Dropdown, Icon, Button } from 'semantic-ui-react';
import React, { useState } from 'react';

import Breakpoint from '../util/Breakpoints.js';

const CommonsNavbar = (_props) => {

    // UI
    const [displayMobileMenu, setDisplayMobileMenu] = useState(false);
    const [showMobileLibs, setShowMobileLibs] = useState(false);

    /**
     * Close the Mobile Menu and
     * Mobile Libraries dropdown.
     */
    const closeMobileMenu = () => {
        if (!displayMobileMenu === false) {
            setShowMobileLibs(false);
        }
        setDisplayMobileMenu(!displayMobileMenu);
    }

    return (
        <div className='commons-navigation'>
            <Breakpoint name='tabletOrDesktop'>
                <Menu id='commons-nav' secondary>
                    <Menu.Item as={Link} to='/'>
                        <Image src='/transparent_logo.png' id='commons-nav-logo' />
                    </Menu.Item>
                    <Menu.Menu position='right' id='commons-nav-rightmenu'>
                        <Menu.Item as='a' href='https://www.libretexts.org' target='_blank' rel='noopener noreferrer'>
                            LibreTexts.org
                        </Menu.Item>
                        <Dropdown item text='Explore the Libraries'>
                            <Dropdown.Menu>
                                <Dropdown.Item as='a' href='https://bio.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='dna' />
                                    Biology
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://biz.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='dollar' />
                                    Business
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://chem.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='flask' />
                                    Chemistry
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://eng.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='wrench' />
                                    Engineering
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://espanol.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='language' />
                                    Español
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://geo.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='globe' />
                                    Geosciences
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://human.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='address book' />
                                    Humanities
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://math.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='subscript' />
                                    Mathematics
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://med.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='first aid' />
                                    Medicine
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://phys.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='rocket' />
                                    Physics
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://socialsci.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='users' />
                                    Social Science
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://stats.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='chart pie' />
                                    Statistics
                                </Dropdown.Item>
                                <Dropdown.Item as='a' href='https://workforce.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                    <Icon name='briefcase' />
                                    Workforce
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                    </Menu.Menu>
                </Menu>
            </Breakpoint>
            <Breakpoint name='mobile'>
                <div id='commons-mobilenav'>
                    <div id='commons-mobilenav-left'>
                        <Image src='/transparent_logo.png' id='commons-mobilenav-logo' />
                    </div>
                    <div id='commons-mobilenav-right'>
                        <Button basic circular icon='bars' onClick={closeMobileMenu} />
                    </div>
                </div>
                {displayMobileMenu
                    ? (
                        <Menu vertical secondary pointing id='commons-mobilenav-menu'>
                            <Menu.Item as='a' href='https://www.libretexts.org' target='_blank' rel='noopener noreferrer'>
                                LibreTexts.org
                                <Icon name='external' className='float-right' />
                            </Menu.Item>
                            <Menu.Item onClick={() => { setShowMobileLibs(!showMobileLibs) }}>
                                Explore the Libraries
                                {showMobileLibs
                                    ? (
                                        <Icon name='angle up' className='float-right' />
                                    )
                                    : (
                                        <Icon name='angle down' className='float-right' />
                                    )
                                }
                            </Menu.Item>
                            {showMobileLibs &&
                                <Menu.Menu id='commons-mobilenav-libmenu'>
                                    <Menu.Item as='a' href='https://bio.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                        <Icon name='dna' />
                                        Biology
                                    </Menu.Item>
                                    <Menu.Item as='a' href='https://biz.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                        <Icon name='dollar' />
                                        Business
                                    </Menu.Item>
                                    <Menu.Item as='a' href='https://chem.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                        <Icon name='flask' />
                                        Chemistry
                                    </Menu.Item>
                                    <Menu.Item as='a' href='https://eng.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                        <Icon name='wrench' />
                                        Engineering
                                    </Menu.Item>
                                    <Menu.Item as='a' href='https://espanol.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                        <Icon name='language' />
                                        Español
                                    </Menu.Item>
                                    <Menu.Item as='a' href='https://geo.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                        <Icon name='globe' />
                                        Geosciences
                                    </Menu.Item>
                                    <Menu.Item as='a' href='https://human.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                        <Icon name='address book' />
                                        Humanities
                                    </Menu.Item>
                                    <Menu.Item as='a' href='https://math.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                        <Icon name='subscript' />
                                        Mathematics
                                    </Menu.Item>
                                    <Menu.Item as='a' href='https://med.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                        <Icon name='first aid' />
                                        Medicine
                                    </Menu.Item>
                                    <Menu.Item as='a' href='https://phys.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                        <Icon name='rocket' />
                                        Physics
                                    </Menu.Item>
                                    <Menu.Item as='a' href='https://socialsci.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                        <Icon name='users' />
                                        Social Science
                                    </Menu.Item>
                                    <Menu.Item as='a' href='https://stats.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                        <Icon name='chart pie' />
                                        Statistics
                                    </Menu.Item>
                                    <Menu.Item as='a' href='https://workforce.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                                        <Icon name='briefcase' />
                                        Workforce
                                    </Menu.Item>
                                </Menu.Menu>
                            }
                        </Menu>
                    )
                    : (null)
                }
            </Breakpoint>
        </div>
    )
}

export default CommonsNavbar;
