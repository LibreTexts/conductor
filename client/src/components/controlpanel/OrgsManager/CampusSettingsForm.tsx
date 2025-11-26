import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  lazy,
} from "react";
import {
  Segment,
  Form,
  Button,
  Message,
  Icon,
  Divider,
  Popup,
  Table,
  Input,
  Checkbox,
} from "semantic-ui-react";
import CtlTextInput from "../../ControlledInputs/CtlTextInput";
import {
  DEFAULT_COMMONS_MODULES,
  sanitizeCustomColor,
} from "../../../utils/campusSettingsHelpers";
import { useForm } from "react-hook-form";
import useGlobalError from "../../error/ErrorHooks";
import { useDispatch } from "react-redux";
import { CampusSettingsOpts } from "../../../types";
import isHexColor from "validator/es/lib/isHexColor";
import { required } from "../../../utils/formRules";
import { useTypedSelector } from "../../../state/hooks";
import axios from "axios";
import CommonsModuleControl from "./CommonsModuleControl";
import CampusAliasesControl from "./CampusAliasesControl";
import CtlCheckbox from "../../ControlledInputs/CtlCheckbox";
const CustomOrgListModal = lazy(() => import("../CustomOrgListModal"));

type CampusSettingsFormProps = {
  orgID: string;
  showCatalogSettings: boolean;
  onUpdateLoadedData?: (newVal: boolean) => void;
  onUpdateSavedData?: (newVal: boolean) => void;
};

type CampusSettingsFormRef = {
  requestSave: () => void;
};

const CampusSettingsForm = forwardRef(
  (
    props: CampusSettingsFormProps,
    ref: React.ForwardedRef<CampusSettingsFormRef>
  ) => {
    // Global State and Error Handling
    const dispatch = useDispatch();
    const org = useTypedSelector((state) => state.org);
    const { handleGlobalError } = useGlobalError();
    const [aliases, setAliases] = useState<string[]>([]);

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
      formState,
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
        addToLibreGridList: false,
        customOrgList: [],
        commonsModules: {
          books: { enabled: true, order: 1 },
          assets: { enabled: true, order: 2 },
          minirepos: { enabled: true, order: 3 },
          projects: { enabled: true, order: 4 },
          authors: { enabled: true, order: 5 },
        },
        showCollections: true,
        assetFilterExclusions: [],
      },
    });

    // UI
    const [loadedData, setLoadedData] = useState(false);
    const [savedData, setSavedData] = useState(false);
    const [matchingTags, setMatchingTags] = useState<
      { key: string; value: string }[]
    >([]);
    const [showCustomOrgListModal, setShowCustomOrgListModal] = useState(false);
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

    // Call handleSubmit() from parent component
    useImperativeHandle(ref, () => {
      return {
        requestSave() {
          handleSubmit(saveChanges)();
        },
      };
    });

    // Dispatch necessary state changes to parent component
    useEffect(() => {
      if (props.onUpdateLoadedData) {
        props.onUpdateLoadedData(loadedData);
      }
      if (props.onUpdateSavedData) {
        props.onUpdateSavedData(savedData);
      }
    }, [loadedData, savedData]);

    /**
     * Retrieves Organization info via GET request from the server, then updates state.
     */
    const getOrganization = useCallback(async () => {
      try {
        setLoadedData(false);
        const res = await axios.get(`/org/${props.orgID}`);
        if (res.data.err) {
          throw new Error(res.data.errMsg);
        }

        resetForm({
          ...res.data,
          commonsModules: res.data.commonsModules ?? DEFAULT_COMMONS_MODULES,
        });
        setAliases(res.data.aliases ?? []);

        setLoadedData(true);
      } catch (err) {
        handleGlobalError(err);
        setLoadedData(true);
      } finally {
        setLoadedData(true);
      }
    }, [props.orgID, setLoadedData, handleGlobalError]);

    /**
     * Set page title on initial load.
     */
    useEffect(() => {
      document.title = "LibreTexts Conductor | Campus Settings";
      getOrganization();
    }, [getOrganization]);

    // Display a success message when data is saved
    useEffect(() => {
      if(!savedData) return;
      setTimeout(() => setSavedData(false), 3000);
    }, [savedData])

    /**
     * Validate the form, then submit
     * changes (if any) via PUT request
     * to the server, then re-sync
     * Organization info.
     */
    const saveChanges = async (d: CampusSettingsOpts) => {
      try {
        setLoadedData(false);

        d.aliases = aliases.filter((alias) => alias.length >= 1 && alias.length <= 100);
        

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

        d.primaryColor = sanitizeCustomColor(
          getFormValue("primaryColor") ?? ""
        );
        d.footerColor = sanitizeCustomColor(getFormValue("footerColor") ?? "");

        const saveRes = await axios.put(`/org/${props.orgID}`, d);
        if (saveRes.data.err) {
          throw new Error(saveRes.data.errMsg);
        }
        if (saveRes.data?.updatedOrg?.orgID === org.orgID) {
          dispatch({
            type: "SET_ORG_INFO",
            payload: saveRes.data.updatedOrg,
          });
        }

        setLoadedData(true);
        setSavedData(true);
      } catch (err) {
        handleGlobalError(err);
      } finally {
        setLoadedData(true);
      }
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
    function handleLargeLogoFileChange(
      event: React.FormEvent<HTMLInputElement>
    ) {
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
    function handleSmallLogoFileChange(
      event: React.FormEvent<HTMLInputElement>
    ) {
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
          `/org/${props.orgID}/branding-images/${assetName}`,
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

    function handleCatalogMatchTagAdd() {
      setMatchingTags((prev) => [
        ...prev,
        { key: crypto.randomUUID(), value: "" },
      ]);
    }

    function handleCatalogMatchTagEdit(e: React.ChangeEvent<HTMLInputElement>) {
      const rowID = e.target.id.split(".")[1];
      setMatchingTags((prev) =>
        prev.map((item) => {
          if (rowID === item.key) {
            return {
              ...item,
              value: e.target.value,
            };
          }
          return item;
        })
      );
    }

    function handleCatalogMatchTagDelete(key: string) {
      setMatchingTags((prev) => prev.filter((item) => item.key !== key));
    }

    function handleToggleAssetFilterExclusion(filter: string) {
      const currentExclusions = getFormValue("assetFilterExclusions");
      if (!currentExclusions) {
        setFormValue("assetFilterExclusions", [filter], { shouldDirty: true });
        return;
      }
      if (currentExclusions.includes(filter)) {
        setFormValue(
          "assetFilterExclusions",
          currentExclusions.filter((item) => item !== filter),
          { shouldDirty: true }
        );
      } else {
        setFormValue("assetFilterExclusions", [...currentExclusions, filter], {
          shouldDirty: true,
        });
      }
    }

    return (
      <>
        <Form noValidate>
          <Segment raised>
            <p className="text-lg font-bold">Branding Images</p>

            <Form.Field required className="mt-1p">
              <label htmlFor="campusCover">Campus Cover Photo</label>
              <p>
                A <em>download link</em> to the organization's large cover photo,
                displayed on the Campus Commons jumbotron. Dimensions should be{" "}
                <em>at least</em> 1920x1080.{" "}
                <em>Organization logos should not be used as the Cover Photo.</em>
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
                A <em>download link</em> to the organization's main/large logo.
                This is typically an extended wordmark. Logo should preferably
                have a transparent background. Resolution should be high enough to
                avoid blurring on digital screens.
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
                A <em>download link</em> to the organization's medium-sized logo.
                This is typically a standard, non-extended wordmark. Logo should
                preferably have a transparent background. Resolution should be
                high enough to avoid blurring on digital screens.{" "}
                <em>
                  If the organization does not have distinct large/medium logos,
                  the same logo can be used for both.
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
                A <em>download link</em> to the organization's smallest logo. This
                is typically the same style used for favicons or simplified
                communications branding. Logo should preferably have a transparent
                background. Dimensions should be approximately 800x800.{" "}
                <em>
                  The Small Logo is not currently implemented in any portion of
                  Commons or Conductor, but has been provisioned for possible
                  future customizations.
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
          </Segment>
          <Segment raised>
            <p className="text-lg font-bold">Branding Links</p>
            <Form.Field required>
              <label htmlFor="campusAbout">
                <span>About Link </span>
                <Popup
                  content={
                    <span>
                      A standard link to the organization's About page, or the
                      main page if one is not provisioned.
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
          </Segment>
          <Segment raised>
            <p className="text-lg font-bold">Branding Text</p>
            <Form.Field>
              <label htmlFor="campusCommonsHeader">
                <span>Campus Commons Header </span>
                <Popup
                  content={
                    <span>
                      An emphasized string of text placed at the top of the
                      Catalog Search interface, used to welcome users to the
                      Campus Commons. <strong>This text is optional.</strong>
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
                      A block of text placed at the top of the Catalog Search
                      interface, used to welcome users to the Campus Commons.{" "}
                      <strong>This text is optional.</strong>
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
            <div className="mt-4  mb-2 flex flex-row items-center">
              <label
                htmlFor="show-collections-toggle"
                className="form-field-label"
              >
                Show Collections Tab?
              </label>
              <CtlCheckbox
                toggle
                id="show-collections-toggle"
                className="ml-4"
                name="showCollections"
                control={control}
              />
            </div>
            <Form.Field disabled={!watch("showCollections")} className="!ml-2">
              <label htmlFor="collectionsDisplayLabel">
                <span>Collections Display Label </span>
                <Popup
                  content={
                    <span>
                      An alternate name for Collections (eg. Departments,
                      Colleges, etc.). This text will be used on all references to
                      Collections on your Campus Commons.
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
            <Form.Field disabled={!watch("showCollections")} className="!ml-2">
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
          </Segment>
          <Segment raised>
            <p className="text-lg font-bold">Branding Colors</p>
            <Form.Field disabled={props.orgID === "libretexts"}>
              <label htmlFor="campusPrimaryColor">
                <span>Campus Primary Color </span>
                <Popup
                  content={
                    <span>
                      A custom hex color code string (e.g. #FFF000) that will
                      change the color of various regions in Commons.
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
                      : "",
                  }}
                />
              </div>
            </Form.Field>
            <Form.Field disabled={props.orgID === "libretexts"}>
              <label htmlFor="campusFooterColor">
                <span>Campus Footer Color </span>
                <Popup
                  content={
                    <span>
                      A custom hex color code string (e.g. #FFF000) that will
                      change the page footer in Commons. This should be a lighter
                      color than your Primary Color.
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
                      : "",
                  }}
                />
              </div>
            </Form.Field>
          </Segment>
          <Segment raised>
            <div>
              <p className="text-lg font-bold">Campus Aliases</p>
              <p className="">
                Add other names of your campus to help us find textbooks to
                display in Commons.
              </p>
              <div className="mt-4">
                <CampusAliasesControl
                  aliases={aliases}
                  setAliases={setAliases}
                />
              </div>
            </div>
          </Segment>
          <Segment raised>
            <div>
              <p className="text-lg font-bold">
                Custom Org/Campus List (optional)
              </p>
              <p className="">
                Customize the list of organization/campus options availble in
                certain contexts (i.e. associating organizations with a project).
                This is useful for university systems or groups that have a
                specific set of organizations they want users to be able to select
                from. If no custom list is set, the default list from LibreTexts
                will be shown.
              </p>
              <Button
                onClick={() => setShowCustomOrgListModal(true)}
                color="blue"
                className="!mt-2"
              >
                <Icon name="edit" />
                Customize
              </Button>
            </div>
          </Segment>
          <Segment raised>
            <div>
              <p className="text-lg font-bold">Campus Commons Catalog Modules</p>
              <p className="mb-2">
                Enable, disable, or re-order the display of Catalog modules in
                your Campus Commons.
              </p>
              <CommonsModuleControl
                getValues={getFormValue}
                setValue={setFormValue}
                watch={watch}
              />
            </div>
          </Segment>
          <Segment raised>
            <div>
              <p className="text-lg font-bold">
                Disable Inherent Commons Filters
              </p>
              <p className="mb-2">
                Disable the display of certain filters automatically available in
                the Commons Catalog search interface. If a Catalog module is
                disabled, the settings for that module here will have no effect.
              </p>
              <div>
                <p className="font-semibold">Assets</p>
                <div className="flex flex-row mt-2">
                  <Checkbox
                    toggle
                    label="File Type"
                    onChange={() => handleToggleAssetFilterExclusion("fileType")}
                    checked={
                      watch("assetFilterExclusions")?.includes("fileType") ??
                      false
                    }
                  />
                  <Checkbox
                    toggle
                    label="Organization"
                    onChange={() => handleToggleAssetFilterExclusion("org")}
                    checked={
                      watch("assetFilterExclusions")?.includes("org") ?? false
                    }
                    className="ml-4"
                  />
                  <Checkbox
                    toggle
                    label="People"
                    onChange={() => handleToggleAssetFilterExclusion("person")}
                    checked={
                      watch("assetFilterExclusions")?.includes("person") ?? false
                    }
                    className="ml-4"
                  />
                </div>
              </div>
            </div>
          </Segment>
        </Form>
        <CustomOrgListModal
          show={showCustomOrgListModal}
          orgID={props.orgID}
          onClose={() => setShowCustomOrgListModal(false)}
          initCustomOrgList={watch("customOrgList")}
          onSave={(newList: string[]) => {
            setFormValue("customOrgList", newList, { shouldDirty: false });
            setShowCustomOrgListModal(false);
          }}
        />
      </>
    );
  }
);

export default CampusSettingsForm;
