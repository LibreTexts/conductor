import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Prompt, useHistory, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Breadcrumb, Button, Heading, Skeleton, Text } from "@libretexts/davis-react";
import { IconDeviceFloppy } from "@tabler/icons-react";
import { Project } from "../../../../types";
import { useTypedSelector } from "../../../../state/hooks";
import { useNotifications } from "../../../../context/NotificationContext";
import useDocumentTitle from "../../../../hooks/useDocumentTitle";
import useProject from "../../../../hooks/useProject";
import useProjectPermissions from "../../../../hooks/useProjectPermissions";
import useDebounce from "../../../../hooks/useDebounce";
import useGlobalError from "../../../../components/error/ErrorHooks";
import { DEFAULT_PROJECT_MODULES } from "../../../../utils/projectHelpers";
import { CONTAINER_CLASSES, PAGE_CLASSES } from "../../../../components/projects/ProjectView/layout";
import {
  PROPERTIES_SECTIONS,
  PropertiesSectionID,
  sectionForField,
} from "../../../../components/projects/ProjectProperties/constants";
import useProjectPropertiesOptions from "../../../../components/projects/ProjectProperties/useProjectPropertiesOptions";
import PropertiesSectionNav from "../../../../components/projects/ProjectProperties/PropertiesSectionNav";
import GeneralSection from "../../../../components/projects/ProjectProperties/GeneralSection";
import DiscoverySection from "../../../../components/projects/ProjectProperties/DiscoverySection";
import LinksSection from "../../../../components/projects/ProjectProperties/LinksSection";
import LayoutSection from "../../../../components/projects/ProjectProperties/LayoutSection";
import SourceSection from "../../../../components/projects/ProjectProperties/SourceSection";
import AssetDefaultsSection from "../../../../components/projects/ProjectProperties/AssetDefaultsSection";
import NotesSection from "../../../../components/projects/ProjectProperties/NotesSection";
import DangerZoneSection from "../../../../components/projects/ProjectProperties/DangerZoneSection";

const UNSAVED_MESSAGE = "You have unsaved changes. Leave this page without saving?";

const formValuesFrom = (project: Project): Project => ({
  ...project,
  projectModules: project.projectModules ?? DEFAULT_PROJECT_MODULES,
});

/** Edit every project property on one page, grouped into sections with a jump nav. */
const ProjectProperties = () => {
  const { id: projectID } = useParams<{ id: string }>();
  const history = useHistory();
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();
  const user = useTypedSelector((state) => state.user);

  const { project, isLoading, isMiniRepo } = useProject(projectID);
  const permissions = useProjectPermissions(project, user);

  const [orgSearch, setOrgSearch] = useState("");
  const options = useProjectPropertiesOptions(orgSearch);
  const onOrgSearch = debounce((q: string) => setOrgSearch(q.trim()), 250);

  const { control, getValues, setValue, watch, reset, handleSubmit, formState } = useForm<Project>();
  const { isDirty, isSubmitting, errors } = formState;

  useDocumentTitle(`LibreTexts Conductor | Projects | ${project?.title || "Project"} | Properties`, true);

  // Fill the form once per project. Later refetches (e.g. after a thumbnail upload) must not wipe edits.
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!project || loadedFor.current === projectID) return;
    loadedFor.current = projectID;
    reset(formValuesFrom(project));
  }, [project, projectID, reset]);

  useEffect(() => {
    if (project && user?.uuid && !permissions.isMember) {
      history.replace(`/projects/${projectID}`);
    }
  }, [project, user?.uuid, permissions.isMember, history, projectID]);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  // Keeps fields focused near the bottom clear of the sticky save bar (WCAG 2.4.11).
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollPaddingBottom;
    root.style.scrollPaddingBottom = "6rem";
    return () => {
      root.style.scrollPaddingBottom = previous;
    };
  }, []);

  const invalidSections = useMemo(
    () => new Set<PropertiesSectionID>(Object.keys(errors).map(sectionForField)),
    // formState.errors is mutated in place, so its key list is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Object.keys(errors).join(",")]
  );

  const onSubmit = async (values: Project) => {
    const payload: Partial<Project> = {
      ...values,
      isbns: (values.isbns ?? []).filter((row) => row.medium && row.format),
    };
    // The server can't unset the default author, and rejects an empty one.
    if (!payload.defaultPrimaryAuthor) delete payload.defaultPrimaryAuthor;

    try {
      const res = await axios.put("/project", payload);
      if (res.data.err) throw new Error(res.data.errMsg);
      await Promise.all([
        queryClient.invalidateQueries(["project", projectID]),
        queryClient.invalidateQueries(["projectLicenseSettings", projectID]),
      ]);
      reset({ ...values, isbns: payload.isbns });
      addNotification({ type: "success", message: "Project properties saved." });
    } catch (err: any) {
      const data = err?.response?.data;
      // A 409 means another project already uses this URL. Link to it.
      if (data?.projectName && data?.projectURL) {
        handleGlobalError(data.errMsg, data.projectName, data.projectURL);
      } else {
        handleGlobalError(data?.errMsg ? new Error(data.errMsg) : err);
      }
    }
  };

  const onInvalid = () =>
    addNotification({ type: "error", message: "Fix the highlighted fields, then save again." });

  if (isLoading || !project) {
    return (
      <div className={PAGE_CLASSES}>
        <div className={CONTAINER_CLASSES} aria-busy="true">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-5 w-96" />
          <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <Skeleton className="h-64 max-lg:hidden" />
            <div className="flex max-w-4xl flex-col gap-6">
              <Skeleton className="h-96" />
              <Skeleton className="h-64" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_CLASSES}>
      <Prompt when={isDirty && !isSubmitting} message={UNSAVED_MESSAGE} />
      <div className={CONTAINER_CLASSES}>
        <header className="flex flex-col gap-2">
          <Heading level={1} className="m-0!">
            Project Properties
          </Heading>
          <Breadcrumb className="pl-0.5">
            <Breadcrumb.Item>
              <Link to="/projects">Projects</Link>
            </Breadcrumb.Item>
            <Breadcrumb.Item>
              <Link to={`/projects/${projectID}`}>{project.title}</Link>
            </Breadcrumb.Item>
            <Breadcrumb.Item isCurrent>Properties</Breadcrumb.Item>
          </Breadcrumb>
        </header>

        <form
          id="project-properties-form"
          noValidate
          onSubmit={handleSubmit(onSubmit, onInvalid)}
          className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]"
        >
          <PropertiesSectionNav
            sections={
              permissions.isAdmin ? PROPERTIES_SECTIONS : PROPERTIES_SECTIONS.filter((s) => s.id !== "danger")
            }
            invalidSections={invalidSections}
          />
          <div className="flex min-w-0 max-w-4xl flex-col gap-6">
            <GeneralSection control={control} projectID={projectID} thumbnail={project.thumbnail} />
            <DiscoverySection
              control={control}
              options={options}
              hasContentArea={!!project.contentArea}
              onOrgSearch={onOrgSearch}
            />
            <LinksSection
              control={control}
              setValue={setValue}
              projectID={projectID}
              didCreateWorkbench={!!project.didCreateWorkbench}
            />
            <LayoutSection
              control={control}
              getValues={getValues}
              setValue={setValue}
              watch={watch}
              projectID={projectID}
              showPeerReviewLink={!isMiniRepo}
            />
            <SourceSection control={control} setValue={setValue} licenseOptions={options.licenseOptions} />
            <AssetDefaultsSection control={control} setValue={setValue} licenseOptions={options.licenseOptions} />
            <NotesSection control={control} />
            {permissions.isAdmin && <DangerZoneSection projectID={projectID} />}
          </div>
        </form>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-neutral-200 bg-surface px-4 py-3 sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <Text size="sm" color="muted" role="status" className="mr-auto">
            {isDirty ? "You have unsaved changes." : ""}
          </Text>
          <Button variant="outline" as={Link} to={`/projects/${projectID}`}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="project-properties-form"
            variant="primary"
            icon={<IconDeviceFloppy size={14} />}
            loading={isSubmitting}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProjectProperties;
