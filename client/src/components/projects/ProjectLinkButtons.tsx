import { Button, Tooltip } from "@libretexts/davis-react";
import { IconExternalLink, IconPlus } from "@tabler/icons-react";
import { normalizeURL } from "../util/HelperFunctions";
import {
  buildCommonsUrl,
  buildLibraryPageGoURL,
  buildRemixerURL,
} from "../../utils/projectHelpers";
import { lazy, useEffect, useState } from "react";
import { ProjectClassification } from "../../types";
import { useTypedSelector } from "../../state/hooks";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import ImportWorkbenchModal from "./ImportWorkbenchModal";

type ActiveImportJob = {
  jobID: string;
  status: "pending" | "running" | "success" | "error";
  messages: string[];
};
const CreateWorkbenchModal = lazy(() => import("./CreateWorkbenchModal"));

interface ProjectLinkButtonsProps {
  libreLibrary?: string;
  libreCoverID?: string;
  projectLink?: string;
  didCreateWorkbench?: boolean;
  hasCommonsBook?: boolean;
  projectID?: string;
  projectTitle?: string;
  projectClassification?: string;
  projectVisibility?: string;
  project: object;
  isProjectMemberOrAdmin?: boolean;
  canRequestPublish?: boolean;
  didRequestPublish?: boolean;
}

const ProjectLinkButtons: React.FC<ProjectLinkButtonsProps> = ({
  libreLibrary,
  libreCoverID,
  projectLink,
  didCreateWorkbench,
  hasCommonsBook = false,
  projectID,
  projectTitle,
  projectClassification,
  projectVisibility,
  project,
  isProjectMemberOrAdmin = false,
  canRequestPublish = false,
  didRequestPublish = false,
}) => {
  const [showCreateWorkbenchModal, setShowCreateWorkbenchModal] =
    useState(false);
  const [showImportWorkbenchModal, setShowImportWorkbenchModal] =
    useState(false);
  const validBook = libreCoverID && libreLibrary;

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

  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Important Actions:{" "}
      </span>
      {projectClassification === ProjectClassification.MINI_REPO ? null : (
        <div className="flex flex-row flex-wrap gap-2">
          {!projectLink && !didCreateWorkbench && isProjectMemberOrAdmin && (<>
            <Button
              variant="primary"
              size="sm"
              icon={<IconPlus size={14} />}
              onClick={() => setShowCreateWorkbenchModal(true)}
            >
              Create Book
            </Button>
            {user.isSuperAdmin && (
              <Button
                variant="primary"
                size="sm"
                icon={<IconPlus size={14} />}
                onClick={() => setShowImportWorkbenchModal(true)}
              >
                Import Book (Admin Only)
              </Button>
            )}
          </>
          )}
          {(projectLink || validBook) && (
            <Tooltip
              content={
                validBook
                  ? "This link will take you to the book's page in the LibreTexts libraries."
                  : projectLink
                    ? "This link will take you to the project's linked URL. This may be a book in the LibreTexts library or a third-party resource."
                    : "This project does not have a linked URL."
              }
            >
              <Button
                onClick={() =>
                  validBook
                    ? window.open(
                      buildLibraryPageGoURL(libreLibrary, libreCoverID),
                      "_blank"
                    )
                    : projectLink
                      ? window.open(normalizeURL(projectLink ?? ""), "_blank")
                      : undefined
                }
                variant="secondary"
                size="sm"
                icon={<IconExternalLink size={14} />}
                iconPosition="right"
              >
                Open Project Link
              </Button>
            </Tooltip>
          )}
          {hasCommonsBook && libreCoverID && libreLibrary && (
            <Tooltip content="This link will take you to the book's page on the Commons.">
              <Button
                onClick={() =>
                  window.open(
                    buildCommonsUrl(libreLibrary, libreCoverID),
                    "_blank",
                  )
                }
                variant="secondary"
                size="sm"
                icon={<IconExternalLink size={14} />}
                iconPosition="right"
              >
                View Textbook on Commons
              </Button>
            </Tooltip>
          )}
          {projectVisibility === "public" && (
            <Tooltip content="This link will take you to the project's page on the Commons.">
              <Button
                onClick={() =>
                  window.open(`/commons-project/${projectID}`, "_blank")
                }
                variant="secondary"
                size="sm"
                icon={<IconExternalLink size={14} />}
                iconPosition="right"
              >
                View Project on Commons
              </Button>
            </Tooltip>
          )}
          {(validBook || hasCommonsBook) &&
            libreCoverID &&
            libreLibrary &&
            isProjectMemberOrAdmin && (<>
              {user.isSuperAdmin && (
                <Tooltip content="This link will open the book in the LibreTexts OER Remixer Version 3.">
                  <Button
                    onClick={() => window.open(`/remixer/${projectID}`, "_blank")}
                    variant="secondary"
                    size="sm"
                    icon={<IconExternalLink size={14} />}
                    iconPosition="right"
                  >
                    Open OER Remixer Version 3 (Admin Only)
                  </Button>
                </Tooltip>
              )}
              <Tooltip content="This link will open the book in the LibreTexts OER Remixer.">
                <Button
                  onClick={() =>
                    window.open(
                      buildRemixerURL(
                        libreLibrary ?? "chem",
                        libreLibrary && libreCoverID
                          ? buildLibraryPageGoURL(libreLibrary, libreCoverID)
                          : "",
                      ),
                      "_blank",
                    )
                  }
                  variant="secondary"
                  size="sm"
                  icon={<IconExternalLink size={14} />}
                  iconPosition="right"
                >
                  Open OER Remixer
                </Button>
              </Tooltip>
              {
                user.isSuperAdmin && (
                  <Button
                    onClick={() =>
                      window.open(`/glossary/project/${projectID}`, "_blank")
                    }
                    variant="secondary"
                    size="sm"
                  >
                    Glossary Manager
                  </Button>
                )}
            </>
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
      )}
    </div>
  );
};

export default ProjectLinkButtons;
