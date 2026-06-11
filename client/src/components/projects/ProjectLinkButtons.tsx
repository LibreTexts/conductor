import { Button, Header, Icon, Popup } from "semantic-ui-react";
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
      <Header as="span" sub>
        Important Actions:{" "}
      </Header>
      {projectClassification === ProjectClassification.MINI_REPO ? null : (
        <div className="flex flex-row flex-wrap gap-2">
          {!projectLink && !didCreateWorkbench && isProjectMemberOrAdmin && (<>
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
          {hasCommonsBook && libreCoverID && libreLibrary && (
            <Popup
              content="This link will take you to the book's page on the Commons."
              trigger={
                <Button
                  onClick={() =>
                    window.open(
                      buildCommonsUrl(libreLibrary, libreCoverID),
                      "_blank"
                    )
                  }
                  color="blue"
                  size="small"
                >
                  View Textbook on Commons
                  <Icon name="external alternate" className="!ml-2" />
                </Button>
              }
            />
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
          {(validBook || hasCommonsBook) &&
            libreCoverID &&
            libreLibrary &&
            isProjectMemberOrAdmin && (<>
            {user.isSuperAdmin && (
              <Popup
                content="This link will open the book in the LibreTexts OER Remixer Version 3."
                trigger={
                  <Button
                    onClick={() => window.open(`/remixer/${projectID}`, "_blank")}
                    color="blue"
                    size="small"
                  >
                    Open OER Remixer Version 3 (Admin Only)
                    <Icon name="external alternate" className="!ml-2" />
                  </Button>
                }
              />
              )}
              <Popup
                content="This link will open the book in the LibreTexts OER Remixer."
                trigger={
                  <Button
                    onClick={() =>
                      window.open(
                        buildRemixerURL(
                          libreLibrary ?? "chem",
                          libreLibrary && libreCoverID
                            ? buildLibraryPageGoURL(libreLibrary, libreCoverID)
                            : ""
                        ),
                        "_blank"
                      )
                    }
                    color="blue"
                    size="small"
                  >
                    Open OER Remixer
                    <Icon name="external alternate" className="!ml-2" />
                  </Button>
                }
              /></>
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
