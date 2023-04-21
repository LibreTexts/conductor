import "./ControlPanel.css";

import {
  Grid,
  Header,
  Segment,
  Table,
  Breadcrumb,
  Image,
} from "semantic-ui-react";
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { RouteComponentProps } from "react-router-dom";
import axios from "axios";
import { format, parseISO } from "date-fns";

import {
  getClassificationText,
  getVisibilityText,
} from "../util/ProjectHelpers.js";
import { truncateString } from "../util/HelperFunctions.js";
import useGlobalError from "../error/ErrorHooks";
import { Project, User } from "../../types";

interface MatchParams {
  uuid: string;
}

const UserDetails = (props: RouteComponentProps<MatchParams>) => {
  // Global State
  const { handleGlobalError } = useGlobalError();

  // Data
  const [userData, setUserData] = useState<User>({} as User);
  const [userProjects, setUserProjects] = useState<Project[]>([]);

  // UI
  const [loadedData, setLoadedData] = useState<boolean>(false);

  /**
   * Retrieves a list of the user's Projects from the server.
   */
  const getUserProjects = useCallback(() => {
    setLoadedData(false);
    axios
      .get("/user/projects", {
        params: {
          uuid: props.match.params.uuid,
        },
      })
      .then((res) => {
        if (!res.data.err) {
          if (Array.isArray(res.data.projects)) {
            let sorted = res.data.projects.sort((a: Project, b: Project) => {
              let aNormal = a.title.toLowerCase();
              let bNormal = b.title.toLowerCase();
              if (aNormal < bNormal) {
                return -1;
              }
              if (aNormal > bNormal) {
                return 1;
              }
              return 0;
            });
            setUserProjects(sorted);
          }
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setLoadedData(true);
      })
      .catch((err) => {
        setLoadedData(true);
        handleGlobalError(err);
      });
  }, [props.match, setLoadedData, handleGlobalError]);

  /**
   * Retrieve the user's basic information from the server.
   */
  const getUser = useCallback(() => {
    if (
      typeof props.match?.params?.uuid === "string" &&
      props.match?.params?.uuid.length > 0
    ) {
      setLoadedData(false);
      axios
        .get("/user/admininfo", {
          params: {
            uuid: props.match.params.uuid,
          },
        })
        .then((res) => {
          if (!res.data.err) {
            if (typeof res.data.user === "object") {
              const createdDate = new Date(res.data.user.createdAt);
              setUserData({
                ...res.data.user,
                createdAt: createdDate.toDateString(),
              });
              getUserProjects();
            }
          } else {
            handleGlobalError(res.data.errMsg);
          }
          setLoadedData(true);
        })
        .catch((err) => {
          setLoadedData(true);
          handleGlobalError(err);
        });
    }
  }, [
    props.match,
    setLoadedData,
    setUserData,
    getUserProjects,
    handleGlobalError,
  ]);

  /**
   * Set page title and retrieve user information on initial load.
   */
  useEffect(() => {
    document.title = "LibreTexts Conductor | User Details";
    getUser();
  }, [getUser]);

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header">User Details</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment>
              <Breadcrumb>
                <Breadcrumb.Section as={Link} to="/controlpanel">
                  Control Panel
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section as={Link} to="/controlpanel/usersmanager">
                  Users Manager
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon="right chevron" />
                <Breadcrumb.Section active>User Details</Breadcrumb.Section>
              </Breadcrumb>
            </Segment>
            <Segment loading={!loadedData}>
              <Grid divided="vertically" verticalAlign="middle">
                <Grid.Row>
                  <Grid.Column width={2}>
                    <Image
                      src={userData.avatar || "/mini_logo.png"}
                      size="medium"
                      circular
                    />
                  </Grid.Column>
                  <Grid.Column width={14}>
                    <Header as="h2">
                      {userData.firstName} {userData.lastName}
                    </Header>
                    <Grid>
                      <Grid.Row columns="equal">
                        <Grid.Column>
                          <Header sub>Email</Header>
                          {userData.email ? (
                            <p>{userData.email}</p>
                          ) : (
                            <p>
                              <em>Unknown</em>
                            </p>
                          )}
                        </Grid.Column>
                        <Grid.Column>
                          <Header sub>Authentication Method</Header>
                          {userData.authType ? (
                            <p>{userData.authType}</p>
                          ) : (
                            <p>
                              <em>Unknown</em>
                            </p>
                          )}
                        </Grid.Column>
                        <Grid.Column>
                          <Header sub>Account Creation Date</Header>
                          {userData.createdAt ? (
                            <p>{userData.createdAt}</p>
                          ) : (
                            <p>
                              <em>Unknown</em>
                            </p>
                          )}
                        </Grid.Column>
                      </Grid.Row>
                    </Grid>
                  </Grid.Column>
                </Grid.Row>
              </Grid>
              <Header as="h3" dividing>
                User Projects
              </Header>
              <Table celled>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell width={6}>
                      <Header sub>Title</Header>
                    </Table.HeaderCell>
                    <Table.HeaderCell width={2}>
                      <Header sub>Progress (C/PR/A11Y)</Header>
                    </Table.HeaderCell>
                    <Table.HeaderCell width={2}>
                      <Header sub>Classification</Header>
                    </Table.HeaderCell>
                    <Table.HeaderCell width={2}>
                      <Header sub>Visibility</Header>
                    </Table.HeaderCell>
                    <Table.HeaderCell width={2}>
                      <Header sub>Lead</Header>
                    </Table.HeaderCell>
                    <Table.HeaderCell width={2}>
                      <Header sub>Last Updated</Header>
                    </Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {userProjects.length > 0 &&
                    userProjects.map((item, index) => {
                      let projectLead = "Unknown";
                      if (item.leads && Array.isArray(item.leads)) {
                        item.leads.forEach((lead, leadIdx) => {
                          if (lead.firstName && lead.lastName) {
                            if (leadIdx > 0)
                              projectLead += `, ${lead.firstName} ${lead.lastName}`;
                            else if (leadIdx === 0)
                              projectLead = `${lead.firstName} ${lead.lastName}`;
                          }
                        });
                      }
                      if (!item.hasOwnProperty("peerProgress"))
                        item.peerProgress = 0;
                      if (!item.hasOwnProperty("a11yProgress"))
                        item.a11yProgress = 0;
                      return (
                        <Table.Row key={index}>
                          <Table.Cell>
                            <p>
                              <strong>
                                <Link to={`/projects/${item.projectID}`}>
                                  {truncateString(item.title, 100)}
                                </Link>
                              </strong>
                            </p>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="flex-row-div projectprotal-progress-row">
                              <div className="projectportal-progress-col">
                                <span>{item.currentProgress}%</span>
                              </div>
                              <div className="projectportal-progresssep-col">
                                <span className="projectportal-progresssep">
                                  /
                                </span>
                              </div>
                              <div className="projectportal-progress-col">
                                <span>{item.peerProgress}%</span>
                              </div>
                              <div className="projectportal-progresssep-col">
                                <span className="projectportal-progresssep">
                                  /
                                </span>
                              </div>
                              <div className="projectportal-progress-col">
                                <span>{item.a11yProgress}%</span>
                              </div>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            {item.classification ? (
                              <p>
                                {getClassificationText(item.classification)}
                              </p>
                            ) : (
                              <p>
                                <em>Unclassified</em>
                              </p>
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            {typeof item.visibility === "string" &&
                            item.visibility !== "" ? (
                              <p>{getVisibilityText(item.visibility)}</p>
                            ) : (
                              <p>
                                <em>Unknown</em>
                              </p>
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            <p>{truncateString(projectLead, 50)}</p>
                          </Table.Cell>
                          <Table.Cell>
                            <p>
                              {format(
                                parseISO(item.updatedAt ?? ""),
                                "MM/dd/yyyy"
                              )}{" "}
                              at{" "}
                              {format(
                                parseISO(item.updatedAt ?? ""),
                                "h:mm aa"
                              )}
                            </p>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  {userProjects.length === 0 && (
                    <Table.Row>
                      <Table.Cell colSpan={6}>
                        <p className="text-center">
                          <em>No results found.</em>
                        </p>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
            </Segment>
          </Segment.Group>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default UserDetails;
