import React from 'react';
import PropTypes from 'prop-types';
import './CommonsJumbotron.css';

/**
 * The Jumbotron is displayed at the top of the Commons interfaces, display information about
 * the instance Organization over their preferred background image.
 */
const CommonsJumbotron = ({ mainHeader, subHeader, backgroundURL }) => {

  const style = {
    backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45)), url(${backgroundURL})`,
  };

  return (
    <div id="commons-jumbotron" style={style}>
      <div>
        <h1 id="commons-libreheader">
          <span id="commons-libreheader-sub">{subHeader}</span>
          <span id="commons-libreheader-main">{mainHeader}</span>
        </h1>
      </div>
    </div>
  )
};

CommonsJumbotron.propTypes = {
  /**
   * The display title of the Organization's Commons.
   */
  mainHeader: PropTypes.string.isRequired,
  /**
   * Short text to display above the main header.
   */
  subHeader: PropTypes.string.isRequired,
  /**
   * A URL pointing to an image to use as the Jumbotron background.
   */
  backgroundURL: PropTypes.string.isRequired,
};

CommonsJumbotron.defaultProps = {};

export default CommonsJumbotron;
