import { Alert } from '@libretexts/davis-react';
import classNames from 'classnames';
import React from 'react';


interface SystemAnnouncementProps {
  title: string;
  message: string;
  className?: string;
}

/**
 * Displays a system-wide message, such as a notification of upcoming system maintenance.
 */
const SystemAnnouncement: React.FC<SystemAnnouncementProps> = ({ title, message, className }) => {
  return (
    <div className={classNames('px-6 xl:px-36 py-6', className)}>
      <Alert variant='info' title={title} message={message} />
    </div>
  )
};

export default SystemAnnouncement;
