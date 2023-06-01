import { Segment, Button, Header, SegmentProps } from "semantic-ui-react";
import { useTypedSelector } from "../../../state/hooks";

interface EventInstructionsSegmentProps extends SegmentProps {
  show: boolean;
  toggleVisibility: () => void;
}

const EventInstructionsSegment: React.FC<EventInstructionsSegmentProps> = ({
  show,
  toggleVisibility,
  ...rest
}) => {
  const org = useTypedSelector((state) => state.org);

  if (!show) {
    return (
      <Segment {...rest}>
        <div className="hiddensection">
          <div className="header-container">
            <Header as="h3">Editing Instructions</Header>
          </div>
          <div className="button-container">
            <Button floated="right" onClick={toggleVisibility}>
              Show
            </Button>
          </div>
        </div>
      </Segment>
    );
  }

  return (
    <Segment {...rest} className="mb-1p">
      <div className="ui dividing header">
        <div className="hideablesection">
          <h3 className="header">Editing Instructions</h3>
          <div className="button-container">
            <Button compact floated="right" onClick={toggleVisibility}>
              Hide
            </Button>
          </div>
        </div>
      </div>
      <p>All Events include by default:</p>
      <ul>
        <li>
          A <strong>Title</strong>
        </li>
        <li>
          A <strong>Registration Open Date</strong>
        </li>
        <li>
          A <strong>Registration Close Date</strong>
        </li>
        <li>
          An <strong>Event Start Date</strong>
        </li>
        <li>
          An <strong>Event End Date</strong>
        </li>
        {org.orgID === "libretexts" && (
          <li>
            A <strong>Registration Fee</strong>
          </li>
        )}
      </ul>
      <p>
        An Event registration form can consist of an unlimited number of the
        below blocks:
      </p>
      <ul>
        <li>
          <strong>Headings</strong> indicate different sections of the form
        </li>
        <li>
          <strong>Text Blocks</strong> allow you to insert form instructions or
          additional information
        </li>
        <li>
          <span>
            <strong>Prompts</strong> act as questions and inputs in the form.
            There are six different types of prompts:
          </span>
          <ul>
            <li>
              <strong>Three Point Likert Scale: </strong> Radio choice between{" "}
              <em>Disagree, Neutral, Agree</em>
            </li>
            <li>
              <strong>Five Point Likert Scale: </strong> Radio choice between{" "}
              <em>
                Strongly Disagree, Disagree, Neutral, Agree, Strongly Agree
              </em>
            </li>
            <li>
              <strong>Seven Point Likert Scale: </strong> Radio choice between{" "}
              <em>
                Strongly Disagree, Disagree, Somewhat Disagree, Neutral,
                Somewhat Agree, Agree, Strongly Agree
              </em>
            </li>
            <li>
              <strong>Text:</strong> Free-response textual input{" "}
              <span className="muted-text">(up to 10,000 characters)</span>
            </li>
            <li>
              <strong>Dropdown:</strong> Input requiring a selection between
              custom dropdown options{" "}
              <span className="muted-text">(up to 10 options)</span>
            </li>
            <li>
              <strong>Checkbox:</strong> Simple on/off checkbox{" "}
              <span className="muted-text">
                (setting 'Required' indicates the box must be checked to submit)
              </span>
            </li>
          </ul>
        </li>
      </ul>
      <p>
        Events are{" "}
        <strong>
          only editable until the first participant has registered.
        </strong>{" "}
        Once participants have began registering for the event, you can only
        cancel the event if it has been misconfigured. Individual participants
        can be dropped from the event if necessary.
      </p>
      <p>
        <strong>
          Never use an event registration form to collect sensitive personal
          information.
        </strong>
      </p>
    </Segment>
  );
};

export default EventInstructionsSegment;
