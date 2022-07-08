import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Menu } from 'semantic-ui-react';
import Breakpoint from '../../util/Breakpoints';
import './CommonsMenu.css';

/**
 * A menu providing navigation around the Commons interfaces.
 */
const CommonsMenu = ({ activeItem }) => {

  // Global State
  const org = useSelector((state) => state.org);

  const menuProps = {
    secondary: true,
    pointing: true,
    fluid: true,
    widths: (org.orgID === 'libretexts') ? 5 : 2,
    id: 'commons-menu',
    stackable: true,
  };
  const mobileMenuProps = {
    ...menuProps,
    pointing: false,
  };

  /**
   * Generates the menu options to present based on the instance's configured Organization.
   *
   * @returns {object[]} An array of objects containing identifier keys and corresponding UI text.
   */
  const generateMenuOptions = () => {
    const catalog = { key: 'catalog', text: 'Catalog' };
    const collections = { key: 'collections', text: 'Collections' };
    if (org.orgID === 'libretexts') {
      return [
        catalog,
        { key: 'libraries', text: 'Libraries' },
        collections,
        { key: 'homework', text: 'Homework' },
        { key: 'underdevelopment', text: 'Under Development' },
      ];
    }
    return [
      catalog,
      collections,
    ];
  };

  /**
   * Renders the available menu options for use in the menu.
   *
   * @returns {React.ReactElement[]} The rendered menu options.
   */
  const MenuOptions = () => {
    const options = generateMenuOptions();
    return options.map((item) => (
      <Menu.Item
        key={item.key}
        name={item.key}
        active={activeItem === item.key}
        className='commons-menu-item'
        as={Link}
        to={`/${item.key}`}
      >
        {item.text}
      </Menu.Item>
    ));
  };

  return (
    <>
      <Breakpoint name='tabletOrDesktop'>
        <Menu {...menuProps}>
          <MenuOptions />
        </Menu>
      </Breakpoint>
      <Breakpoint name='mobile'>
        <Menu {...mobileMenuProps}>
          <MenuOptions />
        </Menu>
      </Breakpoint>
    </>
  )
};

CommonsMenu.propTypes = {
  /**
   * The currently selected menu item key.
   */
  activeItem: PropTypes.string.isRequired,
};

CommonsMenu.defaultProps = {
  activeItem: 'catalog',
};

export default CommonsMenu;
