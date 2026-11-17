import { Badge, Button } from "@libretexts/davis-react";
import {
  IconBook,
  IconBooks,
  IconClipboardText,
  IconConfetti,
  IconExternalLink,
  IconFileImport,
  IconPackageExport,
  IconPlus,
  IconSend,
  IconWorld,
} from "@tabler/icons-react";
import classNames from "classnames";
import { isEmptyString, normalizeURL } from "../util/HelperFunctions";
import {
  buildCommonsUrl,
  buildLibraryPageGoURL,
  isProjectPublished,
} from "../../utils/projectHelpers";
import { Suspense, useEffect, useState } from "react";
import lazyWithRetry from "../../utils/lazyWithRetry";
import { Project, ProjectClassification } from "../../types";
import { useTypedSelector } from "../../state/hooks";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import ImportWorkbenchModal from "./ImportWorkbenchModal";
import ProjectToolTile from "./ProjectToolTile";
import SectionCard from "./ProjectView/SectionCard";

type ActiveImportJob = {
  jobID: string;
  status: "pending" | "running" | "success" | "error";
  messages: string[];
};
const CreateWorkbenchModal = lazyWithRetry(() => import("./CreateWorkbenchModal"));
// Pulls in the PDF pane and the export registry, none of which a project page
// needs until someone opens the drawer.
const CompileBookDrawer = lazyWithRetry(
  () => import("./CompileBook/CompileBookDrawer"),
);
// Same reasoning: the destination picker and its per-level fetches are dead
// weight on a project page until someone opens the drawer.
const PublishBookDrawer = lazyWithRetry(
  () => import("./PublishBook/PublishBookDrawer"),
);

interface ProjectLinkButtonsProps {
  adaptCourseID?: string;
  className?: string;
  /** Three tile columns instead of two, for when the card spans the full band. */
  wide?: boolean;
  didCreateWorkbench?: boolean;
  didRequestPublish?: boolean;
  hasCommonsBook?: boolean;
  isProjectMemberOrAdmin?: boolean;
  libreCoverID?: string;
  libreLibrary?: string;
  project: Project;
  projectClassification?: string;
  projectID?: string;
  projectLink?: string;
  projectTitle?: string;
  projectVisibility?: string;
  /** Shown here only when the Co-authoring tools card (its usual home) is hidden. */
  showReaderResources?: boolean;
  onOpenReaderResources?: () => void;
}

const ProjectLinkButtons: React.FC<ProjectLinkButtonsProps> = ({
  adaptCourseID,
  className,
  wide = false,
  didCreateWorkbench,
  didRequestPublish,
  hasCommonsBook = false,
  isProjectMemberOrAdmin = false,
  libreCoverID,
  libreLibrary,
  project,
  projectClassification,
  projectID,
  projectLink,
  projectTitle,
  projectVisibility,
  showReaderResources = false,
  onOpenReaderResources,
}) => {
  const [showCreateWorkbenchModal, setShowCreateWorkbenchModal] =
    useState(false);
  const [showImportWorkbenchModal, setShowImportWorkbenchModal] =
    useState(false);
  const [showCompileDrawer, setShowCompileDrawer] = useState(false);
  const [showPublishDrawer, setShowPublishDrawer] = useState(false);
  const validBook = libreCoverID && libreLibrary;
  const canCompile = !!validBook && hasCommonsBook && isProjectMemberOrAdmin;
  const user = useTypedSelector((state) => state.user);
  // Publishing moves pages on the library and flips the project public, so it
  // is the publishing team's tool rather than any member's.
  //
  // Deliberately not gated on `hasCommonsBook`, unlike compiling: a book earns
  // its Commons record by sitting under a sync root and being publicly
  // readable, which is what steps 2 and 3 of this flow do. Requiring the record
  // up front would hide the button on exactly the books that still need
  // publishing. Only the compile step needs a Book row, and it says so when the
  // row is missing.
  const canPublish = !!validBook && user.isSuperAdmin;
  const isPublished = isProjectPublished(project);

  const { data: initialImportJob } = useQuery<ActiveImportJob | null>({
    queryKey: ["active-import-pressbooks-job", projectID],
    queryFn: async () => {
      const res = await axios.get("/commons/import-pressbooks/active", {
        params: { projectID },
      });
      if (res.data.err || !res.data.job) return null;
      return res.data.job as ActiveImportJob;
    },
    enabled: !!projectID,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (initialImportJob) {
      setShowImportWorkbenchModal(true);
    }
  }, [initialImportJob]);

  if (projectClassification === ProjectClassification.MINI_REPO) return null;

  // `validBook` is checked too: a project can pick up libreLibrary/libreCoverID
  // from its projectURL without ever creating a Workbench book, and the server
  // refuses to create a second book for an already-linked project.
  const canCreateBook =
    !projectLink && !didCreateWorkbench && !validBook && isProjectMemberOrAdmin;
  const showOpenLink = !!(projectLink || validBook);
  const showCommonsProject = projectVisibility === "public";
  const showCommonsBook = !!(hasCommonsBook && libreCoverID && libreLibrary);
  const showAdapt = !!adaptCourseID && !isEmptyString(adaptCourseID);
  // A published book always has a Commons record, so the `!hasCommonsBook`
  // gate would hide this button at exactly the point it should read
  // "Published". `isPublished` keeps it on screen for that state.
  const showPublishRequest =
    isProjectMemberOrAdmin && didCreateWorkbench && (!hasCommonsBook || isPublished);

  const hasTiles =
    canCreateBook ||
    showOpenLink ||
    canCompile ||
    canPublish ||
    showCommonsProject ||
    showCommonsBook ||
    showAdapt ||
    showReaderResources;

  const renderPublishRequest = (buttonClassName: string) =>
    isPublished || didRequestPublish ? (
      <Button
        variant="primary"
        size="sm"
        className={buttonClassName}
        icon={<IconSend size={15} />}
        disabled
        title={
          isPublished
            ? "This book has completed every publishing step."
            : "A publishing request has already been submitted for this project."
        }
      >
        {isPublished ? "Published" : "Publishing Requested"}
      </Button>
    ) : (
      <Button
        as="a"
        href={`https://commons.libretexts.org/support/contact?queue=publishing&projectID=${projectID}&capturedURL=${encodeURIComponent(window.location.href)}`}
        target="_blank"
        rel="noopener noreferrer"
        variant="primary"
        size="sm"
        className={buttonClassName}
        icon={<IconSend size={15} />}
      >
        Request to Publish
        <span className="sr-only"> (opens in new tab)</span>
      </Button>
    );

  return (
    <>
      {(hasTiles || showPublishRequest) && (
        <SectionCard
          title="Important Actions"
          className={className}
          actions={showPublishRequest ? renderPublishRequest("max-sm:hidden") : undefined}
          bodyClassName="p-4"
        >
          {hasTiles && (
            <div
              className={classNames(
                "grid grid-cols-2 gap-2",
                wide && "sm:grid-cols-3"
              )}
            >
              {canCreateBook && (
                <ProjectToolTile
                  icon={<IconPlus size={18} />}
                  label="Create Book"
                  onClick={() => setShowCreateWorkbenchModal(true)}
                />
              )}
              {canCreateBook && user.isSuperAdmin && (
                <ProjectToolTile
                  icon={<IconFileImport size={18} />}
                  label="Import Book (Admin Only)"
                  onClick={() => setShowImportWorkbenchModal(true)}
                />
              )}
              {showOpenLink && (
                <ProjectToolTile
                  icon={<IconExternalLink size={18} />}
                  label="Open Project Link"
                  external
                  href={
                    validBook
                      ? buildLibraryPageGoURL(libreLibrary, libreCoverID)
                      : normalizeURL(projectLink ?? "")
                  }
                />
              )}
              {/* `hasCommonsBook` gates this on a Book record actually existing for
                  `${libreLibrary}-${libreCoverID}`. Shapeshift would happily accept a
                  job for an unpublished book, but there is no Book row to record the
                  job ID against, so the drawer could never show its progress. */}
              {canCompile && (
                <ProjectToolTile
                  icon={<IconPackageExport size={18} />}
                  label="View Export Options"
                  onClick={() => setShowCompileDrawer(true)}
                />
              )}
              {canPublish && user.isSuperAdmin && (
                <ProjectToolTile
                  icon={<IconConfetti size={18} />}
                  label="Publish Book"
                  badge={<Badge label="Admins only" variant="default" size="sm" />}
                  onClick={() => setShowPublishDrawer(true)}
                />
              )}
              {showCommonsProject && (
                <ProjectToolTile
                  icon={<IconWorld size={18} />}
                  label="View Project on Commons"
                  external
                  href={`/commons-project/${projectID}`}
                />
              )}
              {showCommonsBook && (
                <ProjectToolTile
                  icon={<IconBook size={18} />}
                  label="View Book on Commons"
                  external
                  href={buildCommonsUrl(libreLibrary!, libreCoverID!)}
                />
              )}
              {showAdapt && (
                <ProjectToolTile
                  icon={<IconClipboardText size={18} />}
                  label="View Homework on ADAPT"
                  external
                  href={`https://adapt.libretexts.org/instructors/courses/${adaptCourseID}/assignments`}
                />
              )}
              {showReaderResources && (
                <ProjectToolTile
                  icon={<IconBooks size={18} />}
                  label="Manage Reader Resources"
                  onClick={onOpenReaderResources}
                />
              )}
            </div>
          )}
          {showPublishRequest &&
            renderPublishRequest(classNames("sm:hidden w-full", hasTiles && "mt-3"))}
        </SectionCard>
      )}
      {projectID && projectTitle && (
        <CreateWorkbenchModal
          show={showCreateWorkbenchModal}
          projectID={projectID}
          projectTitle={projectTitle}
          onClose={() => setShowCreateWorkbenchModal(false)}
          onSuccess={() => window.location.reload()}
          project={project}
        />
      )}
      {canCompile && showCompileDrawer && (
        <Suspense fallback={null}>
          <CompileBookDrawer
            open={showCompileDrawer}
            onClose={() => setShowCompileDrawer(false)}
            bookID={`${libreLibrary}-${libreCoverID}`}
          />
        </Suspense>
      )}
      {canPublish && showPublishDrawer && projectID && (
        <Suspense fallback={null}>
          <PublishBookDrawer
            open={showPublishDrawer}
            onClose={() => setShowPublishDrawer(false)}
            projectID={projectID}
            projectTitle={projectTitle ?? ''}
          />
        </Suspense>
      )}
      {projectID && projectTitle && user.isSuperAdmin && (
        <ImportWorkbenchModal
          show={showImportWorkbenchModal}
          projectID={projectID}
          onClose={() => setShowImportWorkbenchModal(false)}
          onSuccess={() => window.location.reload()}
          project={project}
          initialJobID={initialImportJob?.jobID ?? null}
          initialJobStatus={initialImportJob?.status}
          initialJobMessages={initialImportJob?.messages}
        />
      )}
    </>
  );
};

export default ProjectLinkButtons;
