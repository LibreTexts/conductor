import React from 'react';
import PropTypes from 'prop-types';
import { Message, Icon } from 'semantic-ui-react';

/**
 * Displays a system-wide message, such as a notification of upcoming system maintenance.
 */
const SystemAnnouncement = ({ title, message }) => {
  return (
    <div className='mt-2p ml-2p mr-2p'>
      <Message icon info>
        <Icon name='info circle' />
        <Message.Content>
          <Message.Header>{title}</Message.Header>
          <p>{message}</p>
        </Message.Content>
      </Message>
    </div>
  )
};

SystemAnnouncement.propTypes = {
  /**
   * The title/headline of the announcement.
   */
  title: PropTypes.string.isRequired,
  /**
   * Further details about the announcement.
   */
  message: PropTypes.string.isRequired,
};

SystemAnnouncement.defaultProps = {};

export default SystemAnnouncement;
