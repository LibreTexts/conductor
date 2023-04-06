import { useState } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import { Segment, Divider, Form, Button, Icon, Modal } from "semantic-ui-react";
import AuthHelper from "../util/AuthHelper";
import { isEmptyString, validatePassword } from "../util/HelperFunctions";
import useGlobalError from "../error/ErrorHooks";
import { Account } from "../../types";

/**
 * The Account Security pane allows users to update their login and access information,
 * such as email and password.
 */
const AccountSecurity = ({
  account,
  onDataChange,
}: {
  account: Account;
  onDataChange: Function;
}) => {
  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  // UI
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);
  const [passChangeLoading, setPassChangeLoading] = useState(false);

  // Update Email Form
  const [email, setEmail] = useState("");
  const [emailErr, setEmailErr] = useState(false);
  const [showEmailUpdateSuccess, setShowEmailUpdateSuccess] = useState(false);

  // Change Password Form
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [currPassword, setCurrPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currPassErr, setCurrPassErr] = useState(false);
  const [newPassErr, setNewPassErr] = useState(false);

  /**
   * Resets any error states in the Change Password form.
   */
  function resetPasswordChangeErrors() {
    setCurrPassErr(false);
    setNewPassErr(false);
  }

  /**
   * Verifies all fields in the Change Password form are valid and sets error states if necessary.
   *
   * @returns {boolean} True if valid form, false otherwsie.
   */
  function validatePasswordChangeForm() {
    let validForm = true;
    if (isEmptyString(currPassword)) {
      validForm = false;
      setCurrPassErr(true);
    }
    if (!validatePassword(newPassword)) {
      validForm = false;
      setNewPassErr(true);
    }
    return validForm;
  }

  /**
   * Submits the password change to the server, then logs the user out and redirects them to
   * the Login screen on success.
   */
  async function submitPasswordChange() {
    resetPasswordChangeErrors();
    if (validatePasswordChangeForm()) {
      setPassChangeLoading(true);
      try {
        const changeRes = await axios.put("/auth/changepassword", {
          currentPassword: currPassword,
          newPassword: newPassword,
        });
        if (!changeRes.data.err) {
          AuthHelper.logout();
          window.location.assign("/login?passchange=true");
        } else {
          throw new Error(changeRes.data.errMsg);
        }
      } catch (e) {
        handleGlobalError(e);
      }
      setPassChangeLoading(false);
    }
  }

  /**
   * Validates the email change form, then submits the update to the server.
   */
  async function submitEmailChange() {
    setEmailErr(false);
    if (!isEmptyString(email)) {
      setEmailChangeLoading(true);
      try {
        const emailRes = await axios.put("/user/email", { email });
        if (!emailRes.data.err) {
          setShowEmailUpdateSuccess(true);
          onDataChange();
        } else {
          throw new Error(emailRes.data.errMsg);
        }
      } catch (e) {
        handleGlobalError(e);
      }
      setEmailChangeLoading(false);
    }
  }

  /**
   * Closes the Email Update Success modal.
   */
  function handleCloseEmailUpdateSuccess() {
    setShowEmailUpdateSuccess(false);
  }

  /**
   * Updates state with changes to the change email input.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - Event that activated the handler.
   */
  function handleEmailChange(e: any) {
    setEmail(e.target.value);
  }

  /**
   * Updates state with changes to the current password input.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - Event that activated the handler.
   */
  function handleCurrPassChange(e: any) {
    setCurrPassword(e.target.value);
  }

  /**
   * Updates state with changes to the new password input and performs real-time validation.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - Event that activated the handler.
   */
  function handleNewPassChange(e: any) {
    if (validatePassword(e.target.value)) {
      setNewPassErr(false);
    } else {
      setNewPassErr(true);
    }
    setNewPassword(e.target.value);
  }

  /**
   * Toggles the Show New Password setting in state.
   */
  function handleToggleShowNewPassword() {
    setShowNewPassword(!showNewPassword);
  }

  return (
    <Segment basic className="pane-segment">
      <h2>Security</h2>
      <Divider />
      {account.authType !== "Traditional" && (
        <p>
          <em>
            Your account information is managed by an external identity
            provider. To update these values, please use your SSO provider's
            methods.
          </em>
        </p>
      )}
      <Segment raised disabled={account.authType !== "Traditional"}>
        <h3>Update Email</h3>
        <p>
          <strong>Caution: </strong> Updating your email here will change the
          email you use to login to Conductor.
        </p>
        <Form noValidate>
          <Form.Field error={emailErr}>
            <label htmlFor="updateEmail"></label>
            <Form.Input
              id="updateEmail"
              name="updateEmail"
              type="email"
              placeholder="Email..."
              icon="mail"
              iconPosition="left"
              onChange={handleEmailChange}
              value={email}
            />
          </Form.Field>
          <Button
            color="green"
            fluid
            onClick={submitEmailChange}
            loading={emailChangeLoading}
          >
            <Icon name="save" />
            Save
          </Button>
        </Form>
      </Segment>
      <Segment raised disabled={account.authType !== "Traditional"}>
        <h3>Change Password</h3>
        <Form noValidate>
          <Form.Field error={currPassErr}>
            <label htmlFor="currentPassword">Current Password</label>
            <Form.Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              placeholder="Current Password..."
              icon="unlock"
              iconPosition="left"
              onChange={handleCurrPassChange}
              value={currPassword}
            />
          </Form.Field>
          <Form.Field error={newPassErr}>
            <label htmlFor="newPassword">
              New Password
              <span
                className="text-link float-right"
                onClick={handleToggleShowNewPassword}
              >
                {showNewPassword ? "Hide" : "Show"}
              </span>
            </label>
            <Form.Input
              id="newPassword"
              name="newPassword"
              type={showNewPassword ? "text" : "password"}
              placeholder="New Password..."
              icon="lock"
              iconPosition="left"
              onChange={handleNewPassChange}
              value={newPassword}
            />
            <p className="mt-2p mb-2p text-center">
              <em>
                Password must be longer than 8 characters and must contain at
                least one number. Never reuse passwords between sites.
              </em>
            </p>
            <p className="mt-2p mb-2p text-center">
              <strong>You will need to log in again after updating.</strong>
            </p>
          </Form.Field>
          <Button
            color="green"
            fluid
            onClick={submitPasswordChange}
            loading={passChangeLoading}
          >
            <Icon name="save" />
            Save
          </Button>
        </Form>
      </Segment>
      {/* Update Email Success Modal */}
      <Modal
        open={showEmailUpdateSuccess}
        onClose={handleCloseEmailUpdateSuccess}
      >
        <Modal.Header>Email Updated</Modal.Header>
        <Modal.Content scrolling>
          <p>Your email was updated succesfully!</p>
          <p>
            You can now use it to login to Conductor. Email notifications will
            now be sent to this address.
          </p>
        </Modal.Content>
        <Modal.Actions>
          <Button color="blue" onClick={handleCloseEmailUpdateSuccess}>
            Done
          </Button>
        </Modal.Actions>
      </Modal>
    </Segment>
  );
};

export default AccountSecurity;
