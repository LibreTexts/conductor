import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Button,
  Card,
  Divider,
  Form,
  Header,
  Icon,
  Image,
  Label,
  Modal,
  Popup,
  Segment,
} from "semantic-ui-react";
import { normalizeURL, truncateString } from "../util/HelperFunctions";
import { useTypedSelector } from "../../state/hooks";
import useGlobalError from "../error/ErrorHooks";
import { Account } from "../../types";
import AccountStatus from "../util/AccountStatus";

/**
 * The Instructor Profile pane displays the user's saved Instructor Status Verification data and
 * allows them to update or remove their status verification.
 */
const InstructorProfile = ({
  account,
  onDataChange,
}: {
  account: Account;
  onDataChange: Function;
}) => {
  const DEFAULT_AVATAR = "/mini_logo.png";

  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  const user = useTypedSelector((state) => state.user);

  // UI
  const [loading, setLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Data
  const [verifiedStatus, setVerifiedStatus] = useState(false);

  // Edit Instructor Profile Modal
  const [institution, setInstitution] = useState("");
  const [facultyURL, setFacultyURL] = useState("");
  const [institutionErr, setInstitutionErr] = useState(false);
  const [facultyURLErr, setFacultyURLErr] = useState(false);

  /**
   * Set state based on passed props.
   */
  useEffect(() => {
    if (account.verifiedInstructor) {
      setVerifiedStatus(true);
    }
  }, [account, setVerifiedStatus]);

  /**
   * Resets any error states in the Edit Instructor Profile form.
   */
  function resetEditFormErrors() {
    setInstitutionErr(false);
    setFacultyURLErr(false);
  }

  /**
   * Validates all fields in the Edit Instructor Profile form and sets error states if necessary.
   *
   * @returns {boolean} True if all valid, false otherwise.
   */
  function validateEditForm() {
    let validForm = true;
    // Allow unsetting, but both must be completed at once
    if (
      institution.length > 100 ||
      (institution.length === 0 && facultyURL.length > 0)
    ) {
      setInstitutionErr(true);
      validForm = false;
    }
    if (institution.length > 0 && facultyURL.length === 0) {
      setFacultyURLErr(true);
      validForm = false;
    }
    return validForm;
  }

  /**
   * Submits the Instructor Profile update to the server, then closes the Edit Instructor
   * Profile modal.
   */
  async function submitEditProfile() {
    resetEditFormErrors();
    if (validateEditForm()) {
      setLoading(true);
      try {
        const updateRes = await axios.put("/user/instructorprofile", {
          institution,
          facultyURL,
        });
        if (!updateRes.data.err) {
          setLoading(false);
          handleCloseEditProfile();
          onDataChange();
        } else {
          throw new Error(updateRes.data.errMsg);
        }
      } catch (e) {
        setLoading(false);
        handleGlobalError(e);
      }
    }
  }

  /**
   * Opens the Edit Instructor Profile modal.
   */
  function handleOpenEditProfile() {
    if (!(account && account.instructorProfile)) return;

    if (account.instructorProfile.institution) {
      setInstitution(account.instructorProfile.institution);
    }
    if (account.instructorProfile.facultyURL) {
      setFacultyURL(account.instructorProfile.facultyURL);
    }
    resetEditFormErrors();
    setShowEditModal(true);
  }

  /**
   * Closes the Edit Instructor Profile modal.
   */
  function handleCloseEditProfile() {
    setShowEditModal(false);
  }

  /**
   * Receives input value changes from UI elements and saves them to their respective
   * spaces in state.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - Event that activated the handler.
   */
  function handleInputChange(e: any) {
    switch (e.target.id) {
      case "institution":
        setInstitution(e.target.value);
        break;
      case "facultyURL":
        setFacultyURL(e.target.value);
        break;
      default:
        break;
    }
  }

  return (
    <Segment basic className="pane-segment" loading={loading}>
      <h2>Instructor Profile</h2>
      <Divider />
      <p>
        {`LibreTexts uses your Instructor Profile to verify your identity and status at an academic
       institution when you submit an `}
        <Link to="/accountrequest">Account Request</Link>. If you need to update
        your information, you can do so below.
      </p>
      <Card raised fluid className="mt-1e mb-2e">
        <Card.Content>
          <div className="flex-row-div">
            <div className="left-flex">
              <Image avatar src={account?.avatar || DEFAULT_AVATAR} alt="" />
              <span className="ml-05e text-header">
                {account?.firstName} {account?.lastName}
              </span>
            </div>
            <div className="right-flex">
              <AccountStatus verifiedInstructor={user.verifiedInstructor} />
            </div>
          </div>
          <Card.Description className="mt-1e">
            <p>
              <Header sub as="span">
                Institution:
              </Header>
              {account?.instructorProfile?.institution ? (
                <span> {account.instructorProfile.institution}</span>
              ) : (
                <span>
                  <em> Not set</em>
                </span>
              )}
            </p>
            <p>
              <Header sub as="span">
                Verification URL:
              </Header>{" "}
              {account?.instructorProfile?.facultyURL ? (
                <a
                  href={normalizeURL(account.instructorProfile.facultyURL)}
                  target="_blank"
                  rel="noreferrer"
                  className="word-break-all"
                >
                  {truncateString(account.instructorProfile.facultyURL, 75)}
                </a>
              ) : (
                <span>
                  <em>Not set</em>
                </span>
              )}
            </p>
          </Card.Description>
        </Card.Content>
        <Card.Content extra>
          <Button color="blue" fluid onClick={handleOpenEditProfile}>
            <Icon name="edit" />
            Edit Instructor Profile
          </Button>
        </Card.Content>
      </Card>
      <Modal open={showEditModal} onClose={handleCloseEditProfile}>
        <Modal.Header>Edit Instructor Profile</Modal.Header>
        <Modal.Content scrolling>
          <p>
            {`To verify instructor status you must provide a link to a web page showing your
             faculty status. Links to your institution's web page are NOT sufficient. A URL which
             shows that you are an instructor is needed.`}
          </p>
          <Form>
            <Form.Field error={institutionErr}>
              <label htmlFor="institution">Your Institution</label>
              <Form.Input
                id="institution"
                type="text"
                name="institution"
                placeholder="Institution..."
                value={institution}
                onChange={handleInputChange}
                icon="university"
                iconPosition="left"
              />
            </Form.Field>
            <Form.Field error={facultyURLErr}>
              <label htmlFor="facultyURL">
                {`Link to your faculty entry on your institution's website (or other URL that
                 shows your faculty status)`}
              </label>
              <Form.Input
                id="facultyURL"
                type="url"
                name="facultyURL"
                placeholder="URL..."
                value={facultyURL}
                onChange={handleInputChange}
                icon="compass"
                iconPosition="left"
              />
            </Form.Field>
          </Form>
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={handleCloseEditProfile}>Cancel</Button>
          <Button color="green" loading={loading} onClick={submitEditProfile}>
            <Icon name="save" />
            Save
          </Button>
        </Modal.Actions>
      </Modal>
    </Segment>
  );
};

export default InstructorProfile;
