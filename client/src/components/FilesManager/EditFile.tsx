import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import {
  Modal,
  Form,
  Button,
  Icon,
  ModalProps,
  Dropdown,
  Accordion,
} from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import { Controller, useForm } from "react-hook-form";
import { AssetTag, AssetTagFramework, License, ProjectFile } from "../../types";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { required } from "../../utils/formRules";
import CtlTextArea from "../ControlledInputs/CtlTextArea";
import api from "../../api";
import { cleanTagsForRequest } from "../../utils/assetHelpers";
import { AssetTagWithKey } from "../../types/AssetTagging";
import { isAssetTagKeyObject } from "../../utils/typeHelpers";
import CtlCheckbox from "../ControlledInputs/CtlCheckbox";
import { useTypedSelector } from "../../state/hooks";
import LoadingSpinner from "../LoadingSpinner";
import AuthorsForm from "./AuthorsForm";
import FilePreview from "./FilePreview";
import ManageCaptionsModal from "./ManageCaptionsModal";
import { useQuery } from "@tanstack/react-query";
import useCentralIdentityLicenses from "../../hooks/useCentralIdentityLicenses";
import RenderTagFields from "./RenderTagFields";
const FilesUploader = React.lazy(() => import("./FilesUploader"));

interface EditFileProps extends ModalProps {
  show: boolean;
  onClose: () => void;
  projectID: string;
  fileID: string;
  onFinishedEdit: () => void;
}

const EditFile: React.FC<EditFileProps> = ({
  show,
  onClose,
  projectID,
  fileID,
  onFinishedEdit,
  ...rest
}) => {
  const DESCRIP_MAX_CHARS = 500;

  // Global State & Hooks
  const { handleGlobalError } = useGlobalError();
  const org = useTypedSelector((state) => state.org);
  const authorsFormRef = useRef<React.ElementRef<typeof AuthorsForm>>(null);
  const tagFieldsRef = useRef<React.ElementRef<typeof RenderTagFields>>(null);
  const {
    control,
    getValues,
    setValue,
    watch,
    reset,
    formState,
    trigger,
    clearErrors,
  } = useForm<ProjectFile>({
    defaultValues: {
      name: "",
      description: "",
      license: {
        name: "",
        version: "",
        url: "",
        sourceURL: "",
        modifiedFromSource: false,
        additionalTerms: "",
      },
      authors: [],
      publisher: {
        name: "",
        url: "",
      },
    },
    mode: "onChange",
    reValidateMode: "onChange",
  });

  // Data & UI
  const [loading, setLoading] = useState(false);
  const [isFolder, setIsFolder] = useState(false); // No asset tags for folders
  const [showUploader, setShowUploader] = useState(false);
  const [showLicenseInfo, setShowLicenseInfo] = useState(true);
  const [showAuthorInfo, setShowAuthorInfo] = useState(true);
  const [showTags, setShowTags] = useState(true);
  const [showCaptionsModal, setShowCaptionsModal] = useState(false);
  const [videoStreamURL, setVideoStreamURL] = useState<string | undefined>(
    undefined
  ); // Video stream URL for video files

  const { licenseOptions, isFetching: licensesLoading } =
    useCentralIdentityLicenses();

  const {
    data: projectLicenseSettings,
    isFetching: projectLicenseSettingsLoading,
  } = useQuery<License | null>({
    queryKey: ["projectLicenseSettings", projectID],
    queryFn: loadProjectLicenseSettings,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const { data: campusDefaultFramework, isFetching: campusDefaultLoading } =
    useQuery<AssetTagFramework | null>({
      queryKey: ["campusDefaultFramework", org.orgID],
      queryFn: loadCampusDefault,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    });

  // Effects
  useEffect(() => {
    if (show) {
      loadFile();
    }
  }, [show]);

  useEffect(() => {
    if (!campusDefaultFramework) return;
    tagFieldsRef.current?.changeSelectedFramework(campusDefaultFramework);
  }, [watch("fileID"), campusDefaultFramework]);

  useEffect(() => {
    if (watch("license.name")) return; // Don't overwrite license if already set

    if (!projectLicenseSettings) return;
    setValue("license", projectLicenseSettings);
  }, [watch("fileID"), watch("license.name"), projectLicenseSettings]);

  // Update license URL and (version as appropriate) when license name changes
  useEffect(() => {
    if (getValues("license.name") === undefined) return;

    // If license name is cleared, clear license URL and version
    if (getValues("license.name") === "") {
      setValue("license.url", "");
      setValue("license.version", "");
      return;
    }

    const license = licenseOptions?.find(
      (l) => l.name === getValues("license.name")
    );
    if (!license) return;

    // If license no longer has versions, clear license version, otherwise set to first version
    if (!license.versions || license.versions.length === 0) {
      setValue("license.version", "");
    } else {
      setValue("license.version", license.versions[0]);
    }
    setValue("license.url", license.url ?? "");
  }, [watch("license.name")]);

  // Return new license version options when license name changes
  const selectedLicenseVersions = useCallback(() => {
    const license = licenseOptions?.find(
      (l) => l.name === getValues("license.name")
    );
    if (!license) return [];
    return license.versions ?? [];
  }, [watch("license.name"), licenseOptions]);

  // Handlers & Methods
  async function loadFile() {
    try {
      if (!projectID || !fileID) return;
      setLoading(true);
      const res = await api.getProjectFile(projectID, fileID);
      if (!res || res.data.err || !res.data.file) {
        throw new Error("Failed to load file");
      }

      const fileData = res.data.file;
      const parsedExistingTags: AssetTag[] =
        fileData.tags?.map((t: AssetTag | AssetTagWithKey) => {
          return {
            ...t,
            key: isAssetTagKeyObject(t.key) ? t.key.title : t.key,
          };
        }) ?? [];
      reset(
        {
          ...fileData,
          tags: parsedExistingTags,
        },
        { keepDefaultValues: true }
      );
      setIsFolder(fileData.storageType !== "file");
      if (res.data.videoStreamURL && fileData.isVideo) {
        setVideoStreamURL(res.data.videoStreamURL);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadProjectLicenseSettings() {
    try {
      const res = await api.getProject(projectID);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.project) {
        throw new Error("Failed to load project");
      }

      if (
        res.data.project.defaultFileLicense &&
        typeof res.data.project.defaultFileLicense === "object"
      ) {
        return res.data.project.defaultFileLicense as License;
      }
      return null;
    } catch (err) {
      handleGlobalError(err);
      return null;
    }
  }

  async function loadCampusDefault() {
    try {
      const res = await api.getCampusDefaultFramework(org.orgID);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.framework) {
        return null;
      }
      return res.data.framework;
    } catch (err) {
      handleGlobalError(err);
      return null;
    }
  }

  /**
   * Submits the file edit request to the server (if form is valid) and
   * closes the modal on completion.
   */
  async function handleEdit() {
    try {
      setLoading(true);

      if (!isFolder) {
        // Get authors data from AuthorsForm component
        const authors = authorsFormRef.current?.getAuthors();
        if (!authors) {
          throw new Error("Failed to get authors");
        }
        setValue("primaryAuthor", authors.primaryAuthor ?? undefined);
        setValue("authors", authors.authors);
        setValue(
          "correspondingAuthor",
          authors.correspondingAuthor ?? undefined
        );
      }

      const valid = await trigger(); // Trigger validation on all fields
      if (!valid) return;
      const vals = getValues();

      const editRes = await axios.put(
        `/project/${projectID}/files/${vals.fileID}`,
        {
          name: vals.name,
          description: vals.description,
          ...(!isFolder && {
            license: vals.license,
            primaryAuthor: vals.primaryAuthor ?? undefined,
            authors: vals.authors ?? undefined,
            correspondingAuthor: vals.correspondingAuthor ?? undefined,
            publisher: vals.publisher,
            tags: cleanTagsForRequest(vals.tags ?? []),
          }),
        }
      );

      if (editRes.data.err) {
        throw new Error(editRes.data.errMsg);
      }

      setLoading(false);
      onFinishedEdit();
    } catch (e) {
      handleGlobalError(e);
    } finally {
      setLoading(false);
    }
  }

  function handleToggleAll() {
    const currVal = showLicenseInfo && showAuthorInfo && showTags;
    setShowLicenseInfo(!currVal);
    setShowAuthorInfo(!currVal);
    setShowTags(!currVal);
  }

  function handleUploadFinished() {
    onFinishedEdit();
  }

  function handleNoExternalSource() {
    setValue("license.sourceURL", "local");
  }

  function handleResetExternalSource() {
    setValue("license.sourceURL", "");
  }

  return (
    <Modal open={show} onClose={onClose} size="fullscreen" {...rest}>
      <Modal.Header>
        <h1>Edit {isFolder ? "Folder" : "File"}</h1>
      </Modal.Header>
      <Modal.Content scrolling>
        {loading && <LoadingSpinner />}
        {!loading && (
          <Form
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <div className="flex flex-row -mt-1">
              <div
                className={`flex flex-col pr-8 mt-1 ${
                  isFolder ? "w-full" : "basis-1/2"
                }`}
              >
                <CtlTextInput
                  name="name"
                  label="Name"
                  control={control}
                  rules={required}
                  required
                  maxLength={100}
                />
                <div className="mt-4">
                  <CtlTextArea
                    name="description"
                    label="Description"
                    control={control}
                    placeholder="Describe this file or folder..."
                    maxLength={DESCRIP_MAX_CHARS}
                    showRemaining
                  />
                </div>
                {!isFolder && !getValues("isVideo") && (
                  <div className="mt-4">
                    <Button
                      color="blue"
                      onClick={() => setShowUploader(true)}
                      disabled={false}
                      type="button"
                    >
                      <Icon name="upload" />
                      Replace File
                    </Button>
                  </div>
                )}
                {!isFolder &&
                  getValues("isVideo") &&
                  getValues("videoStorageID") && (
                    <div className="mt-4">
                      <Button
                        color="blue"
                        onClick={() => setShowCaptionsModal(true)}
                        disabled={false}
                        type="button"
                      >
                        <Icon name="closed captioning outline" />
                        Manage Captions
                      </Button>
                    </div>
                  )}
                <FilePreview
                  className="mt-8"
                  projectID={projectID}
                  fileID={fileID}
                  name={getValues("name")}
                  isURL={getValues("isURL")}
                  url={getValues("url")}
                  isVideo={getValues("isVideo")}
                  videoStorageID={getValues("videoStorageID")}
                  storageType={getValues("storageType")}
                  videoStreamURL={videoStreamURL}
                />
              </div>
              {!isFolder && (
                <div className="flex flex-col basis-1/2">
                  <p
                    onClick={handleToggleAll}
                    className="text-right underline text-sm text-gray-500 mr-2 mb-2 cursor-pointer !-mt-1"
                  >
                    Toggle All
                  </p>
                  <div className="flex flex-col rounded-md shadow-lg border p-4">
                    <Accordion>
                      <Accordion.Title
                        active={showLicenseInfo}
                        index={0}
                        onClick={() => setShowLicenseInfo(!showLicenseInfo)}
                      >
                        <Icon name="dropdown" />
                        <span className="font-semibold">License Info</span>
                      </Accordion.Title>
                      <Accordion.Content active={showLicenseInfo}>
                        <div>
                          <label
                            className="form-field-label form-required"
                            htmlFor="selectLicenseName"
                          >
                            Name
                          </label>
                          <Controller
                            render={({ field }) => (
                              <Dropdown
                                id="selectLicenseName"
                                options={licenseOptions?.map((l) => ({
                                  key: l.name,
                                  value: l.name,
                                  text: l.name,
                                }))}
                                {...field}
                                onChange={(e, data) => {
                                  field.onChange(data.value?.toString() ?? "");
                                }}
                                fluid
                                selection
                                placeholder="Select a license..."
                                error={
                                  formState.errors.license?.name ? true : false
                                }
                              />
                            )}
                            name="license.name"
                            control={control}
                            rules={required}
                          />
                        </div>
                        {selectedLicenseVersions().length > 0 && (
                          <div className="mt-4">
                            <label
                              className="form-field-label form-required"
                              htmlFor="selectLicenseVersion"
                            >
                              Version
                            </label>
                            <Controller
                              render={({ field }) => (
                                <Dropdown
                                  id="selectLicenseVersion"
                                  options={selectedLicenseVersions().map(
                                    (v) => ({
                                      key: v,
                                      value: v,
                                      text: v,
                                    })
                                  )}
                                  {...field}
                                  onChange={(e, data) => {
                                    field.onChange(
                                      data.value?.toString() ?? ""
                                    );
                                  }}
                                  fluid
                                  selection
                                  placeholder="Select license version"
                                  error={
                                    formState.errors.license?.version
                                      ? true
                                      : false
                                  }
                                  loading={licensesLoading}
                                />
                              )}
                              name="license.version"
                              control={control}
                              rules={required}
                            />
                          </div>
                        )}
                        <CtlTextInput
                          name="license.sourceURL"
                          control={control}
                          label="File Source URL"
                          placeholder="https://example.com"
                          className="mt-2"
                          helpText="URL where the file was sourced from"
                          disabled={watch("license.sourceURL") === "local"}
                        />
                        {watch("license.sourceURL") !== "local" && (
                          <p
                            className="text-sky-500 ml-1 mt-1 cursor-pointer hover:underline"
                            onClick={handleNoExternalSource}
                          >
                            This file doesn't have an external source.
                          </p>
                        )}
                        {watch("license.sourceURL") === "local" && (
                          <p
                            className="text-sky-500 ml-1 mt-1 cursor-pointer hover:underline"
                            onClick={handleResetExternalSource}
                          >
                            Add an external source URL
                          </p>
                        )}
                        <div className="flex items-start mt-3">
                          <CtlCheckbox
                            name="license.modifiedFromSource"
                            control={control}
                            label="File modified from source?"
                            labelDirection="row-reverse"
                          />
                        </div>
                        <CtlTextArea
                          name="license.additionalTerms"
                          control={control}
                          label="Additional License Terms"
                          placeholder="Additional terms (if applicable)..."
                          className="mt-2"
                          maxLength={DESCRIP_MAX_CHARS}
                          showRemaining
                        />
                      </Accordion.Content>
                    </Accordion>
                  </div>
                  <div className="flex flex-col rounded-md shadow-lg border p-4 mt-4">
                    <Accordion>
                      <Accordion.Title
                        active={showAuthorInfo}
                        index={0}
                        onClick={() => setShowAuthorInfo(!showAuthorInfo)}
                      >
                        <Icon name="dropdown" />
                        <span className="font-semibold">
                          Author & Publisher Info
                        </span>
                      </Accordion.Title>
                      <Accordion.Content active={showAuthorInfo}>
                        <AuthorsForm
                          ref={authorsFormRef}
                          mode="file"
                          currentPrimaryAuthor={getValues("primaryAuthor")}
                          currentAuthors={getValues("authors")}
                          currentCorrespondingAuthor={getValues(
                            "correspondingAuthor"
                          )}
                        />
                        <CtlTextInput
                          name="publisher.name"
                          control={control}
                          label="Publisher Name"
                          placeholder="John Doe"
                          className=""
                        />
                        <CtlTextInput
                          name="publisher.url"
                          control={control}
                          label="Publisher URL"
                          placeholder="https://example.com"
                          className="mt-2"
                        />
                      </Accordion.Content>
                    </Accordion>
                  </div>
                  {org.FEAT_AssetTagsManager && (
                    <div className="flex flex-col rounded-md shadow-lg border p-4 mt-4">
                      <Accordion>
                        <Accordion.Title
                          active={showTags}
                          index={0}
                          onClick={() => setShowTags(!showTags)}
                        >
                          <Icon name="dropdown" />
                          <span className="font-semibold">Tags</span>
                        </Accordion.Title>
                        <Accordion.Content active={showTags}>
                          <RenderTagFields
                            ref={tagFieldsRef}
                            control={control}
                            formState={formState}
                          />
                        </Accordion.Content>
                      </Accordion>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Form>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="green" onClick={() => handleEdit()} loading={loading}>
          <Icon name="save" />
          Save
        </Button>
      </Modal.Actions>
      <ManageCaptionsModal
        show={showCaptionsModal}
        onClose={() => setShowCaptionsModal(false)}
        projectID={projectID}
        fileID={fileID}
        key="captions-modal"
      />
      <FilesUploader
        show={showUploader}
        onClose={() => setShowUploader(false)}
        directory={""}
        projectID={projectID}
        uploadPath={watch("parent") ?? ""}
        onFinishedUpload={handleUploadFinished}
        projectHasDefaultLicense={false}
        mode="replace"
        fileID={fileID}
      />
    </Modal>
  );
};

export default EditFile;
