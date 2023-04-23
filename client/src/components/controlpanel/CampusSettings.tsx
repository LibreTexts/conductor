import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useTypedSelector } from "../../state/hooks.js";
import { useForm } from "react-hook-form";
import { CampusSettingsOpts } from "../../types/Organization.js";
import axios from "axios";
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
} from "semantic-ui-react";
import { isEmptyString } from "../util/HelperFunctions.js";
import useGlobalError from "../error/ErrorHooks.js";
import CtlTextInput from "../ControlledInputs/CtlTextInput.js";
import "./ControlPanel.css";
import { required } from "../../utils/formRules.js";
import isHexColor from "validator/es/lib/isHexColor.js";
import { sanitizeCustomColor } from "../../utils/campusSettingsHelpers.js";

const CampusSettings = () => {
  // Global State and Error Handling
  const dispatch = useDispatch();
  const { handleGlobalError } = useGlobalError();
  const org = useTypedSelector((state) => state.org);

  const {
    control,
    register,
    trigger,
    watch,
    reset: resetForm,
    handleSubmit,
    setValue: setFormValue,
    getValues: getFormValue,
    setError: setFormError,
    formState: { errors, isDirty },
  } = useForm<CampusSettingsOpts>({
    defaultValues: {
      coverPhoto: undefined,
      largeLogo: "",
      mediumLogo: "",
      smallLogo: "",
      aboutLink: "",
      commonsHeader: "",
      commonsMessage: "",
      collectionsDisplayLabel: "Collections",
      collectionsMessage: "",
      primaryColor: "",
      footerColor: "",
    },
  });

  // UI
  const [loadedData, setLoadedData] = useState(false);
  const [savedData, setSavedData] = useState(false);
  const watchedPrimaryColor = watch("primaryColor");
  const watchedFooterColor = watch("footerColor");

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
        resetForm(res.data);
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
   * Watch form values and reset saved indicator
   * if values were changes
   */
  useEffect(() => {
    if (isDirty) {
      setSavedData(false);
    }
  }, [isDirty]);

  /**
   * Validate the form, then submit
   * changes (if any) via PUT request
   * to the server, then re-sync
   * Organization info.
   */
  const saveChanges = (d: CampusSettingsOpts) => {
    setLoadedData(false);
    if (!isDirty) {
      setSavedData(true);
      setLoadedData(true);
      return;
    }

    let primaryColorErr = false;
    let footerColorErr = false;

    if (
      getFormValue("primaryColor") &&
      !isHexColor(getFormValue("primaryColor")!)
    ) {
      setFormError("primaryColor", {
        message: "Not a valid hex color.",
      });
      primaryColorErr = true;
    }

    if (
      getFormValue("footerColor") &&
      !isHexColor(getFormValue("footerColor")!)
    ) {
      setFormError("footerColor", {
        message: "Not a valid hex color.",
      });
      footerColorErr = true;
    }

    if (primaryColorErr || footerColorErr) {
      setLoadedData(true);
      return;
    }

    d.primaryColor = sanitizeCustomColor(getFormValue('primaryColor') ?? '');
    d.footerColor = sanitizeCustomColor(getFormValue('footerColor') ?? '');

    axios
      .put(`/org/${org.orgID}`, d)
      .then((res) => {
        if (!res.data.err) {
          if (res.data.updatedOrg) {
            dispatch({
              type: "SET_ORG_INFO",
              payload: res.data.updatedOrg,
            });
          }
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setLoadedData(true);
        setSavedData(true);
      })
      .catch((err) => {
        handleGlobalError(err);
        setLoadedData(true);
      });
  };

  /**
   * Activates the Cover Photo file input selector.
   */
  function handleUploadCoverPhoto() {
    if (coverPhotoRef.current) {
      (coverPhotoRef.current as HTMLInputElement).click();
    }
  }

  /**
   * Activates the Large Logo file input selector.
   */
  function handleUploadLargeLogo() {
    if (largeLogoRef.current) {
      (largeLogoRef.current as HTMLInputElement).click();
    }
  }

  /**
   * Activates the Medium Logo file input selector.
   */
  function handleUploadMediumLogo() {
    if (mediumLogoRef.current) {
      (mediumLogoRef.current as HTMLInputElement).click();
    }
  }

  /**
   * Activates the Small Logo file input selector.
   */
  function handleUploadSmallLogo() {
    if (smallLogoRef.current) {
      (smallLogoRef.current as HTMLInputElement).click();
    }
  }

  /**
   * Passes the Cover Photo file selection event to the asset uploader.
   *
   * @param {React.FormEvent<HTMLInputElement>} event - File selection event.
   */
  function handleCoverPhotoFileChange(
    event: React.FormEvent<HTMLInputElement>
  ) {
    handleAssetUpload(
      event,
      "coverPhoto",
      setFormValue,
      setCoverPhotoLoading,
      setCoverPhotoUploaded
    );
  }

  /**
   * Passes the Large Logo file selection event to the asset uploader.
   *
   * @param {React.FormEvent<HTMLInputElement>} event - File selection event.
   */
  function handleLargeLogoFileChange(event: React.FormEvent<HTMLInputElement>) {
    handleAssetUpload(
      event,
      "largeLogo",
      setFormValue,
      setLargeLogoLoading,
      setLargeLogoUploaded
    );
  }

  /**
   * Passes the Medium Logo file selection event to the asset uploader.
   *
   * @param {React.FormEvent<HTMLInputElement>} event - File selection event.
   */
  function handleMediumLogoFileChange(
    event: React.FormEvent<HTMLInputElement>
  ) {
    handleAssetUpload(
      event,
      "mediumLogo",
      setFormValue,
      setMediumLogoLoading,
      setMediumLogoUploaded
    );
  }

  /**
   * Passes the Small Logo file selection event to the asset uploader.
   *
   * @param {React.FormEvent<HTMLInputElement>} event - File selection event.
   */
  function handleSmallLogoFileChange(event: React.FormEvent<HTMLInputElement>) {
    handleAssetUpload(
      event,
      "smallLogo",
      setFormValue,
      setSmallLogoLoading,
      setSmallLogoUploaded
    );
  }

  /**
   * Uploads a selected asset file to the server, then updates state accordingly.
   *
   * @param {React.FormEvent<HTMLInputElement>} event - File selection event.
   * @param {keyof CampusSettings} assetName - Name of the asset being uploaded/replaced.
   * @param {function} assetLinkUpdater - State setter for the respective asset link.
   * @param {function} uploadingStateUpdater - State setter for the respective asset upload status.
   * @param {function} uploadSuccessUpdater - State setter for the respective asset upload success flag.
   */
  async function handleAssetUpload(
    event: any,
    assetName: keyof CampusSettingsOpts,
    assetLinkUpdater: (
      name: keyof CampusSettingsOpts,
      value: string,
      opts?: object
    ) => void,
    uploadingStateUpdater: Function,
    uploadSuccessUpdater: Function
  ) {
    const validFileTypes = ["image/jpeg", "image/png"];
    if (!event.target || typeof event?.target?.files !== "object") {
      return;
    }
    if (event.target.files.length !== 1) {
      handleGlobalError("Only one file can be uploaded at a time.");
      return;
    }

    const newAsset = event.target.files[0];
    if (
      !(newAsset instanceof File) ||
      !validFileTypes.includes(newAsset.type)
    ) {
      handleGlobalError("Sorry, that file type is not supported.");
    }

    uploadingStateUpdater(true);
    const formData = new FormData();
    formData.append("assetFile", newAsset);

    try {
      const uploadRes = await axios.post(
        `/org/${org.orgID}/branding-images/${assetName}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      if (!uploadRes.data.err) {
        getOrganization();
        uploadSuccessUpdater(true);
        if (uploadRes.data.url) {
          assetLinkUpdater(assetName, uploadRes.data.url, {
            shouldDirty: true,
          });
        }
      } else {
        throw new Error(uploadRes.data.errMsg);
      }
    } catch (e) {
      handleGlobalError(e);
    }
    uploadingStateUpdater(false);
  }

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header">Campus Settings</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment>
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to="/controlpanel">
                  Control Panel
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>Campus Settings</Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            <Segment raised loading={!loadedData}>
              <h3>Branding Images</h3>
              <Form noValidate>
                <Form.Field required className="mt-1p">
                  <label htmlFor="campusCover">Campus Cover Photo</label>
                  <p>
                    A <em>download link</em> to the organization's large cover
                    photo, displayed on the Campus Commons jumbotron. Dimensions
                    should be <em>at least</em> 1920x1080.{" "}
                    <em>
                      Organization logos should not be used as the Cover Photo.
                    </em>
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
                    <Button
                      disabled={!getFormValue("coverPhoto")}
                      as="a"
                      href={getFormValue("coverPhoto")}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Icon name="external" />
                      View Current
                    </Button>
                    <Button
                      color="blue"
                      onClick={handleUploadCoverPhoto}
                      loading={coverPhotoLoading}
                    >
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
                  <label htmlFor="campusLarge">Campus Large Logo</label>
                  <p>
                    A <em>download link</em> to the organization's main/large
                    logo. This is typically an extended wordmark. Logo should
                    preferably have a transparent background. Resolution should
                    be high enough to avoid blurring on digital screens.
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
                    <Button
                      disabled={!getFormValue("largeLogo")}
                      as="a"
                      href={getFormValue("largeLogo")}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Icon name="external" />
                      View Current
                    </Button>
                    <Button
                      color="blue"
                      onClick={handleUploadLargeLogo}
                      loading={largeLogoLoading}
                    >
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
                  <label htmlFor="campusMedium">Campus Medium Logo</label>
                  <p>
                    A <em>download link</em> to the organization's medium-sized
                    logo. This is typically a standard, non-extended wordmark.
                    Logo should preferably have a transparent background.
                    Resolution should be high enough to avoid blurring on
                    digital screens.{" "}
                    <em>
                      If the organization does not have distinct large/medium
                      logos, the same logo can be used for both.
                    </em>
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
                    <Button
                      disabled={!getFormValue("mediumLogo")}
                      as="a"
                      href={getFormValue("mediumLogo")}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Icon name="external" />
                      View Current
                    </Button>
                    <Button
                      color="blue"
                      onClick={handleUploadMediumLogo}
                      loading={mediumLogoLoading}
                    >
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
                  <label htmlFor="campusSmall">Campus Small Logo</label>
                  <p>
                    A <em>download link</em> to the organization's smallest
                    logo. This is typically the same style used for favicons or
                    simplified communications branding. Logo should preferably
                    have a transparent background. Dimensions should be
                    approximately 800x800.{" "}
                    <em>
                      The Small Logo is not currently implemented in any portion
                      of Commons or Conductor, but has been provisioned for
                      possible future customizations.
                    </em>
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
                    <Button
                      disabled={!getFormValue("smallLogo")}
                      as="a"
                      href={getFormValue("smallLogo")}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Icon name="external" />
                      View Current
                    </Button>
                    <Button
                      color="blue"
                      onClick={handleUploadSmallLogo}
                      loading={smallLogoLoading}
                    >
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
                <Form.Field required>
                  <label htmlFor="campusAbout">
                    <span>About Link </span>
                    <Popup
                      content={
                        <span>
                          A standard link to the organization's About page, or
                          the main page if one is not provisioned.
                        </span>
                      }
                      trigger={<Icon name="info circle" />}
                    />
                  </label>
                  <CtlTextInput
                    id="campusAbout"
                    name="aboutLink"
                    control={control}
                    rules={required}
                  />
                </Form.Field>
                <Divider />
                <h3>Branding Text</h3>
                <Form.Field>
                  <label htmlFor="campusCommonsHeader">
                    <span>Campus Commons Header </span>
                    <Popup
                      content={
                        <span>
                          An emphasized string of text placed at the top of the
                          Catalog Search interface, used to welcome users to the
                          Campus Commons.{" "}
                          <strong>This text is optional.</strong>
                        </span>
                      }
                      trigger={<Icon name="info circle" />}
                    />
                  </label>
                  <CtlTextInput
                    id="campusCommonsHeader"
                    name="commonsHeader"
                    control={control}
                  />
                </Form.Field>
                <Form.Field>
                  <label htmlFor="campusCommonsMessage">
                    <span>Campus Commons Message </span>
                    <Popup
                      content={
                        <span>
                          A block of text placed at the top of the Catalog
                          Search interface, used to welcome users to the Campus
                          Commons. <strong>This text is optional.</strong>
                        </span>
                      }
                      trigger={<Icon name="info circle" />}
                    />
                  </label>
                  <CtlTextInput
                    id="campusCommonsMessage"
                    name="commonsMessage"
                    control={control}
                  />
                </Form.Field>
                <Form.Field>
                  <label htmlFor="collectionsDisplayLabel">
                    <span>Collections Display Label </span>
                    <Popup
                      content={
                        <span>
                          An alternate name for Collections (eg. Departments,
                          Colleges, etc.). This text will be used on all
                          references to Collections on your Campus Commons.
                          <strong>This text is optional.</strong>
                        </span>
                      }
                      trigger={<Icon name="info circle" />}
                    />
                  </label>
                  <CtlTextInput
                    id="collectionsDisplayLabel"
                    name="collectionsDisplayLabel"
                    control={control}
                  />
                </Form.Field>
                <Form.Field>
                  <label htmlFor="collectionsDisplayLabel">
                    <span>Collections Message </span>
                    <Popup
                      content={
                        <span>
                          A block of text placed at the top of the Collections
                          interface, used to welcome users to the Collections.
                          <strong> This text is optional.</strong>
                        </span>
                      }
                      trigger={<Icon name="info circle" />}
                    />
                  </label>
                  <CtlTextInput
                    id="collectionsMessage"
                    name="collectionsMessage"
                    control={control}
                  />
                </Form.Field>
                <Divider />
                <h3>Branding Colors</h3>
                <Form.Field disabled={org?.orgID === 'libretexts'}>
                  <label htmlFor="campusPrimaryColor">
                    <span>Campus Primary Color </span>
                    <Popup
                      content={
                        <span>
                          A custom hex color code string (e.g. #FFF000) that
                          will change the color of various regions in Commons.
                          <strong> This is optional.</strong>
                        </span>
                      }
                      trigger={<Icon name="info circle" />}
                    />
                  </label>
                  <CtlTextInput
                    id="primaryColor"
                    name="primaryColor"
                    control={control}
                  />
                  <div className="controlpanel-branding-color-preview-wrapper">
                    <span>Primary Color Preview</span>
                    <div
                      className="controlpanel-branding-color-preview-box"
                      style={{
                        backgroundColor: watchedPrimaryColor?.toString()
                          ? sanitizeCustomColor(watchedPrimaryColor.toString())
                          : '',
                      }}
                    />
                  </div>
                </Form.Field>
                <Form.Field disabled={org?.orgID === 'libretexts'}>
                  <label htmlFor="campusFooterColor">
                    <span>Campus Footer Color </span>
                    <Popup
                      content={
                        <span>
                          A custom hex color code string (e.g. #FFF000) that
                          will change the page footer in Commons. This should be
                          a lighter color than your Primary Color.
                          <strong> This is optional.</strong>
                        </span>
                      }
                      trigger={<Icon name="info circle" />}
                    />
                  </label>
                  <CtlTextInput
                    id="footerColor"
                    name="footerColor"
                    control={control}
                  />
                  <div className="controlpanel-branding-color-preview-wrapper">
                    <span>Footer Color Preview</span>
                    <div
                      className="controlpanel-branding-color-preview-box"
                      style={{
                        backgroundColor: watchedFooterColor?.toString()
                          ? sanitizeCustomColor(watchedFooterColor.toString())
                          : '',
                      }}
                    />
                  </div>
                </Form.Field>
              </Form>
              <Button
                color="green"
                className="mt-2p"
                fluid
                onClick={handleSubmit(saveChanges)}
              >
                <Icon name={savedData ? "check" : "save"} />
                {!savedData && <span>Save Changes</span>}
              </Button>
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default CampusSettings;
