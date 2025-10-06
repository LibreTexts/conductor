import { Label, Icon, Popup } from "semantic-ui-react";
import { User } from "../../types";
import useClientConfig from "../../hooks/useClientConfig";
/**
 * Displays the appropriate text based on the user's status as a verified instructor
 */
const AccountStatus = ({
  verifiedInstructor,
  thirdPerson,
}: {
  verifiedInstructor: boolean;
  thirdPerson?: boolean;
}) => {
  const { clientConfig, loading } = useClientConfig();

  if (loading) return null;

  if (verifiedInstructor) {
    return (
      <Label
        aria-label="User is a verified instructor"
        color="green"
        className="w-44"
      >
        <Popup
          trigger={
            <span>
              <Icon name="check circle outline" />
              Verified Instructor
            </span>
          }
          position="top center"
          content={
            <p className="text-center">
              A member of the LibreTexts team has verified{" "}
              {thirdPerson ? "their" : "your"} status as an instructor.{" "}
              {thirdPerson ? "They" : "You"} won't have to reverify, even if{" "}
              {thirdPerson ? "they" : "you"} move institutions.
            </p>
          }
        />
      </Label>
    );
  }

  if (!clientConfig?.instructor_verification_url) {
    return null;
  }

  return (
    <Label
      as="a"
      target="_blank"
      href={clientConfig.instructor_verification_url}
      aria-label="Unverified instructor, submit an Instructor Verification Request (opens in new tab)"
      className="w-44"
    >
      <Popup
        trigger={<span>Unverified Instructor</span>}
        position="top center"
        content={
          <p className="text-center">
            {thirdPerson ? "They" : "You"} haven't yet been verified as an
            instructor by the LibreTexts team. The LibreTexts team can verify{" "}
            {thirdPerson ? "them" : "you"} if {thirdPerson ? "they" : "you"}{" "}
            submit an Instructor Verification Request. The Conductor experience
            won't be impacted by this.
          </p>
        }
      />
    </Label>
  );
};

export default AccountStatus;
