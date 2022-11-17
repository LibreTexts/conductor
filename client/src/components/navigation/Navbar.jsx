import React, { useEffect, useState } from 'react';
import { Link, useLocation, useHistory } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Menu,
  Image,
  Dropdown,
  Icon,
  Button,
  Form
} from 'semantic-ui-react';
import { getLibGlyphURL } from '../util/LibraryOptions.js';
import AuthHelper from '../util/AuthHelper.js';
import Breakpoint from '../util/Breakpoints.jsx';
import withUserStateDependency from '../../enhancers/withUserStateDependency';
import './Navbar.css';

const Navbar = (_props) => {

  // Global State, Location, and Error Handling
  const location = useLocation();
  const history = useHistory();
  const user = useSelector((state) => state.user);
  const org = useSelector((state) => state.org);

  // UI
  const [activeItem, setActiveItem] = useState('');
  const [searchInput, setSearchInput] = useState('');

  /**
   * Subscribe to changes to location
   * and update the Navbar with the
   * active page.
   */
  useEffect(() => {
    const currentPath = location.pathname;
    if (currentPath.includes('/home')) {
      setActiveItem('home');
    } else if (currentPath.includes('/projects')) {
      setActiveItem('projects');
    } else if (currentPath.includes('analytics')) {
      setActiveItem('analytics');
    } else if (currentPath.includes('/search')) {
      // Set the search query in the UI if the URL was visited directly
      if (searchInput === '') {
        const urlParams = new URLSearchParams(location.search);
        const urlQuery = urlParams.get('query');
        if (typeof (urlQuery) === 'string' && urlQuery.length > 0) {
          setSearchInput(urlQuery);
        }
      }
    } else {
      setActiveItem('');
    }
  }, [location, setActiveItem, setSearchInput]);

  /**
   * Clear user information from the
   * global state, clear auth tokens
   * from the browser, then redirect
   * to main page.
   */
  const logOut = () => {
    AuthHelper.logout(user);
  };

  /**
   * Process the search string and, if non-empty, navigate to the Search Results page.
   */
  const handlePerformSearch = () => {
    if (searchInput.trim() !== '') {
      history.push(`/search?query=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  if (!user.isAuthenticated) {
    return null;
  }

  return (
    <Menu className='nav-menu' secondary>
      <Menu.Item
        as={Link}
        to='/home'
        header
        name='home'
        id='nav-logo-item'
        onClick={(_e, data) => {
          setActiveItem(data.name);
        }}
      >
        <Image
          src="https://cdn.libretexts.net/Logos/conductor_full.png"
          id="nav-logo"
          alt="LibreTexts Conductor"
        />
        {(org.orgID !== 'libretexts') &&
          <Image src={org.mediumLogo} id='nav-org-logo' />
        }
      </Menu.Item>
      <Menu.Item
        name='home'
        as={Link}
        to='/home'
        active={activeItem === 'home'}
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
      <Menu.Item
        name="analytics"
        as={Link}
        to="/analytics"
        active={activeItem === 'analytics'}
        onClick={(_e, data) => setActiveItem(data.name)}
      />
      <Breakpoint name='desktop'>
        <Menu.Menu position='right'>
          <Menu.Item>
            <Form onSubmit={handlePerformSearch} className='nav-search-form'>
              <Form.Input
                type='text'
                placeholder='Search...'
                onChange={(_e, { value }) => setSearchInput(value)}
                value={searchInput}
                action
                className='nav-search-input'
              >
                <input />
                {(searchInput.length > 0) && (
                  <Button
                    icon
                    type='reset'
                    onClick={() => setSearchInput('')}
                    aria-label='Clear Search Input'
                  >
                    <Icon name='x' />
                  </Button>
                )}
                <Button
                  type='submit'
                  color='blue'
                  icon
                  aria-label='Perform Search'
                >
                  <Icon name='search' />
                </Button>
              </Form.Input>
            </Form>
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
                <Dropdown.Item as='a' href='https://chat.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                  <Icon name='discord' />
                  Chat
                </Dropdown.Item>
                <Dropdown.Item as='a' href='https://groups.io/g/Libretexts-ConstructionForum' target='_blank' rel='noopener noreferrer'>
                  <Icon name='rss' />
                  Construction Forum
                </Dropdown.Item>
                <Dropdown.Item as='a' href='https://commons.libretexts.org/harvestrequest' target='_blank' rel='noopener noreferrer'>
                  <Icon name='plus' />
                  Harvesting Request
                </Dropdown.Item>
                <Dropdown.Item as='a' href='https://jupyter.libretexts.org/hub/login' target='_blank' rel='noopener noreferrer'>
                  <Icon name='server' />
                  JupyterHub
                </Dropdown.Item>
                <Dropdown.Item as='a' href='https://studio.libretexts.org/' target='_blank' rel='noopener noreferrer'>
                  <Icon name='puzzle' />
                  LibreStudio
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </Menu.Item>
          <Menu.Item as={Link} to="/">
            <Icon name="handshake outline" className="mr-05e" />
            <strong>Commons</strong>
          </Menu.Item>
          <Menu.Item>
            <Image src={`${user.avatar}`} avatar />
            <Dropdown inline text={user.firstName + ' ' + user.lastName}>
              <Dropdown.Menu>
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
      </Breakpoint>
      <Breakpoint name='mobileOrTablet'>
        <Menu.Menu position='right'>
          <Dropdown
            item
            as={Button}
            icon='align justify'
            className='icon'
            upward={false}
            size='medium'
          >
            <Dropdown.Menu>
              {/* TODO: Finish mobile menu */}
            </Dropdown.Menu>
          </Dropdown>
        </Menu.Menu>
      </Breakpoint>
    </Menu>
  )
}

export default withUserStateDependency(Navbar);
