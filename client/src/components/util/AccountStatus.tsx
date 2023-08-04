import { Label, Icon, Popup } from "semantic-ui-react";
import { User } from "../../types";
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
  if (verifiedInstructor) {
    return (
      <Label aria-label="User is a verified instructor" color="green">
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
  return (
    <Label
      as="a"
      target="_blank"
      href="/verification/instructor"
      aria-label="Unverified user, submit an Instructor Verfication Request (opens in new tab)"
      className="home-unverified-label"
    >
      <Popup
        trigger={<span>Unverified User</span>}
        position="top center"
        content={
          <p className="text-center">
            {thirdPerson ? "They" : "You"} haven't yet been verified as an
            instructor by the LibreTexts team. The LibreTexts team can verify{" "}
            {thirdPerson ? "them" : "you"} if {thirdPerson ? "they" : "you"}{" "}
            submit an Instructor Verification Request. The Conductor experience won't be
            impacted by this.
          </p>
        }
      />
    </Label>
  );
};

export default AccountStatus;
