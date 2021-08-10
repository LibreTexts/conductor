import './Commons.css';

import { Link } from 'react-router-dom';
import { Menu, Image, Dropdown, Icon } from 'semantic-ui-react';
import React from 'react';

import Breakpoint from '../util/Breakpoints.js';

const CommonsNavbar = (_props) => {

    return (
        <div class='commons-navigation'>
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
                    <Image src='/transparent_logo.png' id='commons-mobilenav-logo' centered />
                </div>
            </Breakpoint>
        </div>
    )
}

export default CommonsNavbar;
