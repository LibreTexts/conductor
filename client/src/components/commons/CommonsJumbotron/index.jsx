import React from 'react';
import PropTypes from 'prop-types';
import './CommonsJumbotron.css';

/**
 * The Jumbotron is displayed at the top of the Commons interfaces, featuring an Organization's
 * preferred background image.
 */
const CommonsJumbotron = ({ backgroundURL }) => {

  const style = {
    backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.15)), url(${backgroundURL})`,
  };

  return (
    <div id="commons-jumbotron" style={style}></div>
  )
};

CommonsJumbotron.propTypes = {
  /**
   * A URL pointing to an image to use as the Jumbotron background.
   */
  backgroundURL: PropTypes.string.isRequired,
};

CommonsJumbotron.defaultProps = {};

export default CommonsJumbotron;
