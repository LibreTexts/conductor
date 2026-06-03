import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  lazy,
} from "react";
import { Controller } from "react-hook-form";
import {
  Alert,
  Button,
  Popover,
  Switch,
} from "@libretexts/davis-react";
import {
  IconCircleCheck,
  IconEdit,
  IconExternalLink,
  IconInfoCircle,
  IconUpload,
} from "@tabler/icons-react";
import CtlTextInput from "../../ControlledInputs/CtlTextInput";
import {
  DEFAULT_COMMONS_MODULES,
  sanitizeCustomColor,
} from "../../../utils/campusSettingsHelpers";
import { useForm } from "react-hook-form";
import useGlobalError from "../../error/ErrorHooks";
import { useDispatch } from "react-redux";
import { CampusSettingsOpts, GetCampusAdminResponse } from "../../../types";
import { z } from "zod";
import { required } from "../../../utils/formRules";
import { useTypedSelector } from "../../../state/hooks";
import CommonsModuleControl from "./CommonsModuleControl";
import CampusAliasesControl from "./CampusAliasesControl";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import api from "../../../api";
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

const TABS = [
  { key: "aliases", label: "Aliases & Custom Lists" },
  { key: "branding", label: "Branding" },
  { key: "admins", label: "Campus Admins" },
  { key: "catalog", label: "Commons Catalog Modules" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const CampusSettingsForm = forwardRef(
  (
    props: CampusSettingsFormProps,
    ref: React.ForwardedRef<CampusSettingsFormRef>
  ) => {
    const dispatch = useDispatch();
    const org = useTypedSelector((state) => state.org);
    const { handleGlobalError } = useGlobalError();
    const [aliases, setAliases] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<TabKey>("aliases");

    const { data: campusAdmins, isLoading: loadingCampusAdmins } = useQuery<
      GetCampusAdminResponse["campusAdmins"]
    >({
      queryKey: ["campusAdmins", props.orgID],
      queryFn: async () => {
        const res = await api.getCampusAdmins(props.orgID);
        if (res.data.err) throw new Error(res.data.errMsg);
        return res.data.campusAdmins;
      },
      enabled: !!props.orgID,
      onError: (error) => handleGlobalError(error),
    });

    const {
      control,
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

    const [loadedData, setLoadedData] = useState(false);
    const [savedData, setSavedData] = useState(false);
    const [showCustomOrgListModal, setShowCustomOrgListModal] = useState(false);
    const watchedPrimaryColor = watch("primaryColor");
    const watchedFooterColor = watch("footerColor");

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

    useImperativeHandle(ref, () => ({
      requestSave() {
        handleSubmit(saveChanges)();
      },
    }));

    useEffect(() => {
      if (props.onUpdateLoadedData) props.onUpdateLoadedData(loadedData);
      if (props.onUpdateSavedData) props.onUpdateSavedData(savedData);
    }, [loadedData, savedData]);

    const getOrganization = useCallback(async () => {
      try {
        setLoadedData(false);
        const res = await axios.get(`/org/${props.orgID}`);
        if (res.data.err) throw new Error(res.data.errMsg);
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

    useEffect(() => {
      document.title = "LibreTexts Conductor | Campus Settings";
      getOrganization();
    }, [getOrganization]);

    useEffect(() => {
      if (!savedData) return;
      setTimeout(() => setSavedData(false), 3000);
    }, [savedData]);

    const saveChanges = async (d: CampusSettingsOpts) => {
      try {
        setLoadedData(false);
        d.aliases = aliases.filter(
          (alias) => alias.length >= 1 && alias.length <= 100
        );

        const hexColorSchema = z
          .string()
          .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);
        let primaryColorErr = false;
        let footerColorErr = false;

        if (
          getFormValue("primaryColor") &&
          !hexColorSchema.safeParse(getFormValue("primaryColor")!).success
        ) {
          setFormError("primaryColor", { message: "Not a valid hex color." });
          primaryColorErr = true;
        }
        if (
          getFormValue("footerColor") &&
          !hexColorSchema.safeParse(getFormValue("footerColor")!).success
        ) {
          setFormError("footerColor", { message: "Not a valid hex color." });
          footerColorErr = true;
        }
        if (primaryColorErr || footerColorErr) {
          setLoadedData(true);
          return;
        }

        d.primaryColor = sanitizeCustomColor(getFormValue("primaryColor") ?? "");
        d.footerColor = sanitizeCustomColor(getFormValue("footerColor") ?? "");

        const saveRes = await axios.put(`/org/${props.orgID}`, d);
        if (saveRes.data.err) throw new Error(saveRes.data.errMsg);
        if (saveRes.data?.updatedOrg?.orgID === org.orgID) {
          dispatch({ type: "SET_ORG_INFO", payload: saveRes.data.updatedOrg });
        }
        setLoadedData(true);
        setSavedData(true);
      } catch (err) {
        handleGlobalError(err);
      } finally {
        setLoadedData(true);
      }
    };

    function handleUploadCoverPhoto() {
      if (coverPhotoRef.current)
        (coverPhotoRef.current as HTMLInputElement).click();
    }
    function handleUploadLargeLogo() {
      if (largeLogoRef.current)
        (largeLogoRef.current as HTMLInputElement).click();
    }
    function handleUploadMediumLogo() {
      if (mediumLogoRef.current)
        (mediumLogoRef.current as HTMLInputElement).click();
    }
    function handleUploadSmallLogo() {
      if (smallLogoRef.current)
        (smallLogoRef.current as HTMLInputElement).click();
    }

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
      if (!event.target || typeof event?.target?.files !== "object") return;
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
        setFormValue(
          "assetFilterExclusions",
          [...currentExclusions, filter],
          { shouldDirty: true }
        );
      }
    }

    function InfoPopover({ content }: { content: string }) {
      return (
        <Popover>
          <Popover.Button className="inline-flex items-center text-gray-400 hover:text-gray-600 ml-1">
            <IconInfoCircle size={15} />
          </Popover.Button>
          <Popover.Panel className="text-sm max-w-xs p-2">
            {content}
          </Popover.Panel>
        </Popover>
      );
    }

    function AssetUploadField({
      label,
      description,
      fileRef,
      currentValue,
      loading,
      uploaded,
      uploadedMsg,
      onUpload,
      onFileChange,
      inputId,
    }: {
      label: string;
      description: React.ReactNode;
      fileRef: React.RefObject<any>;
      currentValue: string | undefined;
      loading: boolean;
      uploaded: boolean;
      uploadedMsg: string;
      onUpload: () => void;
      onFileChange: (e: React.FormEvent<HTMLInputElement>) => void;
      inputId: string;
    }) {
      return (
        <div className="mt-6 first:mt-0">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
          <p className="text-sm text-gray-600 mb-2">{description}</p>
          <input
            type="file"
            accept="image/jpeg,image/png"
            id={inputId}
            hidden
            ref={fileRef}
            onChange={onFileChange}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              as="a"
              href={currentValue || undefined}
              target="_blank"
              rel="noreferrer"
              disabled={!currentValue}
              icon={<IconExternalLink size={16} />}
              className="flex-1"
            >
              View Current
            </Button>
            <Button
              variant="primary"
              onClick={onUpload}
              loading={loading}
              icon={<IconUpload size={16} />}
              className="flex-1"
            >
              Upload New
            </Button>
          </div>
          {uploaded && (
            <Alert
              variant="success"
              message={uploadedMsg}
              className="mt-2"
            />
          )}
        </div>
      );
    }

    return (
      <div className="flex w-full min-h-[420px]">
        {/* Sidebar nav */}
        <nav className="w-56 shrink-0 border-r border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`w-full text-left px-4 py-3 text-sm transition-colors border-b border-gray-100 last:border-b-0 ${
                activeTab === tab.key
                  ? "bg-gray-100 font-semibold text-gray-900"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content area */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Aliases & Custom Lists */}
          {activeTab === "aliases" && (
            <div className="space-y-8">
              <div>
                <p className="text-lg font-bold">Campus Aliases</p>
                <p className="text-sm text-gray-600 mt-1">
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
              <div>
                <p className="text-lg font-bold">
                  Custom Org/Campus List (optional)
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Customize the list of organization/campus options available in
                  certain contexts (i.e. associating organizations with a
                  project). This is useful for university systems or groups that
                  have a specific set of organizations they want users to be
                  able to select from. If no custom list is set, the default
                  list from LibreTexts will be shown.
                </p>
                <Button
                  variant="primary"
                  icon={<IconEdit size={16} />}
                  className="mt-3"
                  onClick={() => setShowCustomOrgListModal(true)}
                >
                  Customize
                </Button>
                <CustomOrgListModal
                  show={showCustomOrgListModal}
                  orgID={props.orgID}
                  onClose={() => setShowCustomOrgListModal(false)}
                  initCustomOrgList={watch("customOrgList")}
                  onSave={(newList: string[]) => {
                    setFormValue("customOrgList", newList, {
                      shouldDirty: false,
                    });
                    setShowCustomOrgListModal(false);
                  }}
                />
              </div>
            </div>
          )}

          {/* Branding */}
          {activeTab === "branding" && (
            <div className="space-y-8">
              {/* Branding Images */}
              <div>
                <p className="text-lg font-bold">Branding Images</p>
                <AssetUploadField
                  label="Campus Cover Photo"
                  description={
                    <>
                      A <em>download link</em> to the organization's large cover
                      photo, displayed on the Campus Commons jumbotron.
                      Dimensions should be <em>at least</em> 1920x1080.{" "}
                      <em>
                        Organization logos should not be used as the Cover
                        Photo.
                      </em>
                    </>
                  }
                  fileRef={coverPhotoRef}
                  currentValue={getFormValue("coverPhoto")}
                  loading={coverPhotoLoading}
                  uploaded={coverPhotoUploaded}
                  uploadedMsg="Campus Cover Photo successfully uploaded."
                  onUpload={handleUploadCoverPhoto}
                  onFileChange={handleCoverPhotoFileChange}
                  inputId="conductor-org-coverphoto-upload"
                />
                <AssetUploadField
                  label="Campus Large Logo"
                  description={
                    <>
                      A <em>download link</em> to the organization's main/large
                      logo. This is typically an extended wordmark. Logo should
                      preferably have a transparent background.
                    </>
                  }
                  fileRef={largeLogoRef}
                  currentValue={getFormValue("largeLogo")}
                  loading={largeLogoLoading}
                  uploaded={largeLogoUploaded}
                  uploadedMsg="Campus Large Logo successfully uploaded."
                  onUpload={handleUploadLargeLogo}
                  onFileChange={handleLargeLogoFileChange}
                  inputId="conductor-org-large-logo-upload"
                />
                <AssetUploadField
                  label="Campus Medium Logo"
                  description={
                    <>
                      A <em>download link</em> to the organization's
                      medium-sized logo. This is typically a standard,
                      non-extended wordmark.{" "}
                      <em>
                        If the organization does not have distinct large/medium
                        logos, the same logo can be used for both.
                      </em>
                    </>
                  }
                  fileRef={mediumLogoRef}
                  currentValue={getFormValue("mediumLogo")}
                  loading={mediumLogoLoading}
                  uploaded={mediumLogoUploaded}
                  uploadedMsg="Campus Medium Logo successfully uploaded."
                  onUpload={handleUploadMediumLogo}
                  onFileChange={handleMediumLogoFileChange}
                  inputId="conductor-org-medium-logo-upload"
                />
                <AssetUploadField
                  label="Campus Small Logo"
                  description={
                    <>
                      A <em>download link</em> to the organization's smallest
                      logo. Dimensions should be approximately 800x800.{" "}
                      <em>
                        The Small Logo is not currently implemented in any
                        portion of Commons or Conductor, but has been
                        provisioned for possible future customizations.
                      </em>
                    </>
                  }
                  fileRef={smallLogoRef}
                  currentValue={getFormValue("smallLogo")}
                  loading={smallLogoLoading}
                  uploaded={smallLogoUploaded}
                  uploadedMsg="Campus Small Logo successfully uploaded."
                  onUpload={handleUploadSmallLogo}
                  onFileChange={handleSmallLogoFileChange}
                  inputId="conductor-org-small-logo-upload"
                />
              </div>

              {/* Branding Links */}
              <div>
                <p className="text-lg font-bold">Branding Links</p>
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    About Link
                    <InfoPopover content="A standard link to the organization's About page, or the main page if one is not provisioned." />
                  </label>
                  <CtlTextInput
                    id="campusAbout"
                    name="aboutLink"
                    control={control}
                    rules={required}
                  />
                </div>
              </div>

              {/* Branding Text */}
              <div>
                <p className="text-lg font-bold">Branding Text</p>
                <div className="mt-2 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Campus Commons Header
                      <InfoPopover content="An emphasized string of text placed at the top of the Catalog Search interface, used to welcome users to the Campus Commons. This text is optional." />
                    </label>
                    <CtlTextInput
                      id="campusCommonsHeader"
                      name="commonsHeader"
                      control={control}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Campus Commons Message
                      <InfoPopover content="A block of text placed at the top of the Catalog Search interface, used to welcome users to the Campus Commons. This text is optional." />
                    </label>
                    <CtlTextInput
                      id="campusCommonsMessage"
                      name="commonsMessage"
                      control={control}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">
                      Show Collections Tab?
                    </label>
                    <Controller
                      control={control}
                      name="showCollections"
                      render={({ field: { value, onChange } }) => (
                        <Switch
                          name="showCollections"
                          checked={value ?? false}
                          onChange={onChange}
                        />
                      )}
                    />
                  </div>
                  <div
                    className={
                      !watch("showCollections")
                        ? "opacity-50 pointer-events-none ml-4 space-y-4"
                        : "ml-4 space-y-4"
                    }
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Collections Display Label
                        <InfoPopover content="An alternate name for Collections (eg. Departments, Colleges, etc.). This text is optional." />
                      </label>
                      <CtlTextInput
                        id="collectionsDisplayLabel"
                        name="collectionsDisplayLabel"
                        control={control}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Collections Message
                        <InfoPopover content="A block of text placed at the top of the Collections interface, used to welcome users to the Collections. This text is optional." />
                      </label>
                      <CtlTextInput
                        id="collectionsMessage"
                        name="collectionsMessage"
                        control={control}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Branding Colors */}
              <div>
                <p className="text-lg font-bold">Branding Colors</p>
                <div className="mt-2 space-y-4">
                  <div
                    className={
                      props.orgID === "libretexts"
                        ? "opacity-50 pointer-events-none"
                        : ""
                    }
                  >
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Campus Primary Color
                      <InfoPopover content="A custom hex color code string (e.g. #FFF000) that will change the color of various regions in Commons. This is optional." />
                    </label>
                    <CtlTextInput
                      id="primaryColor"
                      name="primaryColor"
                      control={control}
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-gray-600">
                        Primary Color Preview
                      </span>
                      <div
                        className="w-8 h-8 rounded border border-gray-300"
                        style={{
                          backgroundColor: watchedPrimaryColor?.toString()
                            ? sanitizeCustomColor(
                                watchedPrimaryColor.toString()
                              )
                            : "",
                        }}
                      />
                    </div>
                  </div>
                  <div
                    className={
                      props.orgID === "libretexts"
                        ? "opacity-50 pointer-events-none"
                        : ""
                    }
                  >
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Campus Footer Color
                      <InfoPopover content="A custom hex color code string (e.g. #FFF000) that will change the page footer in Commons. This should be a lighter color than your Primary Color. This is optional." />
                    </label>
                    <CtlTextInput
                      id="footerColor"
                      name="footerColor"
                      control={control}
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-gray-600">
                        Footer Color Preview
                      </span>
                      <div
                        className="w-8 h-8 rounded border border-gray-300"
                        style={{
                          backgroundColor: watchedFooterColor?.toString()
                            ? sanitizeCustomColor(
                                watchedFooterColor.toString()
                              )
                            : "",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Campus Admins */}
          {activeTab === "admins" && (
            <div>
              <p className="text-lg font-bold mb-2">Campus Admins</p>
              <p className="text-sm text-gray-600 mb-4">
                Campus Admins are users who have elevated permissions to manage
                the Campus Commons. They can edit Campus Settings, manage
                Collections, and more. If you need to add or remove Campus
                Admins, please contact our{" "}
                <a
                  href="https://commons.libretexts.org/support/contact"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Support Center
                </a>
                .
              </p>
              {loadingCampusAdmins ? (
                <p className="text-sm text-gray-500">
                  Loading campus admins...
                </p>
              ) : campusAdmins && campusAdmins.length > 0 ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">
                          Email
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {campusAdmins.map((admin) => (
                        <tr key={admin.uuid}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {admin.avatar && (
                                <img
                                  src={admin.avatar}
                                  alt={`${admin.firstName} ${admin.lastName}'s avatar`}
                                  className="w-7 h-7 rounded-full"
                                />
                              )}
                              <span>{`${admin.firstName} ${admin.lastName}`}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {admin.email}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No campus admins found.
                </p>
              )}
            </div>
          )}

          {/* Commons Catalog Modules */}
          {activeTab === "catalog" && (
            <div className="space-y-8">
              <div>
                <p className="text-lg font-bold">
                  Campus Commons Catalog Modules
                </p>
                <p className="text-sm text-gray-600 mt-1 mb-4">
                  Enable, disable, or re-order the display of Catalog modules in
                  your Campus Commons.
                </p>
                <CommonsModuleControl
                  getValues={getFormValue}
                  setValue={setFormValue}
                  watch={watch}
                />
              </div>
              <div>
                <p className="text-lg font-bold">
                  Disable Inherent Commons Filters
                </p>
                <p className="text-sm text-gray-600 mt-1 mb-4">
                  Disable the display of certain filters automatically available
                  in the Commons Catalog search interface. If a Catalog module
                  is disabled, the settings for that module here will have no
                  effect.
                </p>
                <div>
                  <p className="font-semibold text-sm mb-3">Assets</p>
                  <div className="flex flex-col gap-3">
                    <Switch
                      name="fileType"
                      label="File Type"
                      checked={
                        watch("assetFilterExclusions")?.includes("fileType") ??
                        false
                      }
                      onChange={() =>
                        handleToggleAssetFilterExclusion("fileType")
                      }
                    />
                    <Switch
                      name="org"
                      label="Organization"
                      checked={
                        watch("assetFilterExclusions")?.includes("org") ?? false
                      }
                      onChange={() => handleToggleAssetFilterExclusion("org")}
                    />
                    <Switch
                      name="person"
                      label="People"
                      checked={
                        watch("assetFilterExclusions")?.includes("person") ??
                        false
                      }
                      onChange={() =>
                        handleToggleAssetFilterExclusion("person")
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default CampusSettingsForm;
