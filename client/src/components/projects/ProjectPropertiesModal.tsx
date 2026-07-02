import { Button, Heading, Modal, Select, Spinner, Tooltip } from "@libretexts/davis-react";
import {
  IconCopy,
  IconDeviceFloppy,
  IconExternalLink,
  IconInfoCircle,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { Dropdown } from "semantic-ui-react";
import {
  AssetTagFramework,
  Author,
  CentralIdentityLicense,
  GenericKeyTextValueObj,
  Project,
  ProjectClassification,
  ProjectStatus,
} from "../../types";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import useGlobalError from "../error/ErrorHooks";
import { lazy, useEffect, useState, useCallback, useRef, useMemo } from "react";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { required } from "../../utils/formRules";
import CtlTextArea from "../ControlledInputs/CtlTextArea";
import ISBNsTable from "./ISBNsTable";
import {
  classificationOptions,
  statusOptions,
  visibilityOptions,
} from "../util/ProjectHelpers";
import api from "../../api";
import axios from "axios";
import useDebounce from "../../hooks/useDebounce";
import CtlCheckbox from "../ControlledInputs/CtlCheckbox";
import { useTypedSelector } from "../../state/hooks";
import ProjectModulesControl from "./ProjectModulesControl";
import { DEFAULT_PROJECT_MODULES } from "../../utils/projectHelpers";
import { set } from "date-fns";
import AuthorsForm from "../FilesManager/AuthorsForm";
import { isAssetTagKeyObject } from "../../utils/typeHelpers";
import { useQueryClient } from "@tanstack/react-query";
import { CHAT_NOTIFY_OPTS } from "../../utils/constants";
import { useModals } from "../../context/ModalContext";
import AdminChangeURL from "./AdminChangeURL";
import CtlDateInput from "../ControlledInputs/CtlDateInput";
import languageCodes from "../../utils/languageCodes";
import AboutProjectClassificationsModal from "./AboutProjectClassificationsModal";
const CreateWorkbenchModal = lazy(() => import("./CreateWorkbenchModal"));
const DeleteProjectModal = lazy(() => import("./DeleteProjectModal"));

interface ProjectPropertiesModalProps {
  show: boolean;
  onClose: () => void;
  projectID: string;
}

type CIDDescriptorOption = GenericKeyTextValueObj<string> & {
  content?: JSX.Element;
};

const ProjectPropertiesModal: React.FC<ProjectPropertiesModalProps> = ({
  show,
  onClose,
  projectID,
}) => {
  const DESCRIP_MAX_CHARS = 500;
  // Global state & hooks
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();
  const org = useTypedSelector((state) => state.org);
  const user = useTypedSelector((state) => state.user);
  const { openModal, closeAllModals } = useModals();
  const authorsFormRef = useRef<React.ElementRef<typeof AuthorsForm>>(null);
  const {
    control,
    getValues,
    setValue,
    watch,
    formState,
    reset,
    trigger: triggerValidation,
  } = useForm<Project>({
    defaultValues: {
      title: "",
      tags: [],
      cidDescriptors: [],
      currentProgress: 0,
      peerProgress: 0,
      a11yProgress: 0,
      classification: ProjectClassification.HARVESTING,
      status: ProjectStatus.OPEN,
      visibility: "private",
      projectURL: "",
      adaptURL: "",
      author: "",
      authorEmail: "",
      license: {
        name: "",
        version: "",
        url: "",
        sourceURL: "",
        modifiedFromSource: false,
        additionalTerms: "",
      },
      notes: "",
      associatedOrgs: [],
      thumbnail: "",
      defaultChatNotification: "",
      didCreateWorkbench: false,
      defaultFileLicense: {
        name: "",
        version: "",
        url: "",
        sourceURL: "",
        modifiedFromSource: false,
        additionalTerms: "",
      },
      defaultPrimaryAuthorID: "",
      defaultSecondaryAuthorIDs: [],
      defaultCorrespondingAuthorID: "",
      principalInvestigatorIDs: [],
      coPrincipalInvestigatorIDs: [],
      principalInvestigators: [],
      coPrincipalInvestigators: [],
      description: "",
      contentArea: "",
      isbns: [],
      doi: "",
      sourceLanguage: "",
      projectModules: {
        discussion: {
          enabled: true,
          order: 1,
        },
        files: {
          enabled: true,
          order: 2,
        },
        tasks: {
          enabled: true,
          order: 3,
        },
      },
    },
  });

  // UI & Data
  const [loading, setLoading] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [tagOptions, setTagOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [loadedTags, setLoadedTags] = useState<boolean>(false);
  const [cidOptions, setCIDOptions] = useState<CIDDescriptorOption[]>([]);
  const [loadedCIDs, setLoadedCIDs] = useState<boolean>(false);
  const [licenseOptions, setLicenseOptions] = useState<
    CentralIdentityLicense[]
  >([]);
  const [loadedLicenses, setLoadedLicenses] = useState<boolean>(false);
  const [orgOptions, setOrgOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [loadedOrgs, setLoadedOrgs] = useState<boolean>(false);
  const [piOptions, setPIOptions] = useState<Author[]>([]);
  const [coPIOptions, setCoPIOptions] = useState<Author[]>([]);
  const [loadingPIOptions, setLoadingPIOptions] = useState<boolean>(false);
  const [loadingCoPIOptions, setLoadingCoPIOptions] = useState<boolean>(false);

  const [contentAreaOptions, setContentAreaOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [pedagogyOptions, setPedagogyOptions] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);

  useEffect(() => {
    if (show && projectID) {
      initData();
    }
  }, [show, projectID]);

  async function initData() {
    await loadProject(); // fire and forget after this point
    getTags();
    getCIDDescriptors();
    getLicenseOptions();
    getPIOptions(undefined, true);
    checkCampusDefault();
  }

  useEffect(() => {
    getOrgs();
  }, [watch("associatedOrgs")]);

  // Update license URL and (version as appropriate) when license name changes
  useEffect(() => {
    if (getValues("defaultFileLicense.name") === undefined) return;

    // If license name is cleared, clear license URL and version
    if (getValues("defaultFileLicense.name") === "") {
      setValue("defaultFileLicense.url", "");
      setValue("defaultFileLicense.version", "");
      return;
    }

    const license = licenseOptions.find(
      (l) => l.name === getValues("defaultFileLicense.name")
    );
    if (!license) return;

    // If license no longer has versions, clear license version
    if (!license.versions || license.versions.length === 0) {
      setValue("defaultFileLicense.version", "");
    }
    setValue("defaultFileLicense.url", license.url);
  }, [watch("defaultFileLicense.name")]);

  // Return new license version options when license name changes
  const selectedSourceLicenseVersions = useCallback(() => {
    const license = licenseOptions.find(
      (l) => l.name === getValues("license.name")
    );
    if (!license) return [];
    return license.versions ?? [];
  }, [watch("license.name"), licenseOptions]);

  const selectedFileLicenseVersions = useCallback(() => {
    const license = licenseOptions.find(
      (l) => l.name === getValues("defaultFileLicense.name")
    );
    if (!license) return [];
    return license.versions ?? [];
  }, [watch("defaultFileLicense.name"), licenseOptions]);

  async function loadProject() {
    try {
      setLoading(true);
      const res = await api.getProject(projectID);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      reset({
        ...res.data.project,
        projectModules:
          res.data.project.projectModules ?? DEFAULT_PROJECT_MODULES,
      });
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Load existing Project Tags from the server
   * via GET request, then sort, format, and save
   * them to state for use in the Dropdown.
   */
  async function getTags() {
    try {
      setLoadedTags(false);
      const res = await api.getTags();
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.tags || !Array.isArray(res.data.tags)) {
        throw new Error("Invalid response from server.");
      }

      res.data.tags.sort((tagA, tagB) => {
        var aNorm = String(tagA.title).toLowerCase();
        var bNorm = String(tagB.title).toLowerCase();
        if (aNorm < bNorm) return -1;
        if (aNorm > bNorm) return 1;
        return 0;
      });

      const newTagOptions = res.data.tags.flatMap((t) => {
        return t.title ? { text: t.title, value: t.title, key: t.title } : [];
      });
      setTagOptions(newTagOptions);
      setLoadedTags(true);
    } catch (err) {
      handleGlobalError(err);
    }
  }

  /**
   * Loads C-ID Descriptors from the server, transforms them for use in UI,
   * then saves them to state.
   */
  async function getCIDDescriptors() {
    try {
      setLoadedCIDs(false);
      const res = await api.getCIDDescriptors();
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!res.data.descriptors || !Array.isArray(res.data.descriptors)) {
        throw new Error("Invalid response from server.");
      }

      const descriptors = [
        { value: "", key: "clear", text: "Clear..." },
        ...res.data.descriptors.map((item) => {
          return {
            value: item.descriptor,
            key: item.descriptor,
            text: `${item.descriptor}: ${item.title}`,
            content: (
              <div>
                <span>
                  <strong>{item.descriptor}</strong>: {item.title}
                </span>
                <p className="mt-05p">
                  <em>{item.description}</em>
                </p>
              </div>
            ),
          };
        }),
      ];
      setCIDOptions(descriptors);
      setLoadedCIDs(true);
    } catch (err) {
      handleGlobalError(err);
    }
  }

  async function getLicenseOptions() {
    try {
      setLoadedLicenses(false);
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
      setLoadedLicenses(true);
    }
  }

  function getExistingOrgs() {
    // We also want to include any existing orgs that are already associated with this project and not lost them in dropdown options if removed
    const existingOrgs = getValues("associatedOrgs").map((name) => {
      return {
        key: crypto.randomUUID(),
        text: name,
        value: name,
      };
    });
    return existingOrgs;
  }

  async function getOrgs(searchQuery?: string) {
    try {
      setLoadedOrgs(false);

      const existing = getExistingOrgs();
      if (org.customOrgList && org.customOrgList.length > 0) {
        const orgs = org.customOrgList.map((org) => {
          return {
            value: org,
            key: crypto.randomUUID(),
            text: org,
          };
        });
        setOrgOptions([...orgs, ...existing]);
        return;
      }

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

      setOrgOptions([...orgs, ...existing]);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoadedOrgs(true);
    }
  }

  const getOrgsDebounced = debounce(
    (inputVal: string) => getOrgs(inputVal),
    200
  );

  async function getPIOptions(searchQuery?: string, setOthers = false) {
    try {
      setLoadingPIOptions(true);
      const res = await api.getAuthors({ query: searchQuery });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.items || !Array.isArray(res.data.items)) {
        throw new Error("Failed to load PI options");
      }

      const existing = getValues("principalInvestigators") ?? [];
      const opts = [...res.data.items, ...existing];

      setPIOptions(opts);

      // We only use this when loading the PI's for the first time
      // so we don't need to run the same query multiple times
      if (setOthers) {
        const existingCoPIs = getValues("coPrincipalInvestigators") ?? [];
        setCoPIOptions([...opts, ...existingCoPIs]);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoadingPIOptions(false);
    }
  }

  const getPIsDebounced = debounce(
    (inputVal: string) => getPIOptions(inputVal),
    200
  );

  async function getCoPIOptions(searchQuery?: string) {
    try {
      setLoadingCoPIOptions(true);
      const res = await api.getAuthors({ query: searchQuery });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.items || !Array.isArray(res.data.items)) {
        throw new Error("Failed to load co-PI options");
      }

      const opts = [
        ...res.data.items,
        ...(watch("coPrincipalInvestigators") ?? []),
      ];

      setCoPIOptions(opts);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoadingCoPIOptions(false);
    }
  }

  const getCoPIsDebounced = debounce(
    (inputVal: string) => getCoPIOptions(inputVal),
    200
  );

  /**
   * Loads the default framework for the campus, if one exists.
   */
  async function checkCampusDefault() {
    try {
      //const existing = getValues("tags");
      //if (existing && existing.length > 0) return; // Don't load campus default if tags already exist
      setLoading(true);
      const res = await api.getCampusDefaultFramework(org.orgID);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.framework) return;

      // Get content area options
      const contentAreaTemplate = res.data.framework.templates.find(
        (t) =>
          isAssetTagKeyObject(t.key) && t.key.title.toLowerCase() === "subject"
      );
      if (!contentAreaTemplate || !contentAreaTemplate.options) return;

      const options = contentAreaTemplate.options.map((option) => {
        return {
          key: crypto.randomUUID(),
          text: option,
          value: option,
        };
      });

      setContentAreaOptions(options);

      // Get pedagogy options
      const pedagogyTemplate = res.data.framework.templates.find(
        (t) =>
          isAssetTagKeyObject(t.key) && t.key.title.toLowerCase() === "pedagogy"
      );
      if (!pedagogyTemplate || !pedagogyTemplate.options) return;

      const pedagogyOpts = pedagogyTemplate.options.map((option) => {
        return {
          key: crypto.randomUUID(),
          text: option,
          value: option,
        };
      });

      setPedagogyOptions(pedagogyOpts);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Ensure the form data is valid, then submit the
   * data to the server via PUT request.
   */
  const submitEditInfoForm = async () => {
    try {
      setLoading(true);

      const authorData = authorsFormRef.current?.getAuthors();
      if (authorData) {
        setValue("defaultPrimaryAuthor", authorData.primaryAuthor ?? undefined);
        setValue("defaultSecondaryAuthors", authorData.authors);
        setValue(
          "defaultCorrespondingAuthor",
          authorData.correspondingAuthor ?? undefined
        );
      }

      if (!(await triggerValidation())) {
        throw new Error("Please fix the errors in the form before submitting.");
      }

      const values = getValues();
      values.isbns = (values.isbns || []).filter(
        (row) => row.medium && row.format
      );
      const res = await axios.put("/project", {
        ...values,
        principalInvestigators: getValues("principalInvestigatorIDs"),
        coPrincipalInvestigators: getValues("coPrincipalInvestigatorIDs"),
      });
      if (res.data.err) {
        let errorMessage = res.data.errMsg;
        throw new Error(errorMessage);
      }

      // Invalidate cached project data
      queryClient.invalidateQueries(["project", projectID]);
      queryClient.invalidateQueries(["projectLicenseSettings", projectID]);

      onClose();
      return;
    } catch (err: any) {
      //  if (err.toJSON().status === 409) {
      //      handleGlobalError(
      //        err,
      //        "View Project",
      //        err.response.data.projectID ?? "unknown"
      //      );
      //  }

      const errorMessage = err.response.data.errMsg;
      if (err.response.data?.projectName && err.response.data?.projectURL) {
        handleGlobalError(
          errorMessage,
          err.response.data.projectName,
          err.response.data.projectURL
        );
      } else {
        handleGlobalError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  function handleOpenThumbnailUpload() {
    const input = document.getElementById(
      "thumbnail-hidden-input"
    ) as HTMLInputElement;
    if (input) {
      input.click();
    }
  }

  async function handleThumbnailUpload(e: React.ChangeEvent) {
    try {
      setLoading(true);

      // @ts-expect-error
      const files = (e as React.ChangeEvent).target?.files;
      if (!files || files.length === 0) return;

      const formData = new FormData();
      formData.append("thumbnail", files[0]);

      const res = await api.uploadProjectThumbnail(projectID, formData);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      window.location.reload();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  const principalInvestigatorOpts = useMemo(() => {
    return piOptions.map((pi) => {
      return {
        key: crypto.randomUUID(),
        value: pi._id ?? "",
        text: pi.name,
      };
    });
  }, [piOptions]);

  const coPrincipalInvestigatorOpts = useMemo(() => {
    return coPIOptions.map((pi) => {
      return {
        key: crypto.randomUUID(),
        value: pi?._id ?? "",
        text: pi?.name ?? "",
      };
    });
  }, [coPIOptions]);

  function handleOpenChangeURLModal() {
    openModal(
      <AdminChangeURL
        projectID={projectID}
        currentURL={getValues("projectURL") as string}
        onSave={(newURL) => {
          setValue("projectURL", newURL);
          closeAllModals();
        }}
        onClose={() => closeAllModals()}
      />
    );
  }

  const [copied, setCopied] = useState(false);

  return (
    <Modal open={show} onClose={() => {}}>
      <Modal.Header>
        <Modal.Title>Edit Project Properties</Modal.Title>
      </Modal.Header>
      <Modal.Body className="overflow-y-auto max-h-[calc(100dvh-8rem)]">
        <div className="flex flex-col">
          <Heading level={3}>Project Properties</Heading>
          <CtlTextInput
            control={control}
            name="title"
            label="Project Title"
            placeholder="Enter the project title..."
            rules={required}
            required
          />
          <div className="flex flex-row justify-between mt-4 gap-4">
            <div className="w-full">
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select
                    name="projectStatus"
                    label="Status"
                    placeholder="Status..."
                    options={statusOptions.map((o) => ({ value: o.value, label: o.text }))}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                )}
              />
            </div>
            <div className="w-full">
              <div className="flex items-center gap-1 mb-1">
                <label className="form-field-label !mb-0">Classification</label>
                <Tooltip content="Click to learn more about project classifications.">
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-600"
                    onClick={() => openModal(<AboutProjectClassificationsModal show={true} onClose={() => closeAllModals()} />)}
                  >
                    <IconInfoCircle size={15} />
                  </button>
                </Tooltip>
              </div>
              <Controller
                name="classification"
                control={control}
                render={({ field }) => (
                  <Select
                    name="projectClassification"
                    label=""
                    placeholder="Classification..."
                    options={classificationOptions.map((o) => ({ value: o.value, label: o.text }))}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                )}
              />
            </div>
            <div className="w-full">
              <Controller
                name="visibility"
                control={control}
                render={({ field }) => (
                  <Select
                    name="projectVisibility"
                    label="Visibility"
                    placeholder="Visibility..."
                    options={visibilityOptions.map((o) => ({ value: o.value, label: o.text }))}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                )}
              />
            </div>
          </div>
          {!getValues("didCreateWorkbench") ? (
            <div className="flex flex-col mt-4">
              <div className="flex items-center gap-1 mb-1">
                <label htmlFor="projectURL" className="form-field-label !mb-0">
                  {org.orgID === "calearninglab" ? "Project" : "Textbook"} URL{" "}
                  <span className="text-gray-400">(if applicable)</span>
                </label>
                <Tooltip content="If a LibreText URL is entered, the Library, ID, and Bookshelf or Campus will be automatically retrieved.">
                  <IconInfoCircle size={15} className="text-gray-400" />
                </Tooltip>
                <button
                  type="button"
                  className="text-gray-400 hover:text-black ml-1"
                  onClick={async () => {
                    const url = getValues("projectURL");
                    if (url) {
                      await navigator.clipboard.writeText(url as string);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                >
                  <IconCopy size={15} />
                </button>
                {copied && <span className="text-green-500 text-sm">Copied!</span>}
              </div>
              <CtlTextInput
                name="projectURL"
                control={control}
                placeholder={`Enter ${org.orgID === "calearninglab" ? "project" : "textbook"} URL...`}
                type="url"
                id="projectURL"
              />
            </div>
          ) : user.isSuperAdmin ? (
            <p className="text-blue-600 underline cursor-pointer mt-4" onClick={handleOpenChangeURLModal}>
              Change Textbook URL (Admin Only)
            </p>
          ) : null}
          <div className="flex flex-col mt-4">
            <label htmlFor="projectDescription" className="form-field-label">
              Project Description
            </label>
            <CtlTextArea
              name="description"
              control={control}
              placeholder="Enter project description..."
              type="text"
              id="projectDescription"
              rows={3}
              maxLength={DESCRIP_MAX_CHARS}
              showRemaining
            />
          </div>
          <div className="flex flex-col mt-4">
            <label htmlFor="principalInvestigators" className="form-field-label">
              Principal Investigators
            </label>
            <Controller
              render={({ field }) => (
                <Dropdown
                  id="principalInvestigators"
                  placeholder="Search people..."
                  options={principalInvestigatorOpts}
                  {...field}
                  onChange={(e, { value }) => { field.onChange(value); }}
                  onSearchChange={(e, { searchQuery }) => { getPIsDebounced(searchQuery); }}
                  fluid
                  selection
                  multiple
                  search
                  loading={loadingPIOptions}
                />
              )}
              name="principalInvestigatorIDs"
              control={control}
            />
          </div>
          <div className="flex flex-col mt-4">
            <label htmlFor="coPrincipalInvestigators" className="form-field-label">
              Co-Principal Investigators
            </label>
            <Controller
              render={({ field }) => (
                <Dropdown
                  id="coPrincipalInvestigators"
                  placeholder="Search people..."
                  options={coPrincipalInvestigatorOpts}
                  {...field}
                  onChange={(e, { value }) => { field.onChange(value); }}
                  onSearchChange={(e, { searchQuery }) => { getCoPIsDebounced(searchQuery); }}
                  fluid selection multiple search
                  loading={loadingCoPIOptions}
                />
              )}
              name="coPrincipalInvestigatorIDs"
              control={control}
            />
          </div>
          <div className="flex flex-col mt-4">
            <label htmlFor="contentArea" className="form-field-label">Content Area</label>
            <Controller
              render={({ field }) => (
                <Dropdown
                  id="contentArea"
                  placeholder="Search options..."
                  options={contentAreaOptions}
                  {...field}
                  onChange={(e, { value }) => { field.onChange(value as string); }}
                  fluid selection loading={!loadedTags}
                />
              )}
              name="contentArea"
              control={control}
            />
          </div>
          <div className="flex flex-col mt-4">
            <label htmlFor="projectTags" className="form-field-label">Project Tags</label>
            <Controller
              render={({ field }) => (
                // @ts-expect-error
                <Dropdown
                  id="projectTags"
                  placeholder="Search tags..."
                  options={org.FEAT_PedagogyProjectTags ? pedagogyOptions : tagOptions}
                  {...field}
                  onChange={(e, { value }) => { field.onChange(value as string); }}
                  fluid selection multiple search
                  allowAdditions={!org.FEAT_PedagogyProjectTags}
                  loading={!loadedTags}
                  onAddItem={(e, { value }) => {
                    if (org.FEAT_PedagogyProjectTags) return;
                    if (value) {
                      tagOptions.push({ text: value.toString(), value: value.toString(), key: value.toString() });
                      field.onChange([...(field.value as GenericKeyTextValueObj<string>[]), value.toString()]);
                    }
                  }}
                  renderLabel={(tag) => ({ color: "blue", content: tag.text })}
                />
              )}
              name="tags"
              control={control}
            />
          </div>
          <div className="flex flex-col mt-4">
            <div className="flex items-center gap-1 mb-1">
              <label htmlFor="cidinput" className="form-field-label !mb-0">
                C-ID <span className="text-gray-400">(if applicable)</span>
              </label>
              <Tooltip content="Use this field if your Project or resource pertains to content for a course registered with the California Course Identification Numbering System (C-ID).">
                <IconInfoCircle size={15} className="text-gray-400" />
              </Tooltip>
            </div>
            <Controller
              name="cidDescriptors"
              control={control}
              render={({ field }) => (
                // @ts-expect-error
                <Dropdown
                  id="cidinput"
                  {...field}
                  onChange={(e, { value }) => { field.onChange(value); }}
                  fluid deburr placeholder="Search C-IDs..."
                  multiple search selection
                  options={cidOptions}
                  loading={!loadedCIDs}
                  disabled={!loadedCIDs}
                  renderLabel={(cid) => ({ color: "blue", content: cid.key })}
                />
              )}
            />
          </div>
          <div className="flex flex-col mt-4">
            <label htmlFor="associatedOrgs" className="form-field-label">Associated Organizations</label>
            <Controller
              render={({ field }) => (
                <Dropdown
                  id="associatedOrgs"
                  placeholder="Search organizations..."
                  options={orgOptions}
                  {...field}
                  onChange={(e, { value }) => { field.onChange(value as string); }}
                  fluid selection multiple search
                  onSearchChange={(e, { searchQuery }) => { getOrgsDebounced(searchQuery); }}
                  additionLabel="Add organization: "
                  allowAdditions
                  loading={!loadedOrgs}
                  onAddItem={(e, { value }) => {
                    if (value) {
                      orgOptions.push({ text: value.toString(), value: value.toString(), key: value.toString() });
                      field.onChange([...(field.value as string[]), value.toString()]);
                    }
                  }}
                  renderLabel={(tag) => ({ color: "blue", content: tag.text })}
                />
              )}
              name="associatedOrgs"
              control={control}
            />
          </div>
          <div className="flex flex-col mt-4">
            <div className="flex items-center gap-1 mb-1">
              <label htmlFor="thumbnail" className="form-field-label !mb-0">Thumbnail</label>
              <Tooltip content="A thumbnail image for the project. Appears best with a 16:9 aspect ratio. May take a few minutes to propagate.">
                <IconInfoCircle size={15} className="text-gray-400" />
              </Tooltip>
            </div>
            <div className="flex gap-2 mt-1">
              {getValues("thumbnail") && (
                <Button
                  variant="outline"
                  icon={<IconExternalLink size={14} />}
                  onClick={() => window.open(getValues("thumbnail") as string, "_blank")}
                >
                  View Current
                </Button>
              )}
              <Button
                variant="primary"
                icon={<IconUpload size={14} />}
                onClick={handleOpenThumbnailUpload}
              >
                {getValues("thumbnail") ? "Replace" : "Upload"}
              </Button>
              <input id="thumbnail-hidden-input" type="file" hidden accept="image/*" max={1} onChange={handleThumbnailUpload} />
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            <em>For settings and properties related to Peer Reviews, please use the Settings tool on this project's Peer Review page.</em>
          </p>
          <hr className="my-4" />
          <Heading level={3} className="!mb-0">Project Modules</Heading>
          <div className="mt-2">
            <p className="mb-2">Enable, disable, or re-order the display of modules in your project's page.</p>
            <ProjectModulesControl getValues={getValues} setValue={setValue} watch={watch} />
          </div>
          <hr className="my-4" />
          <Heading level={3} className="!mb-0">Homework and Assessments</Heading>
          <p>
            <em>
              {`Use this section to link your project's Commons page (if applicable) to an `}
              <a href="https://adapt.libretexts.org" target="_blank" rel="noreferrer">ADAPT</a>
              {` assessment system course. `}
              <strong>Ensure the course allows anonymous users.</strong>
            </em>
          </p>
          <div className="mt-2">
            <div className="flex items-center gap-1 mb-1">
              <label htmlFor="adaptURL" className="form-field-label !mb-0">
                ADAPT Course URL <span className="text-gray-400">(if applicable)</span>
              </label>
              <Tooltip content="Paste the URL of your Course Dashboard (assignments list) or Course Properties page. The Course ID will be automatically determined.">
                <IconInfoCircle size={15} className="text-gray-400" />
              </Tooltip>
            </div>
            <CtlTextInput name="adaptURL" control={control} placeholder="Enter ADAPT Course Dashboard URL..." type="url" id="adaptURL" />
          </div>
          <hr className="my-4" />
          <Heading level={3} className="!mb-0">Source Properties</Heading>
          <p>
            <em>
              Use this section if your project pertains to a particular resource
              or tool.
            </em>
          </p>
          <div className="flex flex-row justify-between mb-3">
            <CtlTextInput
              name="author"
              control={control}
              label="Author"
              placeholder="Enter resource author name..."
              className="basis-1/2 mr-8"
            />
            <CtlTextInput
              name="authorEmail"
              control={control}
              label="Author's Email"
              placeholder="Enter resource author's email..."
              className="basis-1/2"
            />
          </div>
          <div className="flex flex-row justify-between mb-6">
            <CtlTextInput
              name="doi"
              control={control}
              label="DOI"
              placeholder="Enter DOI..."
              className="basis-1/2"
            />
          </div>
          <div className="flex flex-row justify-between mb-6">
              <ISBNsTable control={control} setValue={setValue} />
          </div>
          <div className="flex flex-row justify-between mb-3">
            <CtlDateInput
              name="sourceOriginalPublicationDate"
              control={control}
              value={getValues("sourceOriginalPublicationDate") ?? new Date()}
              error={false}
              label="Original Publication Date"
              placeholder="Select date..."
              className="basis-1/3 mr-8"
            />
            <CtlDateInput
              name="sourceHarvestDate"
              control={control}
              value={getValues("sourceHarvestDate") ?? new Date()}
              error={false}
              label="Harvest/Import Date"
              placeholder="Select date..."
              className="basis-1/3 mr-8"
            />

            <CtlDateInput
              name="sourceLastModifiedDate"
              control={control}
              value={getValues("sourceLastModifiedDate") ?? new Date()}
              error={false}
              label="Last Modified Date"
              placeholder="Select date..."
              className="basis-1/3"
            />
          </div>
          <div className="flex flex-row justify-between mb-3">
            <div className="w-1/2">
              <label
                className="form-field-label"
                htmlFor="selectSourceLanguage"
              >
                Language
              </label>
              <Controller
                name="sourceLanguage"
                control={control}
                render={({ field }) => (
                  <Select
                    id="selectSourceLanguage"
                    name="sourceLanguage"
                    label="Language"
                    options={languageCodes.map((l) => ({ value: l.code, label: l.name }))}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    placeholder="Select a language..."
                  />
                )}
              />
            </div>
          </div>
          <div className="w-1/2 mt-6">
            <label className="form-field-label" htmlFor="selectSourceLicenseName">License Name</label>
            <Controller
              name="license.name"
              control={control}
              render={({ field }) => (
                <Select
                  id="selectSourceLicenseName"
                  name="license.name"
                  label="License Name"
                  options={licenseOptions.map((l) => ({ value: l.name, label: l.name }))}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value)}
                  placeholder="Select a license..."
                />
              )}
            />
          </div>
          {selectedSourceLicenseVersions().length > 0 && (
            <div className="mt-2">
              <label className="form-field-label form-required" htmlFor="selectSourceLicenseVersion">License Version</label>
              <Controller
                name="license.version"
                control={control}
                rules={required}
                render={({ field }) => (
                  <Select
                    id="selectSourceLicenseVersion"
                    name="license.version"
                    label="License Version"
                    options={selectedSourceLicenseVersions().map((v) => ({ value: v, label: v }))}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    placeholder="Select license version"
                  />
                )}
              />
            </div>
          )}
          <CtlTextInput
            name="license.sourceURL"
            control={control}
            label="Original URL"
            placeholder="https://example.com"
            className="mt-2"
          />
          <div className="flex items-start mt-3">
            <CtlCheckbox
              name="license.modifiedFromSource"
              control={control}
              label="Modified from source?"
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
          <hr className="my-4" />
          <Heading level={3} className="!mb-0">Asset Settings</Heading>
          <p className="my-1">
            <strong>Default License</strong>
          </p>
          <p className="mt-0 mb-3">
            <em>Use this section to set the default license information for uploaded assets. Users will be able to override this setting on a per-file basis.</em>
          </p>
          <div>
            <label className="form-field-label" htmlFor="selectFileLicenseName">Name</label>
            <Controller
              name="defaultFileLicense.name"
              control={control}
              render={({ field }) => (
                <Select
                  id="selectFileLicenseName"
                  name="defaultFileLicense.name"
                  label="License Name"
                  options={licenseOptions.map((l) => ({ value: l.name, label: l.name }))}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value)}
                  placeholder="Select a license..."
                />
              )}
            />
          </div>
          {selectedFileLicenseVersions().length > 0 && (
            <div className="mt-2">
              <label className="form-field-label form-required" htmlFor="selectFileLicenseVersion">Version</label>
              <Controller
                name="defaultFileLicense.version"
                control={control}
                rules={required}
                render={({ field }) => (
                  <Select
                    id="selectFileLicenseVersion"
                    name="defaultFileLicense.version"
                    label="License Version"
                    options={selectedFileLicenseVersions().map((v) => ({ value: v, label: v }))}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    placeholder="Select license version"
                  />
                )}
              />
            </div>
          )}
          <CtlTextInput
            name="defaultFileLicense.sourceURL"
            control={control}
            label="File Source URL"
            placeholder="https://example.com"
            className="mt-2"
          />
          <div className="flex items-start mt-3">
            <CtlCheckbox
              name="defaultFileLicense.modifiedFromSource"
              control={control}
              label="File modified from source?"
              labelDirection="row-reverse"
            />
          </div>
          <CtlTextArea
            name="defaultFileLicense.additionalTerms"
            control={control}
            label="Additional License Terms"
            placeholder="Additional terms (if applicable)..."
            className="mt-2"
            maxLength={DESCRIP_MAX_CHARS}
            showRemaining
          />
          <AuthorsForm
            mode="project-default"
            currentPrimaryAuthor={
              getValues("defaultPrimaryAuthor") ?? undefined
            }
            currentAuthors={getValues("defaultSecondaryAuthors") ?? []}
            currentCorrespondingAuthor={
              getValues("defaultCorrespondingAuthor") ?? undefined
            }
            ref={authorsFormRef}
          />
          {/* <div className="mt-4">
            <label className="form-field-label">Primary Author</label>
            <Form.Field className="flex flex-col">
              <Controller
                name="defaultPrimaryAuthorID"
                control={control}
                render={({ field }) => (
                  <Dropdown
                    id="primaryAuthorSelect"
                    options={authorOptions.map((a) => ({
                      key: crypto.randomUUID(),
                      value: a._id ?? "",
                      text: `${a.firstName} ${a.lastName}`,
                    }))}
                    {...field}
                    onChange={(e, data) => {
                      field.onChange(data.value?.toString() ?? "");

                      const _secondaryAuthors = getValues('defaultSecondaryAuthorIDs') ?? [];
                      if(_secondaryAuthors.includes(data.value?.toString() ?? "")) {
                        const _filtered = _secondaryAuthors.filter((a) => a !== (data.value?.toString() ?? ""));
                        setValue('defaultSecondaryAuthorIDs', _filtered);
                      }
                    }}
                    fluid
                    selection
                    search
                    placeholder="Seach authors..."
                    loading={loadingAuthors}
                  />
                )}
              />
            </Form.Field>
          </div>
          <div className="mt-4">
            <label className="form-field-label">Secondary Author(s)</label>
            <Form.Field className="flex flex-col">
              <Controller
                name="defaultSecondaryAuthorIDs"
                control={control}
                render={({ field }) => (
                  <Dropdown
                    id="secondaryAuthorSelect"
                    placeholder="Search authors..."
                    options={authorOptions
                      .filter(
                        (a) => a._id !== watch("defaultPrimaryAuthorID")
                      )
                      .map((a) => ({
                        key: crypto.randomUUID(),
                        value: a._id ?? "",
                        text: `${a.firstName} ${a.lastName}`,
                      }))}
                    {...field}
                    onChange={(e, { value }) => {
                      field.onChange(value as string[]);
                    }}
                    multiple
                    fluid
                    selection
                    search
                    onSearchChange={(e, { searchQuery }) => {
                      getAuthorsDebounced(searchQuery);
                    }}
                    loading={loadingAuthors}
                  />
                )}
              />
            </Form.Field>
          </div> */}
          <hr className="my-4" />
          <Heading level={3} className="!mb-0">Discussion Settings</Heading>
          <div className="w-1/4 mt-2">
            <label htmlFor="defaultChatNotification" className="form-field-label">Default Message Notification Type</label>
            <Controller
              name="defaultChatNotification"
              control={control}
              render={({ field }) => (
                <Select
                  id="defaultChatNotification"
                  name="defaultChatNotification"
                  label="Default Message Notification Type"
                  options={CHAT_NOTIFY_OPTS(true, () => {}).map((o) => ({ value: String(o.value), label: o.text }))}
                  value={field.value ?? "all"}
                  onChange={(e) => field.onChange(e.target.value)}
                  placeholder="Notification type..."
                />
              )}
            />
          </div>
          <hr className="my-4" />
          <Heading level={3} className="!mb-0">Additional Information</Heading>
          <CtlTextArea
            name="notes"
            control={control}
            label="Notes"
            placeholder="Enter additional notes here..."
          />
        </div>
        <details className="mt-4 border border-red-300 rounded p-3">
          <summary className="cursor-pointer font-semibold text-red-600">Danger Zone</summary>
          <div className="mt-3">
            <p className="text-red-600 mb-2">Use caution with the options in this area!</p>
            <Button
              variant="destructive"
              icon={<IconTrash size={14} />}
              onClick={() => setShowDeleteModal(true)}
            >
              Delete Project
            </Button>
          </div>
        </details>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={() => onClose()}>Cancel</Button>
        <Button
          variant="primary"
          loading={loading}
          icon={<IconDeviceFloppy size={14} />}
          onClick={submitEditInfoForm}
        >
          Save Changes
        </Button>
      </Modal.Footer>
      <DeleteProjectModal
        show={showDeleteModal}
        projectID={projectID}
        onCancel={() => setShowDeleteModal(false)}
      />
    </Modal>
  );
};

export default ProjectPropertiesModal;
