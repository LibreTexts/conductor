import React, { useEffect, useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
  Button,
  Divider,
  Form,
  Grid,
  Header,
  Icon,
  Image,
  Input,
  Message,
  Modal,
  Segment,
} from 'semantic-ui-react';
import useQueryParam from '../../../utils/useQueryParam';
import useGlobalError from '../../../components/error/ErrorHooks';
import { isEmptyString } from '../../../components/util/HelperFunctions';
import { libraryOptions } from '../../../components/util/LibraryOptions';
import { purposeOptions } from '../../../utils/accountRequestHelpers';

/**
 * The Account Request form allows users (and visitors) to send requests to the LibreTexts team for
 * access to various LibreTexts services and applications, particularly ones requiring instructor
 * status (or institutional affiliation).
 */
const AccountRequest = () => {

  const MORE_INFO_OPTIONS = [
    { key: 'yes', text: 'Yes', value: 'true' },
    { key: 'no', text: 'No', value: 'false' },
  ];

  const PURPOSE_OPTIONS = purposeOptions.map((item) => {
    const opt = { ...item };
    delete opt.shortText;
    return opt;
  });

  // Global State and Error
  const history = useHistory();
  const { handleGlobalError } = useGlobalError();
  const user = useSelector((state) => state.user);

  // UI
  const [showSuccessModal, setSuccessModal] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const showOpenCommons = useQueryParam('src') === 'commons';

  // Form Data
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [libs, setLibs] = useState([]);
  const [institution, setInstitution] = useState('');
  const [url, setURL] = useState('');
  const [moreInfo, setMoreInfo] = useState('');

  // Form Validation
  const [emailErr, setEmailErr] = useState(false);
  const [nameErr, setNameErr] = useState(false);
  const [purposeErr, setPurposeErr] = useState(false);
  const [libsErr, setLibsErr] = useState(false);
  const [instErr, setInstErr] = useState(false);
  const [urlErr, setURLErr] = useState(false);

  /**
   * Update page title on load.
   */
  useEffect(() => {
    document.title = "LibreTexts Conductor | Account Request";
  }, []);

  /**
   * Validates the form data and sets error states, if necessary.
   *
   * @returns {boolean} True if all fields valid, false otherwise.
   */
  function validateForm() {
    let valid = true;
    if (!user.isAuthenticated && isEmptyString(email)) {
      valid = false;
      setEmailErr(true);
    }
    if (!user.isAuthenticated && isEmptyString(name)) {
      valid = false;
      setNameErr(true);
    }
    if (isEmptyString(purpose)) {
      valid = false;
      setPurposeErr(true);
    }
    if (purpose === 'oer' && (!Array.isArray(libs) || libs.length < 1 || libs.length > 3)) {
      valid = false;
      setLibsErr(true);
    }
    if (isEmptyString(institution)) {
      valid = false;
      setInstErr(true);
    }
    if (isEmptyString(url)) {
      valid = false;
      setURLErr(true);
    }
    return valid;
  }

  /**
   * Resets all form error states.
   */
  function resetForm() {
    setEmailErr(false);
    setNameErr(false);
    setPurposeErr(false);
    setLibsErr(false);
    setInstErr(false);
    setURLErr(false);
  }

  /**
   * Redirect the user to Home or the main page when the Success Modal is closed.
   */
  function handleSuccessModalClose() {
    setSuccessModal(false);
    if (user.isAuthenticated) {
      return history.push('/home');
    }
    return history.push('/');
  }

  /**
   * Submit the Account Request to the server if form is valid, then open the success modal.
   */
  async function onSubmit() {
    resetForm();
    if (validateForm()) {
      setLoadingData(true);
      const requestData = {
        email: email,
        name: name,
        institution: institution,
        purpose: purpose,
        facultyURL: url
      };
      if (purpose === 'oer') {
        requestData.libraries = libs;
      }
      if (moreInfo === 'true') {
        requestData.moreInfo = true;
      }
      if (moreInfo === 'false') {
        requestData.moreInfo = false;
      }
      try {
        const submitRes = await axios.post('/accountrequest', requestData);
        if (!submitRes.data.err) {
          setSuccessModal(true);
          setLoadingData(false);
        } else {
          throw (new Error(submitRes.data.errMsg));
        }
      } catch (e) {
        setLoadingData(false);
        handleGlobalError(e);
      }
    }
  }

  /**
   * Updates state with changes to form inputs.
   *
   * @param {React.ChangeEvent} e - The event that triggered the handler. 
   */
  function onChange(e) {
    const { value } = e.target;
    switch (e.target.id) {
      case 'email':
        setEmail(value);
        break;
      case 'name':
        setName(value);
        break;
      case 'institution':
        setInstitution(value);
        break;
      case 'url':
        setURL(value);
        break;
      default:
        break; // silence React warning
    }
  }

  /**
   * Updates state with changes to the Account Request purpose.
   *
   * @param {React.ChangeEvent} e - The event that triggered the handler.
   * @param {object} data - Data passed from the UI component.
   * @param {string} data.value - The new purpose value.
   */
  function handlePurposeChange(e, { value }) {
    setPurpose(value);
  }

  /**
   * Updates state with changes to the Libraries selection input.
   *
   * @param {React.ChangeEvent} e - The event that triggered the handler.
   * @param {object} data - Data passed from the UI component.
   * @param {string[]} data.value - The updated list of selected libraries.
   */
  function handleLibsChange(e, { value }) {
    setLibs(value);
  }

  /**
   * Updates state with changes to the Requests More Information input.
   *
   * @param {React.ChangeEvent} e - The event that triggered the handler.
   * @param {object} data - Data passed from the UI component.
   * @param {string|string[]} data.value - The new value of the input. 
   */
  function handleMoreInfoChange(e, { value }) {
    setMoreInfo(value);
  }

  return (
    <Grid centered={true} verticalAlign="middle" className="component-container">
      <Grid.Row>
        <Grid.Column>
          <Grid verticalAlign="middle" centered={true}>
            <Grid.Row>
              <Grid.Column>
                <Image
                  src="/transparent_logo.png"
                  size="medium"
                  centered
                  className="cursor-pointer"
                  onClick={() => window.open('https://libretexts.org', '_blank', 'noreferrer')}
                />
                <Header as="h1" textAlign="center">Request Instructor Account(s)</Header>
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column mobile={16} computer={10}>
          <Segment raised className="mb-4r">
            {showOpenCommons && (
              <Message icon info className="mb-2p">
                <Icon name="lock open" />
                <Message.Content>
                  <Message.Header>Conductor Is Open to All</Message.Header>
                  <p>
                    {'This form is for instructors to request accounts on '}
                    <strong>LibreTexts libraries</strong>, the <strong>LibreStudio</strong>, and the <strong>ADAPT homework system</strong>.
                    {' Conductor is open to all community members without explicit approval. To register for or log in to Conductor, '}
                    <Link to="/login">navigate here</Link>.
                  </p>
                </Message.Content>
              </Message>
            )}
            <p className="text-center">
              {'Instructor accounts are for instructors only. Please use your campus email address to facilitate verification of your instructor status.'}
              <em>
                {'Upon approval, you should receive a notification from LibreTexts Conductor. Login details for your requested service(s) will arrive separately. '}
                {'Please check your junk/spam folder if you do not receive them. '}
              </em>
            </p>
            <p className="text-center mt-2p">
              {'Accounts are required to modify content on the LibreTexts libraries including editing pages, uploading content, creating new Course Shells, and remixing customized textbooks. '}
              {'Fill out and submit this form to request an Instructor account.'}
            </p>
            {user.isAuthenticated && (
              <Message icon positive className="mt-2p">
                <Icon name="user circle" />
                <Message.Content>
                  <Message.Header>Welcome, {user.firstName}</Message.Header>
                  <p>Your Conductor name and email address will be used in this account request.</p>
                </Message.Content>
              </Message>
            )}
            <Form onSubmit={onSubmit}>
              {!user.isAuthenticated && (
                <Form.Field required error={emailErr}>
                  <label htmlFor="email">Email</label>
                  <Input
                    fluid
                    id="email"
                    type="email"
                    name="email"
                    placeholder="Email..."
                    value={email}
                    onChange={onChange}
                    icon="mail"
                    iconPosition="left"
                  />
                </Form.Field>
              )}
              {!user.isAuthenticated && (
                <Form.Field required error={nameErr}>
                  <label htmlFor="name">Name</label>
                  <Input
                    fluid
                    id="name"
                    type="text"
                    name="name"
                    placeholder="Name..."
                    value={name}
                    onChange={onChange}
                    icon="user circle"
                    iconPosition="left"
                  />
                </Form.Field>
              )}
              <Form.Select
                required
                id="purpose"
                fluid
                label="What do you need accounts for?"
                options={PURPOSE_OPTIONS}
                placeholder="Choose purpose..."
                onChange={handlePurposeChange}
                value={purpose}
                error={purposeErr}
              />
              {(purpose === 'oer') && (
                <Form.Field>
                  <label htmlFor="library">
                    {`Which libraries do you need accounts on? `}
                    <span className="muted-text">Pick the library that best fits your needs. (min. 1, max. 3)</span>
                  </label>
                  <Form.Select
                    required={purpose === 'oer'}
                    id="library"
                    fluid
                    multiple
                    options={libraryOptions}
                    placeholder="Libraries..."
                    onChange={handleLibsChange}
                    value={libs}
                    error={libsErr}
                  />
                </Form.Field>
              )}
              <Divider />
              <Header as="h3">Instructor Verification</Header>
              <p>
                {'Anyone can access and read the full LibreTexts content: no account is necessary to access content. '}
                {'These accounts are only for instructors who needs to create custom textbooks for their class or who want to upload new content to the LibreTexts Libraries.'}
              </p>
              <p>
                {`To verify instructor status you must provide a link to a web page showing your faculty status. Links to your institution's web page are NOT sufficient. `}
                {'A URL which shows that you are an instructor is needed. Please provide your complete name, department and status otherwise we will not approve your application.'}
              </p>
              <Form.Field required error={instErr}>
                <label htmlFor="institution">Your Institution</label>
                <Input
                  fluid
                  id="institution"
                  type="text"
                  name="institution"
                  placeholder="Institution..."
                  value={institution}
                  onChange={onChange}
                  icon="university"
                  iconPosition="left"
                />
              </Form.Field>
              <Form.Field required error={urlErr}>
                <label htmlFor="url">Link to your faculty entry on your institution's website (or other URL that shows your faculty status)</label>
                <Input
                  fluid
                  id="url"
                  type="text"
                  name="url"
                  placeholder="URL..."
                  value={url}
                  onChange={onChange}
                  icon="compass"
                  iconPosition="left"
                />
              </Form.Field>
              <Form.Select
                id="moreinfo"
                fluid
                label="Are you interested in more information about how your institution can become a member of the LibreNet?"
                options={MORE_INFO_OPTIONS}
                placeholder="Choose..."
                onChange={handleMoreInfoChange}
                value={moreInfo}
              />
              <Button
                type="submit"
                color="blue"
                size="large"
                fluid
                loading={loadingData}
                className="mt-4p"
              >
                Submit Request
              </Button>
            </Form>
          </Segment>
        </Grid.Column>
      </Grid.Row>
      {/* Success Modal */}
      <Modal
        onClose={handleSuccessModalClose}
        open={showSuccessModal}
      >
        <Modal.Header>Account Request: Success</Modal.Header>
        <Modal.Content>
          <Modal.Description>
            <p>Successfully submitted your request! You will now be redirected to the main page.</p>
          </Modal.Description>
        </Modal.Content>
        <Modal.Actions>
          <Button color="blue" onClick={handleSuccessModalClose}>Done</Button>
        </Modal.Actions>
      </Modal>
    </Grid>
  );
};

export default AccountRequest;
