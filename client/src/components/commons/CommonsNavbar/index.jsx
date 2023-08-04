import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import axios from 'axios';
import { Menu, Image, Dropdown, Icon, Button } from 'semantic-ui-react';
import Breakpoint from '../../util/Breakpoints';
import './CommonsNavbar.css';

const CommonsNavbar = ({
  org,
  user,
  commonsTitle,
  showMobileMenu,
  showMobileCommonsList,
  onMobileMenuToggle,
  onMobileCommonsListToggle,
}) => {

  // Data
  const [campusCommons, setCampusCommons] = useState([]);

  /**
   * Retrieves a list of LibreGrid/Campus Commons instances from the server and saves it to state.
   */
  const getCampusCommons = useCallback(async () => {
    try {
      const commonsRes = await axios.get('/orgs/libregrid');
      if (!commonsRes.data.err) {
        if (Array.isArray(commonsRes.data.orgs)) {
          const orgs = [...commonsRes.data.orgs].map((item) => ({
            key: item.orgID,
            name: item.name,
            link: item.domain,
          }));
          setCampusCommons(orgs);
        }
      } else {
        throw (new Error(commonsRes.data.errMsg));
      }
    } catch (e) {
      console.warn('Error retrieving Campus Commons list:');
      console.warn(e);
    }
  }, [setCampusCommons]);

  /**
   * Load the list of Campus Commons if running on the LibreCommons server.
   */
  useEffect(() => {
    if (org.orgID === 'libretexts') {
      getCampusCommons();
    }
  }, [org.orgID, getCampusCommons]);

  /**
   * Renders a styled About "Organization" menu option depending on the screen size.
   *
   * @param {Object} props - Render options.
   * @param {boolean} [props.isMobile=false] - Render link for mobile displays.
   * @returns {React.ReactElement} The rendered About "Organization" link. 
   */
  const AboutOrgLink = ({ isMobile = false }) => {
    return (
      <Menu.Item
        as="a"
        href={org.aboutLink}
        target="_blank"
        rel="noopener"
        className="commons-nav-link"
      >
        About {org.shortName}
        {isMobile && (
          <Icon name="external" className="float-right" />
        )}
      </Menu.Item>
    )
  };

  /**
   * Renders a styled Instructor Account Request menu option depending on the screen size.
   *
   * @param {Object} props - Render options.
   * @param {boolean} [props.isMobile=false] - Render link for mobile displays. 
   * @returns {React.ReactElement} The rendered Account Request link.
   */
  const AccountRequestLink = ({ isMobile = false }) => {
    return (
      <Menu.Item
        as={Link}
        to="/verification/instructor"
        target="_blank"
        rel="noreferrer"
        className="commons-nav-link"
      >
        Instructor Verification Request
        {isMobile && (
          <Icon name="share alternate" className="float-right" />
        )}
      </Menu.Item>
    )
  };


  /**
   * Renders a list of the Campus Commons in the LibreGrid, using different elements
   * depending on display size.
   *
   * @param {Object} props - Render options.
   * @param {boolean} [props.isMobile=false] - Render the list for mobile displays. 
   * @returns {React.ReactElement[]} The rendered Commons List.
   */
  const CommonsList = ({ isMobile = false }) => {
    if (campusCommons.length === 0) {
      return null;
    }

    const items = campusCommons.map((inst) => ({
      ...inst,
      props: {
        key: inst.key,
        as: 'a',
        href: inst.link,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    }));

    if (isMobile) {
      return (
        <Menu.Menu id="commons-mobilenav-libmenu">
          {items.map((item) => (
            <Menu.Item {...item.props}>
              <Icon name="university" />
              {item.name}
            </Menu.Item>
          ))}
        </Menu.Menu>
      )
    }
    return (
      <Dropdown item text="Campus Commons" id="commons-nav-campusdropdown">
        <Dropdown.Menu direction="left">
          {items.map((item) => (
            <Dropdown.Item {...item.props}>
              <Icon name="university" />
              {item.name}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    );
  };

  /**
   * Renders the proper Conductor access menu option depending on the user
   * authentication state and the screen size.
   * 
   * @param {Object} props - Render options.
   * @param {boolean} [props.isMobile=false] - Render the option for mobile displays. 
   * @returns {React.ReactElement} The rendered Conductor access option.
   */
  const ConductorOption = ({ isMobile = false }) => {
    if (user.isAuthenticated) {
      return (
        <Menu.Item
          as={Link}
          to="/home"
          className="commons-nav-link"
          style={!isMobile ? ({ padding: '.4em' }) : undefined}
          aria-label="Back to Conductor"
        >
          {isMobile ? (
            <div className="flex-row-div">
              <div className="left-flex">
                <span><strong>Conductor</strong></span>
              </div>
              <div className="right-flex">
                <Image src={`${user.avatar}`} avatar id="commons-nav-mobileavatar" />
              </div>
            </div>
          ) : (
            <>
              <Image src={`${user.avatar}`} avatar />
              <span><strong>Conductor</strong></span>
            </>
          )}
        </Menu.Item>
      );
    }
    return (
      <Menu.Item
        as={Link}
        to="/login"
        className="commons-nav-link"
      >
        Login to Conductor <Icon name="lightning" className="float-right" />
      </Menu.Item>
    );
  };

  /**
   * Calls the passed mobile menu toggle function, if valid. 
   */
  const handleMobileMenuToggle = () => {
    if (typeof (onMobileMenuToggle) === 'function') {
      onMobileMenuToggle();
    }
  };

  /**
   * Calls the passed mobile menu commons list toggle function, if valid.
   */
  const handleMobileCommonsListToggle = () => {
    if (typeof (onMobileCommonsListToggle) === 'function') {
      onMobileCommonsListToggle();
    }
  };

  return (
    <div className="commons-navigation">
      <Breakpoint name="desktop">
        <Menu id="commons-nav" secondary>
          <h1 className="sr-only">{commonsTitle}</h1>
          <Menu.Item as={Link} to="/">
            <Image
              src={org.mediumLogo}
              id="commons-nav-logo"
              alt=""
            />
            <span className="sr-only">{commonsTitle} Catalog Home</span>
          </Menu.Item>
          <Menu.Menu position="right" id="commons-nav-rightmenu">
            <AboutOrgLink />
            {(org.orgID === 'libretexts') && (
              <>
                <AccountRequestLink />
                <CommonsList />
              </>
            )}
            <ConductorOption />
          </Menu.Menu>
        </Menu>
      </Breakpoint>
      <Breakpoint name="mobileOrTablet">
        <div id="commons-mobilenav">
          <h1 className="sr-only">{commonsTitle}</h1>
          <div id="commons-mobilenav-left">
            <Image
              src={org.mediumLogo}
              id="commons-mobilenav-logo"
              alt=""
            />
          </div>
          <div id="commons-mobilenav-right">
            <Button
              basic
              circular
              icon={showMobileMenu ? 'close' : 'bars'}
              onClick={handleMobileMenuToggle}
              aria-label="Navigation Menu"
            />
          </div>
        </div>
        {showMobileMenu && (
          <Menu vertical secondary pointing id="commons-mobilenav-menu">
            <AboutOrgLink isMobile={true} />
            {(org.orgID === 'libretexts') && (
              <>
                <AccountRequestLink isMobile={true} />
                <Menu.Item onClick={handleMobileCommonsListToggle}>
                  Campus Commons
                  {showMobileCommonsList ? (
                    <Icon name="angle up" className="float-right" />
                  ) : (
                    <Icon name="angle down" className="float-right" />
                  )}
                </Menu.Item>
              </>
            )}
            {((org.orgID === 'libretexts') && showMobileCommonsList) && (
              <CommonsList isMobile={true} />
            )}
            <ConductorOption isMobile={true} />
          </Menu>
        )}
      </Breakpoint>
    </div>
  )
};

CommonsNavbar.propTypes = {
  /**
   * Information about the instance's configured Organization.
   */
  org: PropTypes.shape({
    orgID: PropTypes.string.isRequired,
    shortName: PropTypes.string.isRequired,
    mediumLogo: PropTypes.string.isRequired,
    aboutLink: PropTypes.string.isRequired,
  }).isRequired,
  /**
   * Information about the currently authenticated Conductor user, if applicable.
   */
  user: PropTypes.shape({
    isAuthenticated: PropTypes.bool,
    avatar: PropTypes.string,
  }),
  /**
   * Display meta-title of the current Commons, such as 'Campus Commons'.
   */
  commonsTitle: PropTypes.string.isRequired,
  /**
   * Whether to show or hide the menu (on mobile displays).
   */
  showMobileMenu: PropTypes.bool,
  /**
   * Whether to show or hide the list of public commons in the (mobile display) menu.
   */
  showMobileCommonsList: PropTypes.bool,
  /**
   * Handler for (mobile display) menu toggle events.
   */
  onMobileMenuToggle: PropTypes.func.isRequired,
  /**
   * Handler for (mobile display) public commons list toggle events.
   */
  onMobileCommonsListToggle: PropTypes.func.isRequired,
};

CommonsNavbar.defaultProps = {
  showMobileMenu: false,
  showMobileCommonsList: false,
};

export default CommonsNavbar;
