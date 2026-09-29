import { Button, Tooltip } from "@libretexts/davis-react";
import { IconBook, IconExternalLink, IconPlus, IconSend } from "@tabler/icons-react";
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

type ActiveImportJob = {
  jobID: string;
  status: "pending" | "running" | "success" | "error";
  messages: string[];
};
const CreateWorkbenchModal = lazyWithRetry(() => import("./CreateWorkbenchModal"));
// Tooltips default to centered above the trigger, which runs past the left edge
// of the card and gets clipped. Pin them under the button, growing to the right.
const actionTooltipClass =
  "[&>[role=tooltip]]:!left-0 [&>[role=tooltip]]:!translate-x-0 [&>[role=tooltip]]:!right-auto";
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
}

const ProjectLinkButtons: React.FC<ProjectLinkButtonsProps> = ({
  adaptCourseID,
  className,
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
  return (
    <div className={className}>
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Important Actions:
      </span>
      <div className="flex flex-row flex-wrap gap-2 mt-2">
        {/* `validBook` is checked too: a project can pick up libreLibrary/libreCoverID
            from its projectURL without ever creating a Workbench book, and the server
            refuses to create a second book for an already-linked project. */}
        {!projectLink && !didCreateWorkbench && !validBook && isProjectMemberOrAdmin && (<>
            <Button
              variant="primary"
              size="sm"
              icon={<IconPlus size={16} />}
              onClick={() => setShowCreateWorkbenchModal(true)}
            >
              Create Book
            </Button>
            {user.isSuperAdmin && (
              <Button
                variant="primary"
                size="sm"
                icon={<IconPlus size={16} />}
                onClick={() => setShowImportWorkbenchModal(true)}
              >
                Import Book (Admin Only)
              </Button>
            )}
          </>
        )}
        {(projectLink || validBook) && (
          <Tooltip
            placement="bottom"
            className={actionTooltipClass}
            content={
              validBook
                ? "This link will take you to the book's page in the LibreTexts libraries."
                : projectLink
                  ? "This link will take you to the project's linked URL. This may be a book in the LibreTexts library or a third-party resource."
                  : "This project does not have a linked URL."
            }
          >
            <Button
              as="a"
              href={
                validBook
                  ? buildLibraryPageGoURL(libreLibrary, libreCoverID)
                  : normalizeURL(projectLink ?? "")
              }
              target="_blank"
              rel="noopener noreferrer"
              variant="primary"
              size="sm"
              icon={<IconExternalLink size={16} />}
              iconPosition="right"
            >
              Open Project Link
            </Button>
          </Tooltip>
        )}
        {/* `hasCommonsBook` gates this on a Book record actually existing for
            `${libreLibrary}-${libreCoverID}`. Shapeshift would happily accept a
            job for an unpublished book, but there is no Book row to record the
            job ID against, so the drawer could never show its progress. */}
        {canCompile && (
          <Button
            variant="primary"
            size="sm"
            icon={<IconSend size={16} />}
            onClick={() => setShowCompileDrawer(true)}
          >
            Compile book
          </Button>
        )}
        {/* Hidden on purpose. The publish flow is merged but not yet released to
            the publishing team; uncomment this to turn it on. Everything behind
            it — `canPublish`, the drawer, the API — is live and unchanged, so
            this is the only line that has to move. */}
        {/* {canPublish && (
          <Button
            variant="primary"
            size="sm"
            icon={<IconConfetti size={16} />}
            onClick={() => setShowPublishDrawer(true)}
          >
            Publish Book (Admin Visible Only)
          </Button>
        )} */}
        {projectVisibility === "public" && (
          <Tooltip
            placement="bottom"
            className={actionTooltipClass}
            content="This link will take you to the project's page on the Commons."
          >
            <Button
              as="a"
              href={`/commons-project/${projectID}`}
              target="_blank"
              rel="noopener noreferrer"
              variant="primary"
              size="sm"
              icon={<IconExternalLink size={16} />}
              iconPosition="right"
            >
              View Project on Commons
            </Button>
          </Tooltip>
        )}
        {hasCommonsBook && libreCoverID && libreLibrary && (
          <Tooltip
            placement="bottom"
            className={actionTooltipClass}
            content="This link will take you to the book's page on the Commons."
          >
            <Button
              as="a"
              href={buildCommonsUrl(libreLibrary, libreCoverID)}
              target="_blank"
              rel="noopener noreferrer"
              variant="primary"
              size="sm"
              icon={<IconBook size={16} />}
              iconPosition="right"
            >
              View Book on Commons
            </Button>
          </Tooltip>
        )}
        {adaptCourseID && !isEmptyString(adaptCourseID) && (
          <Button
            as="a"
            href={`https://adapt.libretexts.org/instructors/courses/${adaptCourseID}/assignments`}
            target="_blank"
            rel="noopener noreferrer"
            variant="primary"
            size="sm"
            icon={<IconExternalLink size={16} />}
            iconPosition="right"
          >
            View Homework on ADAPT
          </Button>
        )}
        {/* A published book always has a Commons record, so the `!hasCommonsBook`
            gate would hide this button at exactly the point it should read
            "Published". `isPublished` keeps it on screen for that state. */}
        {isProjectMemberOrAdmin &&
          didCreateWorkbench &&
          (!hasCommonsBook || isPublished) &&
          (isPublished || didRequestPublish ? (
            <Button
              variant="primary"
              size="sm"
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
            >
              Request to Publish
            </Button>
          ))}
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
      </div>
    </div>
  );
};

export default ProjectLinkButtons;
