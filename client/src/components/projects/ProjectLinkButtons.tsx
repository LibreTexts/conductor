import { Button, Header, Icon, Popup } from "semantic-ui-react";
import {isEmptyString, normalizeURL} from "../util/HelperFunctions";
import {
  buildCommonsUrl,
  buildLibraryPageGoURL,
} from "../../utils/projectHelpers";
import { Suspense, useEffect, useState } from "react";
import lazyWithRetry from "../../utils/lazyWithRetry";
import { ProjectClassification } from "../../types";
import { useTypedSelector } from "../../state/hooks";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import ImportWorkbenchModal from "./ImportWorkbenchModal";
import { Button as DavisButton } from "@libretexts/davis-react";
import { IconSend } from "@tabler/icons-react";

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

interface ProjectLinkButtonsProps {
  adaptCourseID?: string;
  className?: string;
  didCreateWorkbench?: boolean;
  didRequestPublish?: boolean;
  hasCommonsBook?: boolean;
  isProjectMemberOrAdmin?: boolean;
  libreCoverID?: string;
  libreLibrary?: string;
  project: object;
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
  const validBook = libreCoverID && libreLibrary;
  const canCompile = !!validBook && hasCommonsBook && isProjectMemberOrAdmin;
  const user = useTypedSelector((state) => state.user);

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
      <Header as="span" sub>
        Important Actions:{" "}
      </Header>
      <div className="flex flex-row flex-wrap gap-2 mt-2">
        {/* `validBook` is checked too: a project can pick up libreLibrary/libreCoverID
            from its projectURL without ever creating a Workbench book, and the server
            refuses to create a second book for an already-linked project. */}
        {!projectLink && !didCreateWorkbench && !validBook && isProjectMemberOrAdmin && (<>
            <Button
              color="green"
              onClick={() => setShowCreateWorkbenchModal(true)}
            >
              <Icon name="plus" />
              Create Book
            </Button>
            {user.isSuperAdmin && (
              <Button
                color="green"
                onClick={() => setShowImportWorkbenchModal(true)}
              >
                <Icon name="plus" />
                Import Book (Admin Only)
              </Button>
            )}
          </>
        )}
        {(projectLink || validBook) && (
          <>
            <Popup
              content={
                validBook
                  ? "This link will take you to the book's page in the LibreTexts libraries."
                  : projectLink
                    ? "This link will take you to the project's linked URL. This may be a book in the LibreTexts library or a third-party resource."
                    : "This project does not have a linked URL."
              }
              trigger={
                <Button
                  onClick={() =>
                    validBook
                      ? window.open(
                        buildLibraryPageGoURL(libreLibrary, libreCoverID),
                        "_blank"
                      )
                      : projectLink
                        ? window.open(normalizeURL(projectLink ?? ""), "_blank")
                        : ""
                  }
                  color="blue"
                  size="small"
                >
                  Open Project Link
                  <Icon name="external alternate" className="!ml-2" />
                </Button>
              }
            />
          </>
        )}
        {/* `hasCommonsBook` gates this on a Book record actually existing for
            `${libreLibrary}-${libreCoverID}`. Shapeshift would happily accept a
            job for an unpublished book, but there is no Book row to record the
            job ID against, so the drawer could never show its progress. */}
        {canCompile && (
          <DavisButton
            variant="primary"
            size="sm"
            icon={<IconSend size={16} />}
            onClick={() => setShowCompileDrawer(true)}
          >
            Compile book
          </DavisButton>
        )}
        {projectVisibility === "public" && (
          <Popup
            content="This link will take you to the project's page on the Commons."
            trigger={
              <Button
                onClick={() =>
                  window.open(`/commons-project/${projectID}`, "_blank")
                }
                color="blue"
                size="small"
              >
                View Project on Commons
                <Icon name="external alternate" className="!ml-2" />
              </Button>
            }
          />
        )}
        {hasCommonsBook && libreCoverID && libreLibrary && (
          <Popup
            content="This link will take you to the book's page on the Commons."
            trigger={
              <Button
                onClick={() =>
                  window.open(
                    buildCommonsUrl(libreLibrary, libreCoverID),
                    "_blank",
                  )
                }
                color="blue"
                size="small"
              >
                View Book on Commons
                <Icon name="external alternate" className="!ml-2" />
              </Button>
            }
          />
        )}
        {adaptCourseID && !isEmptyString(adaptCourseID) && (
          <Button
            onClick={() =>
              window.open(
                `https://adapt.libretexts.org/instructors/courses/${adaptCourseID}/assignments`,
                "_blank"
              )
            }
            color="blue"
            size="small"
          >
            View Homework on ADAPT
            <Icon name="external alternate" className="!ml-2" />
          </Button>
        )}
        {isProjectMemberOrAdmin && !hasCommonsBook && didCreateWorkbench && (
          <Button
            color='blue'
            compact
            className='!w-48'
            disabled={didRequestPublish}
            {...(didRequestPublish
              ? {}
              : {
                  as: 'a',
                  href: `https://commons.libretexts.org/support/contact?queue=publishing&projectID=${projectID}&capturedURL=${encodeURIComponent(window.location.href)}`,
                  target: '_blank',
                })}
          >
            {didRequestPublish ? 'Publishing Requested' : 'Request to Publish'}
          </Button>
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
