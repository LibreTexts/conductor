import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import {
  Modal,
  Form,
  Button,
  Icon,
  ModalProps,
  Table,
  Dropdown,
  Accordion,
} from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import { Controller, get, useFieldArray, useForm } from "react-hook-form";
import {
  AssetTag,
  AssetTagFramework,
  Author,
  CentralIdentityLicense,
  ProjectFile,
} from "../../types";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { required } from "../../utils/formRules";
import CtlTextArea from "../ControlledInputs/CtlTextArea";
import SelectFramework from "./SelectFramework";
import api from "../../api";
import {
  cleanTagsForRequest,
  getInitValueFromTemplate,
} from "../../utils/assetHelpers";
import { RenderTagInput } from "./RenderTagInput";
import {
  AssetTagTemplate,
  AssetTagValue,
  AssetTagWithKey,
} from "../../types/AssetTagging";
import { isAssetTagKeyObject } from "../../utils/typeHelpers";
import CtlCheckbox from "../ControlledInputs/CtlCheckbox";
import URLFileHyperlink from "./URLFileHyperlink";
import { useTypedSelector } from "../../state/hooks";
import LoadingSpinner from "../LoadingSpinner";
import useDebounce from "../../hooks/useDebounce";
import AuthorsForm from "./AuthorsForm";
import FilePreview from "./FilePreview";
import ManageCaptionsModal from "./ManageCaptionsModal";
const FilesUploader = React.lazy(() => import("./FilesUploader"));
const FileRenderer = React.lazy(() => import("./FileRenderer"));

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
  const { debounce } = useDebounce();
  const org = useTypedSelector((state) => state.org);
  const authorsFormRef = useRef<React.ElementRef<typeof AuthorsForm>>(null);
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
  const {
    fields: tagFields,
    append: tagAppend,
    prepend: tagPrepend,
    remove: tagRemove,
    move: tagMove,
    insert: tagInsert,
    update: tagUpdate,
  } = useFieldArray({
    control,
    name: "tags",
  });

  // Data & UI
  const [loading, setLoading] = useState(false);
  const [licensesLoading, setLicensesLoading] = useState(false);
  const [isFolder, setIsFolder] = useState(false); // No asset tags for folders
  const [showUploader, setShowUploader] = useState(false);
  const [showLicenseInfo, setShowLicenseInfo] = useState(true);
  const [showAuthorInfo, setShowAuthorInfo] = useState(true);
  const [showTags, setShowTags] = useState(true);
  const [showSelectFramework, setShowSelectFramework] = useState(false);
  const [showCaptionsModal, setShowCaptionsModal] = useState(false);
  const [videoStreamURL, setVideoStreamURL] = useState<string | undefined>(
    undefined
  ); // Video stream URL for video files

  // Frameworks
  const [selectedFramework, setSelectedFramework] =
    useState<AssetTagFramework | null>(null);

  // Licenses
  const [licenseOptions, setLicenseOptions] = useState<
    CentralIdentityLicense[]
  >([]);

  // Effects
  useEffect(() => {
    if (show) {
      loadLicenseOptions();
      loadFile().then(() => loadProjectLicenseSettings()); // Load file first, then project license settings
    }
  }, [show]);

  useEffect(() => {
    if (selectedFramework) {
      genTagsFromFramework();
    }
  }, [selectedFramework]);

  // Update license URL and (version as appropriate) when license name changes
  useEffect(() => {
    if (getValues("license.name") === undefined) return;

    // If license name is cleared, clear license URL and version
    if (getValues("license.name") === "") {
      setValue("license.url", "");
      setValue("license.version", "");
      return;
    }

    const license = licenseOptions.find(
      (l) => l.name === getValues("license.name")
    );
    if (!license) return;

    // If license no longer has versions, clear license version
    if (!license.versions || license.versions.length === 0) {
      setValue("license.version", "");
    }
    setValue("license.url", license.url ?? "");
  }, [watch("license.name")]);

  // Return new license version options when license name changes
  const selectedLicenseVersions = useCallback(() => {
    const license = licenseOptions.find(
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
      if (fileData.storageType === "file") {
        checkCampusDefault(); // We want to make sure the file is loaded before checking for campus default and updating tags (if applicable)
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadProjectLicenseSettings() {
    try {
      if (getValues("license.name")) return; // Don't load project license settings if file license is already set
      setLoading(true);

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
        setValue("license", res.data.project.defaultFileLicense);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Loads the default framework for the campus, if one exists.
   */
  async function checkCampusDefault() {
    try {
      const existing = getValues("tags");
      if (existing && existing.length > 0) return; // Don't load campus default if tags already exist
      setLoading(true);
      const res = await api.getCampusDefaultFramework(org.orgID);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.framework) return;
      setSelectedFramework(res.data.framework);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadLicenseOptions() {
    try {
      setLicensesLoading(true);
      const res = await api.getCentralIdentityLicenses();
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.licenses) {
        throw new Error("Failed to load license options");
      }

      const versionsSorted = res.data.licenses.map((l) => {
        return {
          ...l,
          versions: l.versions?.sort((a, b) => {
            if (a === b) return 0;
            if (!a) return -1;
            if (!b) return 1;
            return b.localeCompare(a);
          }),
        };
      });
      setLicenseOptions(versionsSorted);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLicensesLoading(false);
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

  async function loadFramework(id: string) {
    try {
      if (!id) return;
      if (isFolder) return; // No asset tags for folders
      setLoading(true);

      const res = await api.getFramework(id);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.framework) {
        throw new Error("Failed to load framework");
      }

      const parsed: AssetTagTemplate[] = res.data.framework.templates.map(
        (t) => {
          return {
            ...t,
            key: isAssetTagKeyObject(t.key) ? t.key.title : t.key,
          };
        }
      );

      setSelectedFramework({
        ...res.data.framework,
        templates: parsed,
      });
      genTagsFromFramework();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  function genTagsFromFramework() {
    if (isFolder) return; // No asset tags for folders
    if (!selectedFramework || !selectedFramework.templates) return;

    // Don't duplicate tags when adding from framework
    const existingTags = getValues().tags;
    let filtered: AssetTagTemplate[] = [];

    if (existingTags && existingTags.length > 0) {
      const valsToCheck = existingTags.map((t) =>
        isAssetTagKeyObject(t.key) ? t.key.title : t.key
      );
      filtered = selectedFramework.templates.filter(
        (t) =>
          !valsToCheck.includes(
            isAssetTagKeyObject(t.key) ? t.key.title : t.key
          )
      );
    } else {
      filtered = selectedFramework.templates;
    }

    filtered.forEach((t) => {
      addTag({
        key: isAssetTagKeyObject(t.key) ? t.key.title : t.key,
        value: getInitValueFromTemplate(t),
        framework: selectedFramework,
      });
    });
  }

  function addTag({
    key,
    value,
    framework,
  }: {
    key?: string;
    value?: AssetTagValue;
    framework?: AssetTagFramework;
  }) {
    if (isFolder) return; // No asset tags for folders
    tagAppend(
      {
        uuid: crypto.randomUUID(), // Random UUID for new tags, will be replaced with real UUID server-side on save
        key: key ?? "",
        value: value ?? "",
        framework: framework ?? undefined,
      },
      { shouldFocus: false }
    );
  }

  function handleToggleAll() {
    const currVal = showLicenseInfo && showAuthorInfo && showTags;
    setShowLicenseInfo(!currVal);
    setShowAuthorInfo(!currVal);
    setShowTags(!currVal);
  }

  function handleMoveUp(index: number) {
    if (index === 0) return; // Don't move if already at top
    // Check index - 1 exists
    if (!tagFields[index - 1]) return;
    tagMove(index, index - 1);
  }

  function handleMoveDown(index: number) {
    if (index === tagFields.length - 1) return; // Don't move if already at bottom
    tagMove(index, index + 1);
  }

  function handleUploadFinished() {
    onFinishedEdit();
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
                {!isFolder && getValues("isVideo") && getValues('videoStorageID') && (
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
                  file={watch()}
                  videoStreamURL={videoStreamURL}
                />
              </div>
              {!isFolder && (
                <div className="flex flex-col basis-1/2">
                  <p
                    onClick={handleToggleAll}
                    className="text-right underline text-sm text-gray-500 mr-2 mb-2 cursor-pointer"
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
                                options={licenseOptions.map((l) => ({
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
                          <div className="mt-2">
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
                          required
                          rules={required}
                        />
                        <div className="flex items-start mt-3">
                          <CtlCheckbox
                            name="license.modifiedFromSource"
                            control={control}
                            label="File modified from source?"
                            className="ml-2"
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
                          <Table celled>
                            <Table.Header fullWidth>
                              <Table.Row key="header">
                                <Table.HeaderCell>Tag Title</Table.HeaderCell>
                                <Table.HeaderCell>Value</Table.HeaderCell>
                                <Table.HeaderCell width={1}>
                                  Actions
                                </Table.HeaderCell>
                              </Table.Row>
                            </Table.Header>
                            <Table.Body>
                              {tagFields && tagFields.length > 0 ? (
                                tagFields.map((tag, index) => (
                                  <Table.Row key={tag.id}>
                                    <Table.Cell>
                                      {tag.framework ? (
                                        <div className="flex flex-col">
                                          <p>
                                            {isAssetTagKeyObject(tag.key)
                                              ? tag.key.title
                                              : tag.key}
                                          </p>
                                        </div>
                                      ) : (
                                        <CtlTextInput
                                          name={`tags.${index}.key`}
                                          control={control}
                                          fluid
                                        />
                                      )}
                                    </Table.Cell>
                                    <Table.Cell>
                                      <RenderTagInput
                                        tag={tag}
                                        index={index}
                                        control={control}
                                        formState={formState}
                                      />
                                    </Table.Cell>
                                    <Table.Cell>
                                      {/* <Button
                                      icon="arrow up"
                                      onClick={() => handleMoveUp(index)}
                                    />
                                    <Button
                                      icon="arrow down"
                                      onClick={() => handleMoveDown(index)}
                                      className="!ml-1"
                                    /> */}
                                      <Button
                                        color="red"
                                        icon="trash"
                                        onClick={() => tagRemove(index)}
                                        className="!ml-1"
                                      ></Button>
                                    </Table.Cell>
                                  </Table.Row>
                                ))
                              ) : (
                                <Table.Row>
                                  <Table.Cell
                                    colSpan={3}
                                    className="text-center"
                                  >
                                    No tags have been added to this file.
                                  </Table.Cell>
                                </Table.Row>
                              )}
                            </Table.Body>
                          </Table>
                          <div className="flex flex-row">
                            <Button color="blue" onClick={() => addTag({})}>
                              <Icon name="plus" />
                              Add Tag
                            </Button>
                            <Button
                              color="blue"
                              onClick={() => setShowSelectFramework(true)}
                            >
                              <Icon name="plus" />
                              Add From Framework
                            </Button>
                          </div>
                          {formState.errors.tags && (
                            <p className="text-red-500 text-center mt-4 italic">
                              {formState.errors.tags
                                ? "One or more tags are missing values. If you do not wish to provide a value for an input, delete the tag before saving."
                                : ""}
                            </p>
                          )}
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
      <SelectFramework
        show={showSelectFramework}
        onClose={() => setShowSelectFramework(false)}
        onSelected={(id: string) => {
          loadFramework(id);
          setShowSelectFramework(false);
        }}
      />
      <ManageCaptionsModal
        show={showCaptionsModal}
        onClose={() => setShowCaptionsModal(false)}
        projectID={projectID}
        fileID={fileID}
        key='captions-modal'
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
