import { Alert } from '@libretexts/davis-react';
import React from 'react';


interface SystemAnnouncementProps {
  title: string;
  message: string;
}

/**
 * Displays a system-wide message, such as a notification of upcoming system maintenance.
 */
const SystemAnnouncement: React.FC<SystemAnnouncementProps> = ({ title, message }) => {
  return (
    <div className='px-6 xl:px-36 py-6'>
      <Alert variant='info' title={title} message={message} />
    </div>
  )
};

export default SystemAnnouncement;
