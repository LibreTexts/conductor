import { Button, Divider } from "@libretexts/davis-react";
import { useTypedSelector } from "../../../state/hooks";

interface EventInstructionsSegmentProps {
  show: boolean;
  toggleVisibility: () => void;
}

const EventInstructionsSegment: React.FC<EventInstructionsSegmentProps> = ({
  show,
  toggleVisibility,
}) => {
  const org = useTypedSelector((state) => state.org);

  if (!show) {
    return (
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800 m-0">Editing Instructions</h3>
        <Button variant="outline" onClick={toggleVisibility}>Show</Button>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between pb-3">
        <h3 className="text-base font-semibold text-gray-800 m-0">Editing Instructions</h3>
        <Button variant="outline" onClick={toggleVisibility}>Hide</Button>
      </div>
      <Divider className="mb-4" />
      <p className="mb-2">All Events include by default:</p>
      <ul className="list-disc pl-5 mb-3 space-y-1 text-sm">
        <li><strong>Title</strong></li>
        <li><strong>Registration Open Date</strong></li>
        <li><strong>Registration Close Date</strong></li>
        <li><strong>Event Start Date</strong></li>
        <li><strong>Event End Date</strong></li>
        {org.orgID === "libretexts" && (
          <li><strong>Registration Fee</strong></li>
        )}
      </ul>
      <p className="mb-2">An Event registration form can consist of an unlimited number of the below blocks:</p>
      <ul className="list-disc pl-5 mb-3 space-y-1 text-sm">
        <li><strong>Headings</strong> indicate different sections of the form</li>
        <li><strong>Text Blocks</strong> allow you to insert form instructions or additional information</li>
        <li>
          <span>
            <strong>Prompts</strong> act as questions and inputs in the form. There are six different types of prompts:
          </span>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li><strong>Three Point Likert Scale: </strong> Radio choice between <em>Disagree, Neutral, Agree</em></li>
            <li><strong>Five Point Likert Scale: </strong> Radio choice between <em>Strongly Disagree, Disagree, Neutral, Agree, Strongly Agree</em></li>
            <li><strong>Seven Point Likert Scale: </strong> Radio choice between <em>Strongly Disagree, Disagree, Somewhat Disagree, Neutral, Somewhat Agree, Agree, Strongly Agree</em></li>
            <li><strong>Text:</strong> Free-response textual input <span className="text-gray-400">(up to 10,000 characters)</span></li>
            <li><strong>Dropdown:</strong> Input requiring a selection between custom dropdown options <span className="text-gray-400">(up to 10 options)</span></li>
            <li><strong>Checkbox:</strong> Simple on/off checkbox <span className="text-gray-400">(setting 'Required' indicates the box must be checked to submit)</span></li>
          </ul>
        </li>
      </ul>
      <p className="text-sm mb-2">
        Events are <strong>only editable until the first participant has registered.</strong> Once participants have began registering for the event, you can only cancel the event if it has been misconfigured. Individual participants can be dropped from the event if necessary.
      </p>
      <p className="text-sm">
        <strong>Never use an event registration form to collect sensitive personal information.</strong>
      </p>
    </div>
  );
};

export default EventInstructionsSegment;
