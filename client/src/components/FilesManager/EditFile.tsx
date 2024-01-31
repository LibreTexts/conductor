import React, { useState, useEffect, useCallback } from "react";
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
  Card,
  Input,
  Divider,
} from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import { Controller, get, useFieldArray, useForm } from "react-hook-form";
import {
  AssetTag,
  AssetTagFramework,
  Author,
  CentralIdentityLicense,
  GenericKeyTextValueObj,
  ProjectFile,
} from "../../types";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { required } from "../../utils/formRules";
import CtlTextArea from "../ControlledInputs/CtlTextArea";
import SelectFramework from "./SelectFramework";
import api from "../../api";
import { getInitValueFromTemplate } from "../../utils/assetHelpers";
import { RenderTagInput } from "./RenderTagInput";
import {
  AssetTagTemplate,
  AssetTagValue,
  AssetTagWithKey,
} from "../../types/AssetTagging";
import {
  isAssetTagFramework,
  isAssetTagKeyObject,
} from "../../utils/typeHelpers";
import CtlCheckbox from "../ControlledInputs/CtlCheckbox";
import URLFileIFrame from "./URLFileIFrame";
import URLFileHyperlink from "./URLFileHyperlink";
import { useTypedSelector } from "../../state/hooks";
import { sortXByOrderOfY } from "../../utils/misc";
import LoadingSpinner from "../LoadingSpinner";
import useDebounce from "../../hooks/useDebounce";
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

  const {
    fields: authorFields,
    append: authorAppend,
    prepend: authorPrepend,
    remove: authorRemove,
    move: authorMove,
    insert: authorInsert,
    update: authorUpdate,
  } = useFieldArray({
    control,
    name: "authors",
  });

  // Data & UI
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [filePreviewURL, setFilePreviewURL] = useState<string>("");
  const [isFolder, setIsFolder] = useState(false); // No asset tags for folders
  const [showUploader, setShowUploader] = useState(false);
  const [shouldShowPreview, setShouldShowPreview] = useState(false);
  const [showLicenseInfo, setShowLicenseInfo] = useState(true);
  const [showAuthorInfo, setShowAuthorInfo] = useState(true);
  const [showTags, setShowTags] = useState(true);
  const [showSelectFramework, setShowSelectFramework] = useState(false);

  // Frameworks
  const [selectedFramework, setSelectedFramework] =
    useState<AssetTagFramework | null>(null);

  // Licenses
  const [licenseOptions, setLicenseOptions] = useState<
    CentralIdentityLicense[]
  >([]);

  // Authors
  const [authorOptions, setAuthorOptions] = useState<Author[]>([]);
  const [loadingAuthors, setLoadingAuthors] = useState(false);
  const [selectingExistingAuthor, setSelectingExistingAuthor] = useState(true);
  const [newAuthor, setNewAuthor] = useState<Author>({
    firstName: "",
    lastName: "",
    email: "",
    url: "",
    primaryInstitution: "",
  });
  const [orgOptions, setOrgOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [loadingOrgs, setLoadingOrgs] = useState<boolean>(false);

  // Effects
  useEffect(() => {
    if (show) {
      loadLicenseOptions();
      loadFile();
      loadAuthorOptions();
    }
  }, [show]);

  useEffect(() => {
    if (selectedFramework) {
      genTagsFromFramework();
    }
  }, [selectedFramework]);

  // Load orgs if not selecting existing author
  useEffect(() => {
    if (!selectingExistingAuthor) getOrgs();
  }, [selectingExistingAuthor]);

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
      _checkShouldShowPreview(fileData);
      if (fileData.storageType === "file") {
        checkCampusDefault(); // We want to make sure the file is loaded before checking for campus default and updating tags (if applicable)
        loadFileURL(); // Don't await this, we don't want to block the rest of the load
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

  function _checkShouldShowPreview(fileData: ProjectFile) {
    // Don't show preview for folders
    if (fileData.storageType !== "file") {
      setShouldShowPreview(false);
      return;
    }

    if (fileData.storageType === "file" && fileData.isURL && fileData.url) {
      setShouldShowPreview(true);
      return;
    }

    // Check if file is an image
    const ext = fileData.name.split(".").pop()?.toLowerCase();
    const validImgExt = ["png", "jpg", "jpeg", "gif", "bmp", "svg"].includes(
      ext ?? ""
    );
    if (!validImgExt) {
      setShouldShowPreview(false);
      return;
    }

    setShouldShowPreview(true);
  }

  async function loadFileURL() {
    try {
      setPreviewLoading(true);
      const res = await api.getFileDownloadURL(projectID, fileID, false);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.url) {
        throw new Error("Failed to load file preview");
      }
      setFilePreviewURL(res.data.url);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function loadLicenseOptions() {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  }

  async function loadAuthorOptions(searchQuery?: string) {
    try {
      setLoadingAuthors(true);
      const res = await api.getAuthors({ query: searchQuery });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.authors) {
        throw new Error("Failed to load author options");
      }

      setAuthorOptions(res.data.authors);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoadingAuthors(false);
    }
  }

  const getAuthorsDebounced = debounce(
    (searchQuery?: string) => loadAuthorOptions(searchQuery),
    200
  );

  async function getOrgs(searchQuery?: string) {
    try {
      setLoadingOrgs(true);
      const res = await api.getCentralIdentityADAPTOrgs({
        query: searchQuery ?? undefined,
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.orgs || !Array.isArray(res.data.orgs)) {
        throw new Error("Invalid response from server.");
      }

      const orgs = res.data.orgs.map((org) => {
        return {
          value: org,
          key: crypto.randomUUID(),
          text: org,
        };
      });

      const clearOption: GenericKeyTextValueObj<string> = {
        key: crypto.randomUUID(),
        text: "Clear selection",
        value: "",
      };

      setOrgOptions([clearOption, ...orgs]);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoadingOrgs(false);
    }
  }

  const getOrgsDebounced = debounce(
    (inputVal: string) => getOrgs(inputVal),
    200
  );

  /**
   * Submits the file edit request to the server (if form is valid) and
   * closes the modal on completion.
   */
  async function handleEdit() {
    // if (Object.values(formState.errors).length > 0) return;
    // /* Usually we would use formState.isValid, but seems to be a bug with react-hook-form
    //   not setting valid to true even when there are no errors. See:
    //   https://github.com/react-hook-form/react-hook-form/issues/2755
    //   */
    setLoading(true);
    try {
      //clearErrors(); // Clear any previous errors
      const valid = await trigger(); // Trigger validation on all fields
      if (!valid) return;
      const vals = getValues();

      const editRes = await axios.put(
        `/project/${projectID}/files/${vals.fileID}`,
        {
          name: vals.name,
          description: vals.description,
          license: vals.license,
          authors: vals.authors,
          publisher: vals.publisher,
          tags: vals.tags,
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

  function handleAddAuthor(id?: string) {
    if (id) {
      const found = authorOptions.find((a) => a._id === id);
      if (!found) return;
      if (authorFields.find((a) => a._id === id)) return; // Don't add if already exists
      authorAppend({
        ...found,
      });
      return;
    }

    if (!newAuthor.firstName || !newAuthor.lastName) return; // First and last name are required
    authorAppend({
      firstName: newAuthor.firstName.trim(),
      lastName: newAuthor.lastName.trim(),
      email: newAuthor.email?.trim(),
      url: newAuthor.url?.trim(),
      primaryInstitution: newAuthor.primaryInstitution?.trim(),
    });
    clearNewAuthor();
  }

  function clearNewAuthor() {
    setNewAuthor({
      firstName: "",
      lastName: "",
      email: "",
      url: "",
      primaryInstitution: "",
    });
  }

  return (
    <Modal open={show} onClose={onClose} size="fullscreen" {...rest}>
      <Modal.Header>
        <h1>Edit {isFolder ? "Folder" : "File"}</h1>
      </Modal.Header>
      <Modal.Content scrolling>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
          }}
          loading={loading}
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
              {!isFolder && (
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
              <div className="mt-8">
                <p className="font-semibold">File Preview</p>
                {filePreviewURL && !getValues("isURL") && !getValues("url") && (
                  <>
                    {previewLoading ? (
                      <LoadingSpinner />
                    ) : (
                      <div className="mt-2">
                        <FileRenderer
                          url={filePreviewURL}
                          projectID={projectID}
                          fileID={fileID}
                          validImgExt={shouldShowPreview}
                          className="max-w-full max-h-full p-2"
                        />
                      </div>
                    )}
                  </>
                )}
                {filePreviewURL && getValues("isURL") && getValues("url") && (
                  <>
                    <p className="font-semibold">External URL</p>
                    <div className="mt-2">
                      <URLFileHyperlink url={getValues("url")} />
                    </div>
                  </>
                )}
              </div>
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
                                options={selectedLicenseVersions().map((v) => ({
                                  key: v,
                                  value: v,
                                  text: v,
                                }))}
                                {...field}
                                onChange={(e, data) => {
                                  field.onChange(data.value?.toString() ?? "");
                                }}
                                fluid
                                selection
                                placeholder="Select license version"
                                error={
                                  formState.errors.license?.version
                                    ? true
                                    : false
                                }
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
                      <Card fluid className="!p-4">
                        {selectingExistingAuthor ? (
                          <div>
                            <Form.Field className="flex flex-col">
                              <label htmlFor="existingAuthorSelect">
                                Add Existing Author
                              </label>
                              <Dropdown
                                id="existingAuthorSelect"
                                placeholder="Search authors..."
                                options={authorOptions.map((a) => ({
                                  key: crypto.randomUUID(),
                                  value: a._id ?? "",
                                  text: `${a.firstName} ${a.lastName}`,
                                }))}
                                onChange={(e, { value }) => {
                                  handleAddAuthor(value?.toString() ?? "");
                                }}
                                fluid
                                selection
                                search
                                onSearchChange={(e, { searchQuery }) => {
                                  getAuthorsDebounced(searchQuery);
                                }}
                                loading={loadingAuthors}
                              />
                            </Form.Field>
                            <p
                              className="text-right text-blue-500 cursor-pointer"
                              onClick={() => setSelectingExistingAuthor(false)}
                            >
                              <Icon name="plus" />
                              Manual Entry
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-row justify-between">
                              <Form.Field className="w-1/2">
                                <label
                                  className="form-field-label form-required"
                                  htmlFor="newAuthorFirstName"
                                >
                                  First Name
                                </label>
                                <Form.Input
                                  id="newAuthorFirstName"
                                  placeholder="John"
                                  value={newAuthor.firstName}
                                  onChange={(e) =>
                                    setNewAuthor({
                                      ...newAuthor,
                                      firstName: e.target.value,
                                    })
                                  }
                                  required
                                />
                              </Form.Field>
                              <Form.Field className="w-1/2 !ml-4">
                                <label
                                  className="form-field-label form-required"
                                  htmlFor="newAuthorLastName"
                                >
                                  Last Name
                                </label>
                                <Form.Input
                                  id="newAuthorLastName"
                                  placeholder="Doe"
                                  value={newAuthor.lastName}
                                  onChange={(e) =>
                                    setNewAuthor({
                                      ...newAuthor,
                                      lastName: e.target.value,
                                    })
                                  }
                                  required
                                />
                              </Form.Field>
                            </div>
                            <div className="flex flex-row justify-between">
                              <Form.Field className="w-1/2">
                                <label
                                  className="form-field-label"
                                  htmlFor="newAuthorEmail"
                                >
                                  Email
                                </label>
                                <Form.Input
                                  id="newAuthorEmail"
                                  placeholder="johndoe@example.com"
                                  value={newAuthor.email}
                                  onChange={(e) =>
                                    setNewAuthor({
                                      ...newAuthor,
                                      email: e.target.value,
                                    })
                                  }
                                />
                              </Form.Field>
                              <Form.Field className="w-1/2 !ml-4">
                                <label
                                  className="form-field-label"
                                  htmlFor="newAuthorUrl"
                                >
                                  URL
                                </label>
                                <Form.Input
                                  id="newAuthorUrl"
                                  placeholder="https://example.com"
                                  value={newAuthor.url}
                                  onChange={(e) =>
                                    setNewAuthor({
                                      ...newAuthor,
                                      url: e.target.value,
                                    })
                                  }
                                />
                              </Form.Field>
                            </div>
                            <Form.Field className="flex flex-col !mt-2">
                              <label htmlFor="newAuthorprimaryInstitution">
                                Primary Institution
                              </label>
                              <Dropdown
                                id="newAuthorPrimaryInstitution"
                                placeholder="Search organizations..."
                                options={orgOptions}
                                onChange={(e, { value }) => {
                                  setNewAuthor({
                                    ...newAuthor,
                                    primaryInstitution: value?.toString() ?? "",
                                  });
                                }}
                                fluid
                                selection
                                search
                                onSearchChange={(e, { searchQuery }) => {
                                  getOrgsDebounced(searchQuery);
                                }}
                                additionLabel="Add organization: "
                                allowAdditions
                                deburr
                                loading={loadingOrgs}
                                onAddItem={(e, { value }) => {
                                  if (value) {
                                    orgOptions.push({
                                      text: value.toString(),
                                      value: value.toString(),
                                      key: value.toString(),
                                    });
                                    setNewAuthor({
                                      ...newAuthor,
                                      primaryInstitution: value.toString(),
                                    });
                                  }
                                }}
                              />
                            </Form.Field>
                            <Button
                              onClick={() => handleAddAuthor()}
                              color="blue"
                              disabled={
                                !newAuthor.firstName.trim() ||
                                !newAuthor.lastName.trim()
                              }
                            >
                              <Icon name="plus" />
                              Add Author
                            </Button>
                            <p
                              className="text-right text-blue-500 cursor-pointer mt-2"
                              onClick={() => {
                                clearNewAuthor();
                                setSelectingExistingAuthor(true);
                              }}
                            >
                              <Icon name="search" />
                              Search Existing
                            </p>
                          </>
                        )}
                      </Card>
                      {authorFields.length > 0 && (
                        <Card.Group className="!mt-2">
                          {authorFields.map((author, index) => (
                            <Card key={crypto.randomUUID()} className="!mt-0">
                              <Card.Content>
                                <Icon
                                  name="x"
                                  className="float-right cursor-pointer"
                                  onClick={() => authorRemove(index)}
                                />
                                <Card.Header className="!text-sm">
                                  {author.firstName} {author.lastName}
                                </Card.Header>
                                <Card.Meta className="!text-xs">
                                  {author.email
                                    ? author.email
                                    : "Email Not Provided"}
                                </Card.Meta>
                                <Card.Meta className="!text-xs">
                                  {author.url ? author.url : "URL Not Provided"}
                                </Card.Meta>
                                <Card.Meta className="!text-xs">
                                  {author.primaryInstitution
                                    ? author.primaryInstitution
                                    : "Institution Not Provided"}
                                </Card.Meta>
                              </Card.Content>
                            </Card>
                          ))}
                        </Card.Group>
                      )}
                      <Divider className="!mt-8 !mb-2" />
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
                                <Table.Cell colSpan={3} className="text-center">
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
