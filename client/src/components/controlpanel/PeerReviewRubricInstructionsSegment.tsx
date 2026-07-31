import { Button, Divider } from "@libretexts/davis-react";

interface PeerReviewRubricInstructionsSegmentProps {
  show: boolean;
  toggleVisibility: () => void;
}

const PeerReviewRubricInstructionsSegment: React.FC<
  PeerReviewRubricInstructionsSegmentProps
> = ({ show, toggleVisibility }) => {
  if (!show) {
    return (
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800 m-0">
          Editing Instructions
        </h3>
        <Button variant="outline" onClick={toggleVisibility}>
          Show
        </Button>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between pb-3">
        <h3 className="text-base font-semibold text-gray-800 m-0">
          Editing Instructions
        </h3>
        <Button variant="outline" onClick={toggleVisibility}>
          Hide
        </Button>
      </div>
      <Divider className="mb-4" />
      <p className="mb-2">All Peer Review rubrics include by default:</p>
      <ul className="list-disc pl-5 mb-3 space-y-1 text-sm">
        <li>
          A <strong>First Name</strong> field{" "}
          <span className="text-gray-400">
            (collected automatically if logged into Conductor)
          </span>
        </li>
        <li>
          A <strong>Last Name</strong> field{" "}
          <span className="text-gray-400">
            (collected automatically if logged into Conductor)
          </span>
        </li>
        <li>
          An <strong>Email</strong> field{" "}
          <span className="text-gray-400">
            (collected automatically if logged into Conductor, not visible to
            others)
          </span>
        </li>
        <li>
          A <strong>Reviewer Type</strong> field{" "}
          <span className="text-gray-400">(Student or Instructor)</span>
        </li>
        <li>
          An <strong>Overall Rating</strong> (up to five stars) field
        </li>
      </ul>
      <p className="mb-2">
        A Peer Review rubric can consist of an unlimited number of the below
        blocks:
      </p>
      <ul className="list-disc pl-5 mb-3 space-y-1 text-sm">
        <li>
          <strong>Headings</strong> indicate different sections of the rubric
        </li>
        <li>
          <strong>Text Blocks</strong> allow you to insert rubric instructions
          or additional information
        </li>
        <li>
          <span>
            <strong>Prompts</strong> act as questions and inputs in the
            rubric. There are six different types of prompts:
          </span>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>
              <strong>Three Point Likert Scale: </strong> Radio choice
              between <em>Disagree, Neutral, Agree</em>
            </li>
            <li>
              <strong>Five Point Likert Scale: </strong> Radio choice between{" "}
              <em>Strongly Disagree, Disagree, Neutral, Agree, Strongly
              Agree</em>
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
              <span className="text-gray-400">(up to 10,000 characters)</span>
            </li>
            <li>
              <strong>Dropdown:</strong> Input requiring a selection between
              custom dropdown options{" "}
              <span className="text-gray-400">(up to 10 options)</span>
            </li>
            <li>
              <strong>Checkbox:</strong> Simple on/off checkbox{" "}
              <span className="text-gray-400">
                (setting 'Required' indicates the box must be checked to
                submit)
              </span>
            </li>
          </ul>
        </li>
      </ul>
      <p className="text-sm mb-2">
        Editing a Peer Review rubric <strong>will not</strong> affect
        previously submitted Peer Reviews: a snapshot of the rubric
        configuration is taken at the time of submission.
      </p>
      <p className="text-sm">
        Peer Reviews in "public" projects can be viewed by the public.{" "}
        <strong>
          Never use a Peer Review rubric to collect sensitive personal
          information.
        </strong>
      </p>
    </div>
  );
};

export default PeerReviewRubricInstructionsSegment;
