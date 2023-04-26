import "./Home.css";

import {
  Grid,
  Header,
  Menu,
  Image,
  Segment,
  Message,
  Icon,
  Button,
  Modal,
  Form,
  Loader,
  Card,
  Popup,
  Dropdown,
  List,
  Divider,
  Label,
  HeaderSubheader,
  LabelProps,
} from "semantic-ui-react";
import { Link } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { useTypedSelector } from "../../../state/hooks";
import axios from "axios";
import { useLocation } from "react-router-dom";
import queryString from "query-string";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { format, parse, parseISO } from "date-fns";
import { Announcement, Project, User } from "../../../types";

import ProjectCard from "../../../components/projects/ProjectCard";
import Breakpoint from "../../../components/util/Breakpoints";
import TextArea from "../../../components/TextArea";
import AccountStatus from "../../../components/util/AccountStatus";

import {
  truncateString,
  capitalizeFirstLetter,
  isEmptyString,
} from "../../../components/util/HelperFunctions.js";
import useGlobalError from "../../../components/error/ErrorHooks";

const Home = () => {
  const { handleGlobalError } = useGlobalError();
  const location = useLocation();
  const user = useTypedSelector((state) => state.user);
  const org = useTypedSelector((state) => state.org);

  /* Data */
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [pinnedProjects, setPinnedProjects] = useState<Project[]>([]);

  /* UI */
  const [loadedAllAnnouncements, setLoadedAllAnnouncements] =
    useState<boolean>(false);
  const [loadedAllRecents, setLoadedAllRecents] = useState<boolean>(false);
  const [loadedAllPinned, setLoadedAllPinned] = useState<boolean>(false);
  const [showNASuccess, setShowNASuccess] = useState<boolean>(false);

  // System Announcement Message
  const [showSystemAnnouncement, setShowSystemAnnouncement] =
    useState<boolean>(false);
  const [systemAnnouncementData, setSystemAnnouncementData] =
    useState<Announcement>({} as Announcement);

  // New Announcement Modal
  const [showNAModal, setShowNAModal] = useState<boolean>(false);
  const [naTitle, setNATitle] = useState<string>("");
  const [naMessage, setNAMessage] = useState<string>("");
  const [naGlobal, setNAGlobal] = useState<boolean>(false);
  const [naTitleError, setNATitleError] = useState<boolean>(false);
  const [naMessageError, setNAMessageError] = useState<boolean>(false);

  // Announcement View Modal
  const [showAVModal, setShowAVModal] = useState<boolean>(false);
  const [avAnnouncement, setAVAnnouncement] = useState<Announcement>();
  const [avModalLoading, setAVModalLoading] = useState<boolean>(false);

  // New Member Modal
  const [showNMModal, setShowNMModal] = useState<boolean>(false);

  // Edit Pinned Projects Modal
  const [showPinnedModal, setShowPinnedModal] = useState<boolean>(false);
  const [pinProjectsOptions, setPinProjectsOptions] = useState([]);
  const [pinProjectToPin, setPinProjectToPin] = useState<string>("");
  const [pinProjectsLoading, setPinProjectsLoading] = useState<boolean>(false);
  const [pinModalLoading, setPinModalLoading] = useState<boolean>(false);

  /**
   * Check for query string values and update UI if necessary.
   */
  useEffect(() => {
    const queryValues = queryString.parse(location.search);
    if (queryValues.newmember === "true") {
      setShowNMModal(true);
    }
  }, [location.search, setShowNMModal]);

  /**
   * Checks if a System Announcement is available and updates the UI accordingly if so.
   */
  const getSystemAnnouncement = useCallback(() => {
    axios
      .get("/announcements/system")
      .then((res) => {
        if (!res.data.err) {
          if (res.data.sysAnnouncement !== null) {
            setShowSystemAnnouncement(true);
            setSystemAnnouncementData(res.data.sysAnnouncement);
          }
        } else {
          console.error(res.data.errMsg); // fail silently
        }
      })
      .catch((err) => {
        console.error(err); // fail silently
      });
  }, [setShowSystemAnnouncement, setSystemAnnouncementData]);

  /**
   * Loads the 5 most recent announcements via GET
   * request and updates the UI accordingly.
   */
  const getAnnouncements = useCallback(() => {
    axios
      .get("/announcements/all")
      .then((res) => {
        if (!res.data.err) {
          if (res.data.announcements && Array.isArray(res.data.announcements)) {
            var announcementsForState: Announcement[] = [];
            announcementsForState = res.data.announcements;
            // announcementsForState.sort((a, b) => {
            //     const date1 = new Date(a.createdAt);
            //     const date2 = new Date(b.createdAt);
            //     return date2 - date1;
            // });
            setAnnouncements(announcementsForState);
          }
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setLoadedAllAnnouncements(true);
      })
      .catch((err) => {
        handleGlobalError(err);
        setLoadedAllAnnouncements(true);
      });
  }, [setAnnouncements, setLoadedAllAnnouncements, handleGlobalError]);

  /**
   * Load the user's recent projects and update the UI accordingly.
   */
  const getRecentProjects = useCallback(() => {
    axios
      .get("/projects/recent")
      .then((res) => {
        if (!res.data.err) {
          if (res.data.projects && Array.isArray(res.data.projects)) {
            setRecentProjects(res.data.projects);
          }
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setLoadedAllRecents(true);
      })
      .catch((err) => {
        handleGlobalError(err);
        setLoadedAllRecents(true);
      });
  }, [setRecentProjects, setLoadedAllRecents, handleGlobalError]);

  /**
   * Load the users's pinned projects and update the UI accordingly.
   */
  const getPinnedProjects = useCallback(() => {
    setLoadedAllPinned(false);
    axios
      .get("/projects/pinned")
      .then((res) => {
        if (!res.data?.err) {
          if (Array.isArray(res.data.projects)) {
            setPinnedProjects(res.data.projects);
          }
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setLoadedAllPinned(true);
      })
      .catch((err) => {
        handleGlobalError(err);
        setLoadedAllPinned(true);
      });
  }, [setPinnedProjects, setLoadedAllPinned, handleGlobalError]);

  /**
   * Setup page & title on load and
   * load recent data.
   */
  useEffect(() => {
    document.title = "LibreTexts Conductor | Home";
    // Hook to force message links to open in new window
    DOMPurify.addHook("afterSanitizeAttributes", function (node) {
      if ("target" in node) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
    getPinnedProjects();
    getRecentProjects();
    getSystemAnnouncement();
    getAnnouncements();
  }, [
    getPinnedProjects,
    getRecentProjects,
    getSystemAnnouncement,
    getAnnouncements,
  ]);

  /**
   * Open the New Announcement modal and ensure
   * all form fields are reset to their defaults.
   */
  const openNAModal = () => {
    resetNAForm();
    setNATitle("");
    setNAMessage("");
    setNAGlobal(false);
    setShowNAModal(true);
  };

  /**
   * Close the New Announcement modal and
   * reset the form.
   */
  const closeNAModal = () => {
    setShowNAModal(false);
    resetNAForm();
    setNATitle("");
    setNAMessage("");
    setNAGlobal(false);
  };

  /**
   * Reset all New Announcement form
   * error states
   */
  const resetNAForm = () => {
    setNATitleError(false);
    setNAMessageError(false);
  };

  /**
   * Validate the New Announcement form data,
   * return 'false' if validation errors
   * exists, 'true' otherwise
   */
  const validateNAForm = () => {
    var validForm = true;
    if (isEmptyString(naTitle)) {
      validForm = false;
      setNATitleError(true);
    }
    if (isEmptyString(naMessage)) {
      validForm = false;
      setNAMessageError(true);
    }
    return validForm;
  };

  /**
   * Submit data via POST to the server, then
   * call closeNAModal() on success
   * and reload announcements.
   */
  const postNewAnnouncement = () => {
    resetNAForm();
    if (validateNAForm()) {
      axios
        .post("/announcement", {
          title: naTitle,
          message: naMessage,
          global: naGlobal,
        })
        .then((res) => {
          if (!res.data.err) {
            setShowNASuccess(true);
            closeNAModal();
            getAnnouncements();
          } else {
            throw res.data.errMsg;
          }
        })
        .catch((err) => {
          handleGlobalError(err);
        });
    }
  };

  /**
   * Open the Announcement View modal
   * and bring the request announcement
   * into state.
   */
  const openAVModal = (idx: number) => {
    if (announcements[idx] !== undefined) {
      setAVAnnouncement(announcements[idx]);
      setAVModalLoading(false);
      setShowAVModal(true);
    }
  };

  /**
   * Close the Announcement View modal
   * and reset state to the empty announcement.
   */
  const closeAVModal = () => {
    setShowAVModal(false);
    setAVAnnouncement(undefined);
    setAVModalLoading(false);
  };

  /**
   * Loads the user's projects from the server, then filters already-pinned projects before
   * saving the list to state.
   */
  const getPinnableProjects = useCallback(() => {
    setPinProjectsLoading(true);
    axios
      .get("/projects/all")
      .then((res) => {
        if (!res.data.err) {
          if (Array.isArray(res.data.projects)) {
            const pinnedFiltered = res.data.projects
              .filter((item: Project) => {
                const foundMatch = pinnedProjects.find((pinned) => {
                  return pinned.projectID === item.projectID;
                });
                if (foundMatch) {
                  return false;
                }
                return true;
              })
              .sort((a: Project, b: Project) => {
                let normalA = String(a.title)
                  .toLowerCase()
                  .replace(/[^A-Za-z]+/g, "");
                let normalB = String(b.title)
                  .toLowerCase()
                  .replace(/[^A-Za-z]+/g, "");
                if (normalA < normalB) return -1;
                if (normalA > normalB) return 1;
                return 0;
              })
              .map((item: Project) => {
                return {
                  key: item.projectID,
                  value: item.projectID,
                  text: item.title,
                };
              });
            setPinProjectsOptions(pinnedFiltered);
          }
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setPinProjectsLoading(false);
      })
      .catch((err) => {
        handleGlobalError(err);
        setPinProjectsLoading(false);
      });
  }, [
    pinnedProjects,
    setPinProjectsLoading,
    setPinProjectsOptions,
    handleGlobalError,
  ]);

  /**
   * Updates the list of pinnable projects when the Edit Pinned Projects Modal is opened,
   * or when there is a change in the list of pinned projects.
   */
  useEffect(() => {
    if (showPinnedModal) {
      getPinnableProjects();
    }
  }, [pinnedProjects, getPinnableProjects, showPinnedModal]);

  /**
   * Opens the Edit Pinned Projects modal.
   */
  const openPinnedModal = () => {
    setShowPinnedModal(true);
  };

  /**
   * Closes the Edit Pinned Projects modal.
   */
  const closePinnedModal = () => {
    setShowPinnedModal(false);
    setPinProjectsOptions([]);
    setPinProjectsLoading(false);
    setPinModalLoading(false);
  };

  /**
   * Submits a request to the server to pin a project. Refreshes the
   * Pinned & Recent projects lists on success.
   *
   * @param {string} projectID - Identifier of the project to pin.
   * @returns {Promise<boolean>} True if successfully pinned, false otherwise.
   */
  async function pinProject(projectID: string) {
    if (!projectID || isEmptyString(projectID)) {
      return false;
    }
    try {
      const pinRes = await axios.put("/project/pin", {
        projectID,
      });
      if (!pinRes.data.err) {
        getPinnedProjects();
        getRecentProjects();
        return true;
      } else {
        throw new Error(pinRes.data.errMsg);
      }
    } catch (e) {
      handleGlobalError(e);
    }
    return false;
  }

  /**
   * Wraps the project pinning function for use in the Edit Pinned Projects modal. Project
   * selection in the modal is reset if the operation was successful.
   *
   * @see {@link pinProject}
   */
  async function pinProjectInModal() {
    if (isEmptyString(pinProjectToPin)) {
      return;
    }
    setPinModalLoading(true);
    const didPin = await pinProject(pinProjectToPin);
    if (didPin) {
      setPinProjectToPin("");
      setPinProjectsOptions([]);
    }
    setPinModalLoading(false);
  }

  /**
   * Submits a request to the server to unpin a project, then refreshes the pinned list.
   * For use inside the Edit Pinned Projects modal.
   *
   * @param {string} projectID - The identifier of the project to unpin.
   */
  const unpinProject = (projectID: string) => {
    if (isEmptyString(projectID)) {
      return;
    }
    setPinModalLoading(true);
    axios
      .delete("/project/pin", {
        data: {
          projectID,
        },
      })
      .then((res) => {
        if (!res.data.err) {
          getPinnedProjects();
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setPinModalLoading(false);
      })
      .catch((err) => {
        handleGlobalError(err);
        setPinModalLoading(false);
      });
  };

  /**
   * Submit a DELETE request to the server to delete the announcement
   * currently open in the Announcement View Modal, then close
   * the modal and reload announcements on success.
   */
  const deleteAnnouncement = () => {
    if (avAnnouncement && avAnnouncement._id && avAnnouncement._id !== "") {
      setAVModalLoading(true);
      axios
        .delete("/announcement", {
          data: {
            announcementID: avAnnouncement._id,
          },
        })
        .then((res) => {
          if (!res.data.err) {
            closeAVModal();
            getAnnouncements();
          } else {
            handleGlobalError(res.data.errMsg);
            setAVModalLoading(false);
          }
        })
        .catch((err) => {
          handleGlobalError(err);
          setAVModalLoading(false);
        });
    }
  };

  return (
    <Grid className="component-container" divided="vertically" stackable>
      <Grid.Row>
        <Grid.Column>
          <Header className="component-header">Home</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        {showSystemAnnouncement && (
          <Grid.Column width={16}>
            <Message icon info>
              <Icon name="info circle" />
              <Message.Content>
                <Message.Header>{systemAnnouncementData.title}</Message.Header>
                <p>{systemAnnouncementData.message}</p>
              </Message.Content>
            </Message>
          </Grid.Column>
        )}
        <Grid.Column width={3}>
          <Breakpoint name="tabletOrDesktop">
            <Menu vertical fluid>
              <Menu.Item>
                <Header as="h1">
                  <Image
                    circular
                    src={`${user.avatar}`}
                    className="menu-avatar"
                  />
                  <br />
                  Welcome,
                  <br />
                  {user.firstName}
                </Header>
                <div className="d-flex">
                  <AccountStatus verifiedInstructor={user.verifiedInstructor} />
                </div>
              </Menu.Item>
              {(user.isSuperAdmin || user.isCampusAdmin) && (
                <Menu.Item as={Link} to="/controlpanel">
                  Control Panel
                  <Icon name="dashboard" />
                </Menu.Item>
              )}
              <Menu.Item as={Link} to="/alerts">
                <Icon name="alarm" />
                My Alerts
              </Menu.Item>
              <Menu.Item
                href="https://commons.libretexts.org/harvestrequest"
                target="_blank"
                rel="noopener noreferrer"
              >
                Harvesting Request
                <Icon name="plus" />
              </Menu.Item>
              <Menu.Item
                href="https://commons.libretexts.org/adopt"
                target="_blank"
                rel="noopener noreferrer"
              >
                Adoption Report
                <Icon name="clipboard check" />
              </Menu.Item>
              <Menu.Item
                href="https://commons.libretexts.org/accountrequest"
                target="_blank"
                rel="noopener noreferrer"
              >
                Account Request
                <Icon name="share alternate" />
              </Menu.Item>
              <Menu.Item
                href="https://libretexts.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                LibreTexts.org
                <Icon name="external" />
              </Menu.Item>
            </Menu>
          </Breakpoint>
          <Breakpoint name="mobile">
            <Segment>
              <div className="flex-row-div home-mobile-welcome">
                <Image
                  circular
                  src={`${user.avatar}`}
                  className="menu-avatar"
                />
                <Header as="h1">Welcome, {user.firstName}</Header>
                <HeaderSubheader>Verified Instructor</HeaderSubheader>
                <div className="right-flex">
                  <Dropdown
                    as={Button}
                    className="icon"
                    icon="align justify"
                    labeled
                    labelPosition="right"
                    text="Quick Links"
                    direction="left"
                    upward={false}
                    color="blue"
                  >
                    <Dropdown.Menu>
                      {((user.hasOwnProperty("isSuperAdmin") &&
                        user.isSuperAdmin === true) ||
                        (user.hasOwnProperty("isCampusAdmin") &&
                          user.isCampusAdmin === true)) && (
                        <Dropdown.Item as={Link} to="/controlpanel">
                          <Icon name="dashboard" />
                          Control Panel
                        </Dropdown.Item>
                      )}
                      <Dropdown.Item as={Link} to="/">
                        <Icon name="handshake" />
                        Commons
                      </Dropdown.Item>
                      <Dropdown.Item as={Link} to="/alerts">
                        <Icon name="alarm" />
                        My Alerts
                      </Dropdown.Item>
                      <Dropdown.Item
                        href="https://commons.libretexts.org/harvestrequest"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon name="plus" />
                        Harvesting Request
                      </Dropdown.Item>
                      <Dropdown.Item
                        href="https://commons.libretexts.org/adopt"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon name="clipboard check" />
                        Adoption Report
                      </Dropdown.Item>
                      <Dropdown.Item
                        href="https://commons.libretexts.org/accountrequest"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon name="share alternate" />
                        Account Request
                      </Dropdown.Item>
                      <Dropdown.Item
                        href="https://libretexts.org"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon name="external" />
                        LibreTexts.org
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                </div>
              </div>
            </Segment>
          </Breakpoint>
        </Grid.Column>
        <Grid.Column width={8}>
          <Segment
            padded={pinnedProjects.length > 0}
            loading={!loadedAllPinned}
          >
            <div
              className={
                pinnedProjects.length > 0
                  ? "dividing-header-custom"
                  : "header-custom"
              }
            >
              <h3>
                <Icon name="pin" />
                Pinned Projects
              </h3>
              <div className="right-flex">
                <Popup
                  content={<span>Edit Pinned Projects</span>}
                  trigger={
                    <Button
                      color="blue"
                      onClick={openPinnedModal}
                      icon
                      circular
                      size="tiny"
                    >
                      <Icon name="pencil" />
                    </Button>
                  }
                  position="top center"
                />
              </div>
            </div>
            {pinnedProjects.length > 0 && (
              <Segment basic loading={!loadedAllPinned}>
                <Card.Group itemsPerRow={2}>
                  {pinnedProjects.map((item) => (
                    <ProjectCard project={item} key={item.projectID} />
                  ))}
                </Card.Group>
              </Segment>
            )}
          </Segment>
          <Segment padded>
            <div className="dividing-header-custom">
              <h3>
                <Icon name="clock outline" />
                Recently Edited Projects
              </h3>
              <div className="right-flex">
                <Popup
                  content={
                    <span>
                      To see all of your projects, visit{" "}
                      <strong>Projects</strong> in the Navbar.
                    </span>
                  }
                  trigger={<Icon name="info circle" />}
                  position="top center"
                />
              </div>
            </div>
            <Segment basic loading={!loadedAllRecents}>
              <Card.Group itemsPerRow={2}>
                {recentProjects.length > 0 &&
                  recentProjects.map((item) => (
                    <ProjectCard
                      project={item}
                      key={item.projectID}
                      showPinButton={true}
                      onPin={pinProject}
                    />
                  ))}
                {recentProjects.length === 0 && (
                  <p>You don't have any projects right now.</p>
                )}
              </Card.Group>
            </Segment>
          </Segment>
        </Grid.Column>
        <Grid.Column width={5}>
          <Segment padded>
            <div className="dividing-header-custom">
              <h3>
                Announcements <span className="gray-span">(most recent)</span>
              </h3>
              {(user.isCampusAdmin === true || user.isSuperAdmin === true) && (
                <div className="right-flex">
                  <Popup
                    content="New Announcement"
                    trigger={
                      <Button color="green" onClick={openNAModal} icon circular>
                        <Icon name="add" />
                      </Button>
                    }
                    position="top center"
                  />
                </div>
              )}
            </div>
            {showNASuccess && (
              <Message
                onDismiss={() => setShowNASuccess(false)}
                header="Announcement Successfully Posted!"
                icon="check circle outline"
                positive
              />
            )}
            <div className="announcements-list">
              <Loader
                active={!loadedAllAnnouncements}
                inline="centered"
                className="mt-4p"
              />
              {announcements.map((item, index) => {
                return (
                  <div
                    className="flex-col-div announcement"
                    key={index}
                    onClick={() => openAVModal(index)}
                  >
                    <div className="flex-row-div">
                      <div className="announcement-avatar-container">
                        <Image src={item.author.avatar} size="mini" avatar />
                      </div>
                      <div className="flex-col-div announcement-meta-container">
                        <span className="announcement-meta-title">
                          {item.title}
                        </span>
                        <span className="muted-text announcement-meta-date">
                          <em>
                            {item.author.firstName} {item.author.lastName}
                          </em>{" "}
                          &bull; {format(parseISO(item.createdAt), "MM/dd/yy")}{" "}
                          at {format(parseISO(item.createdAt), "h:mm aa")}
                        </span>
                      </div>
                    </div>
                    <p
                      className="announcement-text"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(
                          marked(truncateString(item.message, 200))
                        ),
                      }}
                    ></p>
                  </div>
                );
              })}
              {loadedAllAnnouncements && announcements.length === 0 && (
                <p className="text-center mt-4p">No recent announcements.</p>
              )}
            </div>
          </Segment>
        </Grid.Column>
      </Grid.Row>
      {/* New Announcement Modal */}
      <Modal
        onClose={closeNAModal}
        open={showNAModal}
        closeOnDimmerClick={false}
      >
        <Modal.Header>New Announcement</Modal.Header>
        <Modal.Content scrolling>
          <Form noValidate>
            <Form.Field required error={naTitleError}>
              <label>Title</label>
              <Form.Input
                type="text"
                placeholder="Enter title..."
                onChange={(e) => setNATitle(e.target.value)}
                value={naTitle}
              />
            </Form.Field>
            <Form.Field required error={naMessageError}>
              <label>Message</label>
              <TextArea
                placeholder="Enter announcement text..."
                textValue={naMessage}
                onTextChange={(value) => setNAMessage(value)}
                contentType="announcement"
              />
            </Form.Field>
            {user.hasOwnProperty("isSuperAdmin") &&
              user.isSuperAdmin === true && (
                <div className="mb-2p">
                  <p>
                    <strong>
                      <em>Super Administrator Options</em>
                    </strong>{" "}
                    <span className="muted-text">(use caution)</span>
                  </p>
                  <Form.Field>
                    <Form.Checkbox
                      onChange={() => setNAGlobal(!naGlobal)}
                      checked={naGlobal}
                      label="Send globally"
                    />
                  </Form.Field>
                </div>
              )}
          </Form>
          <span>
            <em>
              This announcement will be available to
              {naGlobal
                ? " all Conductor users (global)."
                : ` all members of ${org.shortName}.`}
            </em>
          </span>
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={closeNAModal}>Cancel</Button>
          <Button
            color="green"
            onClick={postNewAnnouncement}
            icon
            labelPosition="right"
          >
            Post Announcement
            <Icon name="announcement" />
          </Button>
        </Modal.Actions>
      </Modal>
      {/* Announcement View Modal */}
      <Modal onClose={closeAVModal} open={showAVModal}>
        <Modal.Header>{avAnnouncement?.title ?? ""}</Modal.Header>
        {avAnnouncement && (
          <>
            <Modal.Content>
              <Header as="h4">
                <Image
                  avatar
                  src={`${avAnnouncement.author?.avatar || "/mini_logo.png"}`}
                />
                <Header.Content>
                  {avAnnouncement?.author?.firstName ?? ""}{" "}
                  {avAnnouncement.author?.lastName}
                  <Header.Subheader>
                    {format(parseISO(avAnnouncement.createdAt), 'MM/dd/yy')} at {format(parseISO(avAnnouncement.createdAt), 'h:mm aa')}
                  </Header.Subheader>
                </Header.Content>
              </Header>
              <Modal.Description className="announcement-view-text">
                {avAnnouncement.message && (
                  <p
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        marked(avAnnouncement.message, { breaks: true })
                      ),
                    }}
                  ></p>
                )}
              </Modal.Description>
              <span className="gray-span">
                Sent to:{" "}
                {capitalizeFirstLetter(
                  avAnnouncement.org?.shortName || "Unknown"
                )}
              </span>
            </Modal.Content>
            <Modal.Actions>
              {(avAnnouncement.author?.uuid === user.uuid ||
                user.isSuperAdmin) && (
                <Button
                  color="red"
                  loading={avModalLoading}
                  onClick={deleteAnnouncement}
                >
                  <Icon name="trash" />
                  Delete
                </Button>
              )}
              <Button
                color="blue"
                loading={avModalLoading}
                onClick={closeAVModal}
              >
                Done
              </Button>
            </Modal.Actions>
          </>
        )}
      </Modal>
      {/* New Member Modal */}
      <Modal open={showNMModal} closeOnDimmerClick={false}>
        <Modal.Header>Welcome to Conductor</Modal.Header>
        <Modal.Content>
          <p>
            Welcome to Conductor! You've been added as a new member of{" "}
            <strong>{org.name}</strong>.
          </p>
          <p>
            <em>
              If you need elevated privileges, please contact the member of your
              organization responsible for communicating with LibreTexts.
            </em>
          </p>
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={() => setShowNMModal(false)} color="blue">
            Done
          </Button>
        </Modal.Actions>
      </Modal>
      {/* Edit Pinned Projects Modal */}
      <Modal
        open={showPinnedModal}
        onClose={closePinnedModal}
        size="fullscreen"
      >
        <Modal.Header>Edit Pinned Projects</Modal.Header>
        <Modal.Content scrolling id="edit-pinned-projects-content">
          <Form noValidate>
            <Form.Select
              search
              label="Select from your Projects"
              placeholder="Choose or start typing to search..."
              options={pinProjectsOptions}
              onChange={(_e, { value }) => setPinProjectToPin(value as string)}
              value={pinProjectToPin}
              loading={pinProjectsLoading}
              disabled={pinProjectsLoading}
            />
            <Button
              fluid
              disabled={isEmptyString(pinProjectToPin)}
              color="blue"
              loading={pinModalLoading}
              onClick={pinProjectInModal}
            >
              <Icon name="pin" />
              Pin Project
            </Button>
          </Form>
          <Divider />
          {pinModalLoading || !loadedAllPinned ? (
            <Loader active inline="centered" />
          ) : pinnedProjects.length > 0 ? (
            <List divided verticalAlign="middle" className="mb-2p">
              {pinnedProjects.map((item) => {
                return (
                  <List.Item key={item.projectID}>
                    <div className="flex-row-div">
                      <div className="left-flex">
                        <Link
                          to={`/projects/${item.projectID}`}
                          target="_blank"
                        >
                          {item.title}
                        </Link>
                        <Icon name="external" className="ml-1p" />
                      </div>
                      <div className="right-flex">
                        <Button onClick={() => unpinProject(item.projectID)}>
                          <Icon.Group className="icon">
                            <Icon name="pin" />
                            <Icon corner name="x" />
                          </Icon.Group>
                          Unpin
                        </Button>
                      </div>
                    </div>
                  </List.Item>
                );
              })}
            </List>
          ) : (
            <p className="text-center muted-text">No pinned projects yet.</p>
          )}
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={closePinnedModal} color="blue">
            Done
          </Button>
        </Modal.Actions>
      </Modal>
    </Grid>
  );
};

export default Home;
