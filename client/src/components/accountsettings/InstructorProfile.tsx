import { Button, Divider, Icon, Segment } from "semantic-ui-react";
import { getCentralAuthInstructorURL } from "../../utils/centralIdentityHelpers";

const InstructorProfile = () => {
  return (
    <Segment basic className="pane-segment">
      <h2>Instructor Profile</h2>
      <Divider />
      <p>
        {`LibreTexts uses your Instructor Profile to verify your identity and status at an academic
       institution when you submit an `}
        <a href={getCentralAuthInstructorURL()} target="_blank">
          Instructor Verification Request
        </a>
        .
      </p>
      <Button
        as="a"
        href={getCentralAuthInstructorURL()}
        target="_blank"
        color="blue"
        fluid
      >
        <Icon name="external" />
        Edit Instructor Profile in LibreOne
      </Button>
    </Segment>
  );
};

export default InstructorProfile;
