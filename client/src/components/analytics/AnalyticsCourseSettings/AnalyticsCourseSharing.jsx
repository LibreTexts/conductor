import React from 'react';
import { Divider, Icon, Message, Segment } from 'semantic-ui-react';

/**
 * An interface to manage access control for an Analytics Course.
 */
const AnalyticsCourseSharing = () => {
  return (
    <Segment basic className="pane-segment">
      <h2>Sharing and Access Control</h2>
      <Divider />
      <Message info icon className="mt-1e mb-2e">
        <Icon name="magic" />
        <Message.Content>
          <Message.Header>Coming Soon</Message.Header>
          <p>Stay tuned, this feature will be here soon!</p>
        </Message.Content>
      </Message>
    </Segment>
  );
};

export default AnalyticsCourseSharing;
