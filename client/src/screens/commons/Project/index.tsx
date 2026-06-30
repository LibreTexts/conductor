import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Icon,
  Segment,
  Header,
  Image,
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
import { Breadcrumb, Button, Card, Spinner, Stack } from "@libretexts/davis-react";

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

  return (
    <>
      {/* Breadcrumb Navigation */}
      <div className="px-6 py-3 border-b border-neutral-200">
        <Breadcrumb aria-label="Page navigation">
          <Breadcrumb.Item href="/catalog">
            Catalog
          </Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>{project?.title ?? "Project"}</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="flex justify-center items-center p-16">
          <Spinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_3fr] gap-6 p-6">
          <Card padding="sm">
            <Stack direction="vertical" gap="md">
              {project?.thumbnail && (
                <img
                  src={project.thumbnail}
                  aria-hidden={true}
                  alt=""
                  className="w-full rounded-md"
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
              {/* Label/value metadata as a definition list (SC 1.3.1). Each
                  row is a <dt>/<dd> pair; icon-only rows carry an sr-only <dt>
                  so the label is programmatically available, and the icons are
                  decorative (aria-hidden). dt/dd are inline + m-0 to preserve
                  the original single-line, tightly-spaced appearance. */}
              <dl className="m-0">
                <div className="mt-2">
                  <dt className="inline font-bold m-0">Description: </dt>
                  <dd className="inline m-0">
                    {project?.description
                      ? project?.description
                      : "No description available."}
                  </dd>
                </div>
                <div className="mt-2">
                  <dt className="sr-only">Principal Investigators</dt>
                  <dd className="inline m-0">
                    <Icon name="user" color="blue" className="!mr-2" aria-hidden="true" />
                    {project?.principalInvestigators &&
                      project?.principalInvestigators.length > 0 ? (
                      project?.principalInvestigators
                        ?.map((p) => p.name)
                        .join(", ")
                    ) : (
                      <span className="muted-text">No principal investigators</span>
                    )}
                  </dd>
                </div>
                <div className="mt-2">
                  <dt className="sr-only">Co-Principal Investigators</dt>
                  <dd className="inline m-0">
                    <Icon name="user plus" color="blue" className="!mr-2" aria-hidden="true" />
                    {project?.coPrincipalInvestigators &&
                      project?.coPrincipalInvestigators.length > 0 ? (
                      project?.coPrincipalInvestigators
                        ?.map((p) => p.name)
                        .join(", ")
                    ) : (
                      <span className="muted-text">
                        No co-principal investigators
                      </span>
                    )}
                  </dd>
                </div>
                <div className="mt-2">
                  <dt className="sr-only">Associated Organizations</dt>
                  <dd className="inline m-0">
                    <Icon name="university" color="blue" className="!mr-2" aria-hidden="true" />
                    {project?.associatedOrgs &&
                      project?.associatedOrgs.length > 0 ? (
                      project?.associatedOrgs.join(", ")
                    ) : (
                      <span className="muted-text">
                        No associated organizations
                      </span>
                    )}
                  </dd>
                </div>
                {project?.projectURL && (
                  <div className="mt-2">
                    <dt className="sr-only">Project URL</dt>
                    <dd className="inline m-0">
                      <Icon name="linkify" color="blue" className="!mr-2" aria-hidden="true" />
                      <a
                        href={project?.projectURL}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all"
                      >
                        {truncateString(project?.projectURL, 50)}
                      </a>
                    </dd>
                  </div>
                )}
                {org.orgID == "calearninglab" && project?.contentArea && (
                  <div className="mt-2">
                    <dt className="sr-only">Content Area</dt>
                    <dd className="inline m-0">
                      <Icon name="content" color="blue" className="!mr-2" aria-hidden="true" />
                      {project?.contentArea}
                    </dd>
                  </div>
                )}
                {org.orgID !== "calearninglab" && (
                  <>
                    <div className="mt-2">
                      <dt className="sr-only">Status</dt>
                      <dd className="inline m-0">
                        <Icon name="dashboard" color="blue" aria-hidden="true" />{" "}
                        {project?.status
                          ? capitalizeFirstLetter(project.status)
                          : "Unknown Status"}
                      </dd>
                    </div>
                    <div className="mt-2">
                      <dt className="sr-only">Classification</dt>
                      <dd className="inline m-0">
                        <Icon name="clipboard list" color="blue" aria-hidden="true" />{" "}
                        {project?.classification
                          ? capitalizeFirstLetter(project.classification)
                          : "Unknown Classification"}
                      </dd>
                    </div>
                    <div className="mt-2">
                      <dt className="sr-only">Library</dt>
                      <dd className="inline m-0">
                        <Image
                          src={getLibGlyphURL(project?.libreLibrary)}
                          className="library-glyph"
                          aria-hidden="true"
                        />
                        {getLibraryName(project?.libreLibrary)}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
              <Button
                as={Link}
                fullWidth
                disabled={!project?.projectID}
                to={`/projects/${project?.projectID}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                View in Conductor
              </Button>
            </Stack>
          </Card>

          <Stack direction="vertical" gap="md">
            {projectID && showAssets && (
              <div className="flex flex-row ">
                <FilesManager
                  projectID={projectID}
                  canViewDetails={false}
                  allowBulkDownload={true}
                  toggleFilesManager={() => setShowAssets(!showAssets)}
                  projectVisibility="public"
                />
              </div>
            )}
            {projectID && !showAssets && (
              <Segment>
                <div className="hiddensection">
                  <div className="header-container">
                    <Header as="h2">Assets</Header>
                  </div>
                  <div className="button-container">
                    <Button
                      onClick={() => setShowAssets(!showAssets)}
                    >
                      Show
                    </Button>
                  </div>
                </div>
              </Segment>
            )}
          </Stack>
        </div>
      )};
    </>
  )
};

export default CommonsProject;
