import { FC, useEffect } from "react";
import {
  Button,
  Form,
  Divider,
  Header,
  Popup,
  Icon,
  Dropdown,
} from "semantic-ui-react";
import { Link } from "react-router-dom";
import { InstructorVerifReq, User } from "../../types";
import { useForm } from "react-hook-form";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { required } from "../../utils/formRules";
import { libraries } from "../util/LibraryOptions";

const applications = [
  {
    id: 1,
    key: "ADAPT",
    text: "ADAPT",
    value: "ADAPT",
  },
  {
    id: 2,
    key: "studio",
    text: "LibreTexts Studio",
    value: "studio",
  },
  {
    id: 3,
    key: "libraries",
    text: "LibreTexts Libraries",
    value: "libraries",
  },
  {
    id: 4,
    key: "WeBWorK",
    text: "WeBWork",
    value: "webwork",
  },
];

interface InstructorVerifReqFormProps
  extends React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  > {
  user: User;
}

const InstructorVerifReqForm: FC<InstructorVerifReqFormProps> = ({
  user,
  ...rest
}) => {
  const { control, getValues, setValue, watch } = useForm<InstructorVerifReq>({
    defaultValues: {
      status: "not_attempted",
      bioURL: "",
      registrationCode: "",
      apps: [],
      libraries: [],
    },
  });

  return (
    <div {...rest}>
      <div className="py-1e px-05e">
        <Header as="h3">About Instructor Verification</Header>
        <p className="mt-1r">
          Anyone can access and read the full LibreTexts content - no additional
          verfication or accounts are necessary.
          <strong>
            {" "}
            This verification process is only for instructors
          </strong>{" "}
          who wish to create custom textbooks for their class or who want to
          upload new content to the LibreTexts Libraries, Studio, or ADAPT
          homework system.
        </p>
        <p className="mt-2e">
          Verification is required to modify content on the LibreTexts libraries
          including editing pages, uploading content, creating new Course
          Shells, and remixing customized textbooks. Verification is also
          required to create and modify content on Studio, create courses and
          assignments on the ADAPT homework system, or use Analytics on
          Conductor.
        </p>
        <p className="mt-2e">
          Upon approval, you should receive a notification from LibreTexts
          Conductor. Further details regarding accessing instructor features
          will be provided in the notification. Please check your junk/spam
          folder if you do not receive them.
        </p>
      </div>
      <Divider />
      <div className="py-1e px-05e">
        <Header as="h3">Completing the Request Form</Header>
        <p>
          To verify instructor status you must provide a link to a web page
          showing your faculty status. Links to your institution's web page are
          NOT sufficient. A URL which shows that you are an instructor is
          needed. Please provide your complete name, department and status
          otherwise we will not be able to approve your application.
        </p>
        <p className="mt-2e">
          <em>
            This information will be saved to your Conductor account's
            Instructor Profile. You can update it anytime in {` `}
            <Link to="/account/instructorprofile">Account Settings</Link>.
          </em>
        </p>
      </div>
      <Divider />
      <div className="py-1e px-05e">
        <Header as="h3">Request Form</Header>
        <Form noValidate>
          <Form.Field required>
            <label htmlFor="bioURL">
              <span>Bio URL</span>
              <Popup
                content={
                  <span>
                    Link to your faculty entry on your institution's website (or
                    other URL that shows your faculty status)
                  </span>
                }
                trigger={<Icon className="ml-025e" name="info circle" />}
              />
            </label>
            <CtlTextInput
              control={control}
              name="bioURL"
              placeholder="http://www.example.com/yourfacultyprofile"
              rules={required}
              required
            />
          </Form.Field>
          <Form.Field className="mt-2e">
            <label htmlFor="registrationCode">
              <span>Registration Code</span>
              <Popup
                content={
                  <span>
                    If you have a registration code, please enter it here. This
                    is not required.
                  </span>
                }
                trigger={<Icon className="ml-025e" name="info circle" />}
              />
            </label>
            <CtlTextInput
              control={control}
              name="registrationCode"
              placeholder="Registration Code (if applicable)"
            />
          </Form.Field>
          <Form.Field className="mt-2e" required>
            <label htmlFor="apps">
              <span>Applications</span>
              <Popup
                content={
                  <span>
                    Select the applications you are currently requesting access
                    to. This can be changed later.
                  </span>
                }
                a
                trigger={<Icon className="ml-025e" name="info circle" />}
              />
            </label>
            <Dropdown
              name="apps"
              value={watch("apps")}
              onChange={(e, { value }) => {
                setValue("apps", (value as string[]) ?? []);
              }}
              placeholder="Select Applications"
              fluid
              options={applications}
              multiple
              selection
            />
          </Form.Field>
          <Form.Field className="mt-2e">
            <label htmlFor="libraries">
              <span>Libraries (max 3)</span>
              <Popup
                content={
                  <span>
                    Select the LibreTexts libraries you are currently requesting
                    access to. This can be changed later. A maximum of 3
                    libraries can be selected.
                  </span>
                }
                trigger={<Icon className="ml-025e" name="info circle" />}
              />
            </label>
            <Dropdown
              name="libraries"
              value={watch("libraries")}
              onChange={(e, { value }) => {
                if ((value as string[]).length > 3) return;
                setValue("libraries", (value as string[]) ?? []);
              }}
              placeholder="Select Libraries"
              fluid
              options={libraries}
              multiple
              selection
              error={getValues("libraries").length > 3}
            />
          </Form.Field>
        </Form>
        <Button type="submit" color="blue" size="large" fluid className="mt-2e">
          Submit Request
        </Button>
      </div>
    </div>
  );
};

export default InstructorVerifReqForm;
