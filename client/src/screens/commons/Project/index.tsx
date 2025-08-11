import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Icon,
  Segment,
  Header,
  Breadcrumb,
  Image,
  Button,
} from "semantic-ui-react";
import { useTypedSelector } from "../../../state/hooks";
import FilesManager from "../../../components/FilesManager";
import {
  capitalizeFirstLetter,
  truncateString,
} from "../../../components/util/HelperFunctions";
import {
  getLibGlyphURL,
  getLibraryName,
} from "../../../components/util/LibraryOptions";
import useProject from "../../../hooks/useProject";

/**
 * Displays a public Project's page in the Commons catalog.
 */
const CommonsProject = () => {
  const { id: projectID } = useParams<{ id: string }>();
  const org = useTypedSelector((state) => state.org);
  const { project, isLoading, isMiniRepo } = useProject(projectID);

  // Project data
  const [showAssets, setShowAssets] = useState<boolean>(true);

  /**
   * Update page title when data is available.
   */
  useEffect(() => {
    if (project?.title) {
      document.title = `${project.title} - ${org.name} Commons`;
    }
  }, [project]);

  const handleOpenInConductor = () => {
    if (!project?.projectID) return;

    window.open(`/projects/${project?.projectID}`, "_blank");
  };

  return (
    <div className="commons-page-container">
      <Segment.Group raised>
        <Segment>
          <Breadcrumb>
            <Breadcrumb.Section as={Link} to="/catalog">
              <span>
                <span className="muted-text">You are on: </span>
                Catalog
              </span>
            </Breadcrumb.Section>
            <Breadcrumb.Divider icon="right chevron" />
            <Breadcrumb.Section active>
              {project?.title ?? "Unknown"}
            </Breadcrumb.Section>
          </Breadcrumb>
        </Segment>
        <Segment loading={isLoading} className="">
          <div className="flex flex-col lg:flex-row px-1 pb-8">
            <div className="flex flex-col w-full lg:w-1/4 lg:max-w-[400px] min-h-48 h-fit border shadow-md p-4 rounded-md mr-16">
              {project?.thumbnail && (
                <div
                  className="h-48 w-full bg-contain bg-center rounded-md bg-no-repeat"
                  style={{
                    backgroundImage: `url(${project.thumbnail})`,
                  }}
                />
              )}
              <Header as="h1" className="!mb-4 !ml-0.5">
                {project?.projectURL ? (
                  <a
                    href={project?.projectURL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {truncateString(project?.title, 75)}
                  </a>
                ) : (
                  truncateString(project?.title ?? "", 75)
                )}
              </Header>
              <p className="mt-2">
                <strong>Description: </strong>
                {project?.description
                  ? project?.description
                  : "No description available."}
              </p>
              <p className="mt-2">
                <Icon name="user" color="blue" className="!mr-2" />
                {project?.principalInvestigators &&
                project?.principalInvestigators.length > 0 ? (
                  project?.principalInvestigators
                    ?.map((p) => `${p.firstName} ${p.lastName}`)
                    .join(", ")
                ) : (
                  <span className="muted-text">No principal investigators</span>
                )}
              </p>
              <p className="mt-2">
                <Icon name="user plus" color="blue" className="!mr-2" />
                {project?.coPrincipalInvestigators &&
                project?.coPrincipalInvestigators.length > 0 ? (
                  project?.coPrincipalInvestigators
                    ?.map((p) => `${p.firstName} ${p.lastName}`)
                    .join(", ")
                ) : (
                  <span className="muted-text">
                    No co-principal investigators
                  </span>
                )}
              </p>
              <p className="mt-2">
                <Icon name="university" color="blue" className="!mr-2" />
                {project?.associatedOrgs &&
                project?.associatedOrgs.length > 0 ? (
                  project?.associatedOrgs.join(", ")
                ) : (
                  <span className="muted-text">
                    No associated organizations
                  </span>
                )}
              </p>
              {project?.projectURL && (
                <p className="mt-2">
                  <Icon name="linkify" color="blue" className="!mr-2" />
                  <a
                    href={project?.projectURL}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all"
                  >
                    {truncateString(project?.projectURL, 50)}
                  </a>
                </p>
              )}
              {org.orgID == "calearninglab" && project?.contentArea && (
                <p className="mt-2">
                  <Icon name="content" color="blue" className="!mr-2" />
                  {project?.contentArea}
                </p>
              )}
              {org.orgID !== "calearninglab" && (
                <>
                  <p className="mt-2">
                    <Icon name="dashboard" color="blue" />{" "}
                    {project?.status
                      ? capitalizeFirstLetter(project.status)
                      : "Unknown Status"}
                  </p>
                  <p className="mt-2">
                    <Icon name="clipboard list" color="blue" />{" "}
                    {project?.classification
                      ? capitalizeFirstLetter(project.classification)
                      : "Unknown Classification"}
                  </p>
                  <p className="mt-2">
                    <Image
                      src={getLibGlyphURL(project?.libreLibrary)}
                      className="library-glyph"
                    />
                    {getLibraryName(project?.libreLibrary)}
                  </p>
                </>
              )}
              <Button
                icon="lightning"
                content="View in Conductor"
                color="blue"
                fluid
                onClick={handleOpenInConductor}
                className="!mt-4"
              />
            </div>
            <div className="flex flex-col w-full lg:w-3/4 mt-8 lg:mt-0">
              {projectID && showAssets && (
                <div className="flex flex-row ">
                  <FilesManager
                    projectID={projectID}
                    canViewDetails={false}
                    toggleFilesManager={() => setShowAssets(!showAssets)}
                    projectVisibility="public"
                  />
                </div>
              )}
              {projectID && !showAssets && (
                <Segment>
                  <div className="hiddensection">
                    <div className="header-container">
                      <Header as="h3">Assets</Header>
                    </div>
                    <div className="button-container">
                      <Button
                        floated="right"
                        onClick={() => setShowAssets(!showAssets)}
                      >
                        Show
                      </Button>
                    </div>
                  </div>
                </Segment>
              )}
            </div>
          </div>
        </Segment>
      </Segment.Group>
    </div>
  );
};

export default CommonsProject;
