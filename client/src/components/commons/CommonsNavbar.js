import './Commons.css';

import { Link } from 'react-router-dom';
import { Menu, Image, Dropdown, Icon, Button } from 'semantic-ui-react';
import React, { useState } from 'react';
import { useSelector } from 'react-redux';

import Breakpoint from '../util/Breakpoints.js';

const CommonsNavbar = (_props) => {

    // Global State
    const org = useSelector((state) => state.org);

    // UI
    const [displayMobileMenu, setDisplayMobileMenu] = useState(false);
    //const [showMobileLibs, setShowMobileLibs] = useState(false);

    /**
     * Close the Mobile Menu.
     */
    const closeMobileMenu = () => {
        /*
        if (!displayMobileMenu === false) {
            setShowMobileLibs(false);
        }
        */
        setDisplayMobileMenu(!displayMobileMenu);
    }

    return (
        <div className='commons-navigation'>
            <Breakpoint name='tabletOrDesktop'>
                <Menu id='commons-nav' secondary>
                    <Menu.Item as={Link} to='/'>
                        <Image
                            src={org.mediumLogo}
                            id='commons-nav-logo'
                            alt={org.shortName}
                        />
                    </Menu.Item>
                    <Menu.Menu position='right' id='commons-nav-rightmenu'>
                        <Menu.Item
                            as='a'
                            href={org.aboutLink}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='commons-nav-link'
                        >
                            About {org.shortName}
                        </Menu.Item>
                        <Menu.Item
                            as={Link}
                            to='/login'
                            className='commons-nav-link'
                        >
                            Login to Conductor <Icon name='lightning' className='no-margin' />
                        </Menu.Item>
                    </Menu.Menu>
                </Menu>
            </Breakpoint>
            <Breakpoint name='mobile'>
                <div id='commons-mobilenav'>
                    <div id='commons-mobilenav-left'>
                        <Image
                            src={org.mediumLogo}
                            id='commons-mobilenav-logo'
                            alt={org.shortName}
                        />
                    </div>
                    <div id='commons-mobilenav-right'>
                        <Button
                            basic
                            circular
                            icon='bars'
                            onClick={closeMobileMenu}
                            aria-label='Navigation Menu'
                        />
                    </div>
                </div>
                {displayMobileMenu &&
                    <Menu vertical secondary pointing id='commons-mobilenav-menu'>
                        <Menu.Item
                            as='a'
                            href={org.aboutLink}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='commons-nav-link'
                        >
                            About {org.shortName}
                            <Icon name='external' className='float-right' />
                        </Menu.Item>
                        <Menu.Item
                            as={Link}
                            to='/login'
                            className='commons-nav-link'
                        >
                            Login to Conductor
                            <Icon name='lightning' className='float-right' />
                        </Menu.Item>
                    </Menu>
                }
            </Breakpoint>
        </div>
    )
}

export default CommonsNavbar;

/*
<Menu.Item onClick={() => { setShowMobileLibs(!showMobileLibs) }}>
    {(process.env.REACT_APP_ORG_ID === 'libretexts')
        ? 'Explore the Libraries'
        : 'Explore LibreTexts'
    }
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


<Dropdown item text={(process.env.REACT_APP_ORG_ID === 'libretexts') ? 'Explore the Libraries' : 'Explore LibreTexts'}>
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
*/
