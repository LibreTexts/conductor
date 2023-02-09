import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
  Breadcrumb,
  Button,
  Divider,
  Form,
  Grid,
  Header,
  Icon,
  Message,
  Popup,
  Segment,
} from 'semantic-ui-react';
import { isEmptyString } from '../util/HelperFunctions.js';
import useGlobalError from '../error/ErrorHooks.js';
import './ControlPanel.css';

const CampusSettings = () => {

  // Global State and Error Handling
  const { handleGlobalError } = useGlobalError();
  const org = useSelector((state) => state.org);

  // UI
  const [loadedData, setLoadedData] = useState(false);
  const [savedData, setSavedData] = useState(false);

  // Data
  const [originalData, setOriginalData] = useState({});
  const [coverPhoto, setCoverPhoto] = useState('');
  const [largeLogo, setLargeLogo] = useState('');
  const [mediumLogo, setMediumLogo] = useState('');
  const [smallLogo, setSmallLogo] = useState('');
  const [aboutLink, setAboutLink] = useState('');
  const [aboutLinkErr, setAboutLinkErr] = useState(false);
  const [commonsHeader, setCommonsHeader] = useState('');
  const [commonsMessage, setCommonsMessage] = useState('');

  // Asset Uploads
  const coverPhotoRef = useRef(null);
  const [coverPhotoLoading, setCoverPhotoLoading] = useState(false);
  const [coverPhotoUploaded, setCoverPhotoUploaded] = useState(false);
  const largeLogoRef = useRef(null);
  const [largeLogoLoading, setLargeLogoLoading] = useState(false);
  const [largeLogoUploaded, setLargeLogoUploaded] = useState(false);
  const mediumLogoRef = useRef(null);
  const [mediumLogoLoading, setMediumLogoLoading] = useState(false);
  const [mediumLogoUploaded, setMediumLogoUploaded] = useState(false);
  const smallLogoRef = useRef(null);
  const [smallLogoLoading, setSmallLogoLoading] = useState(false);
  const [smallLogoUploaded, setSmallLogoUploaded] = useState(false);

  /**
   * Retrieves Organization info via GET request from the server, then updates state.
   */
  const getOrganization = useCallback(async () => {
    try {
      setLoadedData(false);
      const res = await axios.get(`/org/${org.orgID}`);
      if (!res.data.err) {
        let orgData = res.data;
        delete orgData.err;
        setOriginalData(orgData);
        if (orgData.coverPhoto) setCoverPhoto(orgData.coverPhoto);
        if (orgData.largeLogo) setLargeLogo(orgData.largeLogo);
        if (orgData.mediumLogo) setMediumLogo(orgData.mediumLogo);
        if (orgData.smallLogo) setSmallLogo(orgData.smallLogo);
        if (orgData.aboutLink) setAboutLink(orgData.aboutLink);
        if (orgData.commonsHeader) setCommonsHeader(orgData.commonsHeader);
        if (orgData.commonsMessage) setCommonsMessage(orgData.commonsMessage);
      } else {
        handleGlobalError(res.data.errMsg);
      }
      setLoadedData(true);
    } catch (err) {
      handleGlobalError(err);
      setLoadedData(true);
    }
  }, [org.orgID, setLoadedData, handleGlobalError]);

  /**
   * Set page title on initial load.
   */
  useEffect(() => {
    document.title = "LibreTexts Conductor | Campus Settings";
    getOrganization();
  }, [getOrganization]);

  /**
   * Reset all form errors.
   */
  const resetFormErrors = () => {
    setAboutLinkErr(false);
  };

  /**
   * Validate the form, return true
   * if no errors, false otherwise.
   */
  const validateForm = () => {
    let validForm = true;
    if (isEmptyString(aboutLink)) {
      validForm = false;
      setAboutLinkErr(true);
    }
    return validForm;
  };

  /**
   * Validate the form, then submit
   * changes (if any) via PUT request
   * to the server, then re-sync
   * Organization info.
   */
  const saveChanges = () => {
    resetFormErrors();
    if (validateForm()) {
      setLoadedData(false);
      let newData = {};
      if (originalData.aboutLink !== aboutLink) newData.aboutLink = aboutLink;
      if (originalData.commonsHeader !== commonsHeader) newData.commonsHeader = commonsHeader;
      if (originalData.commonsMessage !== commonsMessage) newData.commonsMessage = commonsMessage;
      if (Object.keys(newData).length > 0) {
        axios.put(`/org/${org.orgID}`, newData).then((res) => {
          if (!res.data.err) {
            if (res.data.updatedOrg) {
              getOrganization();
            }
          } else {
            handleGlobalError(res.data.errMsg);
          }
          setLoadedData(true);
          setSavedData(true);
        }).catch((err) => {
          handleGlobalError(err);
          setLoadedData(true);
        });
      } else {
        setSavedData(true);
        setLoadedData(true);
      }
    }
  };

  /**
   * Activates the Cover Photo file input selector.
   */
  function handleUploadCoverPhoto() {
    if (coverPhotoRef.current) {
      coverPhotoRef.current.click();
    }
  }

  /**
   * Activates the Large Logo file input selector.
   */
  function handleUploadLargeLogo() {
    if (largeLogoRef.current) {
      largeLogoRef.current.click();
    }
  }

  /**
   * Activates the Medium Logo file input selector.
   */
  function handleUploadMediumLogo() {
    if (mediumLogoRef.current) {
      mediumLogoRef.current.click();
    }
  }

  /**
   * Activates the Small Logo file input selector.
   */
  function handleUploadSmallLogo() {
    if (smallLogoRef.current) {
      smallLogoRef.current.click();
    }
  }

  /**
   * Passes the Cover Photo file selection event to the asset uploader.
   *
   * @param {React.FormEvent<HTMLInputElement>} event - File selection event.
   */
  function handleCoverPhotoFileChange(event) {
    handleAssetUpload(
      event,
      'coverPhoto',
      setCoverPhoto,
      setCoverPhotoLoading,
      setCoverPhotoUploaded,
    );
  };

  /**
   * Passes the Large Logo file selection event to the asset uploader.
   *
   * @param {React.FormEvent<HTMLInputElement>} event - File selection event.
   */
  function handleLargeLogoFileChange(event) {
    handleAssetUpload(
      event,
      'largeLogo',
      setLargeLogo,
      setLargeLogoLoading,
      setLargeLogoUploaded,
    );
  }

  /**
   * Passes the Medium Logo file selection event to the asset uploader.
   *
   * @param {React.FormEvent<HTMLInputElement>} event - File selection event.
   */
  function handleMediumLogoFileChange(event) {
    handleAssetUpload(
      event,
      'mediumLogo',
      setMediumLogo,
      setMediumLogoLoading,
      setMediumLogoUploaded,
    );
  }

  /**
   * Passes the Small Logo file selection event to the asset uploader.
   *
   * @param {React.FormEvent<HTMLInputElement>} event - File selection event.
   */
  function handleSmallLogoFileChange(event) {
    handleAssetUpload(
      event,
      'smallLogo',
      setSmallLogo,
      setSmallLogoLoading,
      setSmallLogoUploaded,
    );
  }

  /**
   * Uploads a selected asset file to the server, then updates state accordingly.
   *
   * @param {React.FormEvent<HTMLInputElement>} event - File selection event.
   * @param {string} assetName - Name of the asset being uploaded/replaced.
   * @param {function} assetLinkUpdater - State setter for the respective asset link.
   * @param {function} uploadingStateUpdater - State setter for the respective asset upload status.
   * @param {function} uploadSuccessUpdater - State setter for the respective asset upload success flag.
   */
  async function handleAssetUpload(event, assetName, assetLinkUpdater, uploadingStateUpdater, uploadSuccessUpdater) {
    const validFileTypes = ['image/jpeg', 'image/png'];
    if (!event.target || typeof (event?.target?.files) !== 'object') {
      return;
    }
    if (event.target.files.length !== 1) {
      handleGlobalError('Only one file can be uploaded at a time.');
      return;
    }

    const newAsset = event.target.files[0];
    if (!(newAsset instanceof File) || !validFileTypes.includes(newAsset.type)) {
      handleGlobalError('Sorry, that file type is not supported.');
    }

    uploadingStateUpdater(true);
    const formData = new FormData();
    formData.append('assetFile', newAsset);

    try {
      const uploadRes = await axios.post(
        `/org/${org.orgID}/branding-images/${assetName}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      if (!uploadRes.data.err) {
        getOrganization();
        uploadSuccessUpdater(true);
        /*
        if (uploadRes.data.url) {
          assetLinkUpdater(uploadRes.data.url);
        }
        */
      } else {
        throw new Error(uploadRes.data.errMsg);
      }
    } catch (e) {
      handleGlobalError(e);
    }
    uploadingStateUpdater(false);
  }

  return (
    <Grid className='controlpanel-container' divided='vertically'>
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className='component-header'>Campus Settings</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment>
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to='/controlpanel'>
                  Control Panel
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon='right chevron' />
                <Breadcrumb.Section active>
                  Campus Settings
                </Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            <Segment
              raised
              loading={!loadedData}
            >
              <h3>Branding Images</h3>
              <Form noValidate>
                <Form.Field required className="mt-1p">
                  <label htmlFor='campusCover'>Campus Cover Photo</label>
                  <p>
                    A <em>download link</em> to the organization's large cover photo, displayed on the Campus Commons jumbotron. Dimensions should be <em>at least</em> 1920x1080. <em>Organization logos should not be used as the Cover Photo.</em>
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    id="conductor-org-coverphoto-upload"
                    hidden
                    ref={coverPhotoRef}
                    onChange={handleCoverPhotoFileChange}
                  />
                  <Button.Group fluid>
                    <Button disabled={!coverPhoto} as="a" href={coverPhoto} target="_blank" rel="noreferrer">
                      <Icon name="external" />
                      View Current
                    </Button>
                    <Button color="blue" onClick={handleUploadCoverPhoto} loading={coverPhotoLoading}>
                      <Icon name="upload" />
                      Upload New
                    </Button>
                  </Button.Group>
                  {coverPhotoUploaded && (
                    <Message positive>
                      <Icon name="check circle" />
                      <span>Campus Cover Photo successfully uploaded.</span>
                    </Message>
                  )}
                </Form.Field>
                <Form.Field required className="mt-2r">
                  <label htmlFor='campusLarge'>Campus Large Logo</label>
                  <p>
                    A <em>download link</em> to the organization's main/large logo. This is typically an extended wordmark. Logo should preferably have a transparent background. Resolution should be high enough to avoid blurring on digital screens.
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    id="conductor-org-coverphoto-upload"
                    hidden
                    ref={largeLogoRef}
                    onChange={handleLargeLogoFileChange}
                  />
                  <Button.Group fluid>
                    <Button disabled={!largeLogo} as="a" href={largeLogo} target="_blank" rel="noreferrer">
                      <Icon name="external" />
                      View Current
                    </Button>
                    <Button color="blue" onClick={handleUploadLargeLogo} loading={largeLogoLoading}>
                      <Icon name="upload" />
                      Upload New
                    </Button>
                  </Button.Group>
                  {largeLogoUploaded && (
                    <Message positive>
                      <Icon name="check circle" />
                      <span>Campus Large Logo successfully uploaded.</span>
                    </Message>
                  )}
                </Form.Field>
                <Form.Field required className="mt-2r">
                  <label htmlFor='campusMedium'>Campus Medium Logo</label>
                  <p>
                    A <em>download link</em> to the organization's medium-sized logo. This is typically a standard, non-extended wordmark. Logo should preferably have a transparent background. Resolution should be high enough to avoid blurring on digital screens. <em>If the organization does not have distinct large/medium logos, the same logo can be used for both.</em>
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    id="conductor-org-coverphoto-upload"
                    hidden
                    ref={mediumLogoRef}
                    onChange={handleMediumLogoFileChange}
                  />
                  <Button.Group fluid>
                    <Button disabled={!mediumLogo} as="a" href={mediumLogo} target="_blank" rel="noreferrer">
                      <Icon name="external" />
                      View Current
                    </Button>
                    <Button color="blue" onClick={handleUploadMediumLogo} loading={mediumLogoLoading}>
                      <Icon name="upload" />
                      Upload New
                    </Button>
                  </Button.Group>
                  {mediumLogoUploaded && (
                    <Message positive>
                      <Icon name="check circle" />
                      <span>Campus Medium Logo successfully uploaded.</span>
                    </Message>
                  )}
                </Form.Field>
                <Form.Field className="mt-2p mb-2p">
                  <label htmlFor='campusSmall'>Campus Small Logo</label>
                  <p>
                    A <em>download link</em> to the organization's smallest logo. This is typically the same style used for favicons or simplified communications branding. Logo should preferably have a transparent background. Dimensions should be approximately 800x800. <em>The Small Logo is not currently implemented in any portion of Commons or Conductor, but has been provisioned for possible future customizations.</em>
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    id="conductor-org-coverphoto-upload"
                    hidden
                    ref={smallLogoRef}
                    onChange={handleSmallLogoFileChange}
                  />
                  <Button.Group fluid>
                    <Button disabled={!smallLogo} as="a" href={smallLogo} target="_blank" rel="noreferrer">
                      <Icon name="external" />
                      View Current
                    </Button>
                    <Button color="blue" onClick={handleUploadSmallLogo} loading={smallLogoLoading}>
                      <Icon name="upload" />
                      Upload New
                    </Button>
                  </Button.Group>
                  {smallLogoUploaded && (
                    <Message positive>
                      <Icon name="check circle" />
                      <span>Campus Small Logo successfully uploaded.</span>
                    </Message>
                  )}
                </Form.Field>
                <Divider />
                <h3>Branding Links</h3>
                <Form.Field
                  required
                  error={aboutLinkErr}
                >
                  <label htmlFor='campusAbout'>
                    <span>About Link </span>
                    <Popup
                      content={
                        <span>
                          A standard link to the organization's About page, or the main page if one is not provisioned.
                        </span>
                      }
                      trigger={<Icon name='info circle' />}
                    />
                  </label>
                  <Form.Input
                    id='campusAbout'
                    type='url'
                    onChange={(e) => setAboutLink(e.target.value)}
                    value={aboutLink}
                  />
                </Form.Field>
                <Divider />
                <h3>Branding Text</h3>
                <Form.Field>
                  <label htmlFor='campusCommonsHeader'>
                    <span>Campus Commons Header </span>
                    <Popup
                      content={
                        <span>
                          An emphasized string of text placed at the top of the Catalog Search interface, used to welcome users to the Campus Commons. <strong>This text is optional.</strong>
                        </span>
                      }
                      trigger={<Icon name='info circle' />}
                    />
                  </label>
                  <Form.Input
                    id='campusCommonsHeader'
                    type='text'
                    onChange={(e) => setCommonsHeader(e.target.value)}
                    value={commonsHeader}
                  />
                </Form.Field>
                <Form.Field>
                  <label htmlFor='campusCommonsMessage'>
                    <span>Campus Commons Message </span>
                    <Popup
                      content={
                        <span>
                          A block of text placed at the top of the Catalog Search interface, used to welcome users to the Campus Commons. <strong>This text is optional.</strong>
                        </span>
                      }
                      trigger={<Icon name='info circle' />}
                    />
                  </label>
                  <Form.Input
                    id='campusCommonsMessage'
                    type='text'
                    onChange={(e) => setCommonsMessage(e.target.value)}
                    value={commonsMessage}
                  />
                </Form.Field>
              </Form>
              <Button
                color='green'
                className='mt-2p'
                fluid
                onClick={saveChanges}
              >
                <Icon name={savedData ? 'check' : 'save'} />
                {!savedData && <span>Save Changes</span>}
              </Button>
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  )

}

export default CampusSettings;
