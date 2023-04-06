import { Label, Icon, Popup } from "semantic-ui-react";
import { User } from "../../types";
/**
 * Displays the appropriate text based on the user's status as a verified instructor
 */
const AccountStatus = ({ user }: { user: User }) => {
  if (user.isVerifiedInstructor) {
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
              A member of the LibreTexts team has verified your status as an
              instructor. You won't have to reverify, even if you move
              institutions.
            </p>
          }
        />
      </Label>
    );
  } else {
    return (
      <Label
        as="a"
        target="_blank"
        href="/accountrequest"
        aria-label="Unverified user, submit an account request (opens in new tab)"
        className="home-unverified-label"
      >
        <Popup
          trigger={<span>Unverified User</span>}
          position="top center"
          content={
            <p className="text-center">
              You haven't yet been verified as an instructor by the LibreTexts
              team. The LibreTexts team can verify you if you submit an Account
              Request. Your Conductor experience won't be impacted by this.
            </p>
          }
        />
      </Label>
    );
  }
};

export default AccountStatus;
