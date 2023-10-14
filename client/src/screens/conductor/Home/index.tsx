import "./Home.css";

import {
  Grid,
  Header,
  Segment,
  Message,
  Icon,
  Button,
  Loader,
  Card,
  Popup,
} from "semantic-ui-react";
import { useEffect, useState, useCallback, lazy } from "react";
import { useTypedSelector } from "../../../state/hooks";
import axios from "axios";
import { useLocation } from "react-router-dom";
import queryString from "query-string";
import DOMPurify from "dompurify";
import { Announcement, Project } from "../../../types";

import ProjectCard from "../../../components/projects/ProjectCard";
import useGlobalError from "../../../components/error/ErrorHooks";
import { pinProject } from "../../../utils/projectHelpers";
import Annnouncement from "../../../components/Home/Announcement";
import UserMenu from "../../../components/Home/UserMenu";
const NewMemberModal = lazy(
  () => import("../../../components/Home/NewMemberModal")
);
const PinProjectsModal = lazy(
  () => import("../../../components/Home/PinProjectsModal")
);
const ViewAnnouncementModal = lazy(
  () => import("../../../components/Home/ViewAnnouncementModal")
);
const NewAnnouncementModal = lazy(
  () => import("../../../components/Home/NewAnnouncementModal")
);

const Home = () => {
  const { handleGlobalError } = useGlobalError();
  const location = useLocation();
  const user = useTypedSelector((state) => state.user);

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
  const [showNewAnnounceModal, setShowNewAnnounceModal] =
    useState<boolean>(false);

  // Announcement View Modal
  const [showViewAnnounceModal, setShowViewAnnounceModal] =
    useState<boolean>(false);
  const [viewAnnounce, setViewAnnounce] = useState<Announcement>();

  // New Member Modal
  const [showNMModal, setShowNMModal] = useState<boolean>(false);

  // Edit Pinned Projects Modal
  const [showPinnedModal, setShowPinnedModal] = useState<boolean>(false);

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
  const getSystemAnnouncement = useCallback(async () => {
    try {
      const res = await axios.get("/announcements/system");
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (res.data.sysAnnouncement !== null) {
        setShowSystemAnnouncement(true);
        setSystemAnnouncementData(res.data.sysAnnouncement);
      }
    } catch (err) {
      console.error(err); // fail silently
    }
  }, [setShowSystemAnnouncement, setSystemAnnouncementData]);

  /**
   * Loads the 5 most recent announcements via GET
   * request and updates the UI accordingly.
   */
  const getAnnouncements = useCallback(async () => {
    try {
      const res = await axios.get("/announcements/all");
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (res.data.announcements && Array.isArray(res.data.announcements)) {
        let announcementsForState: Announcement[] = [];
        announcementsForState = res.data.announcements;
        // announcementsForState.sort((a, b) => {
        //     const date1 = new Date(a.createdAt);
        //     const date2 = new Date(b.createdAt);
        //     return date2 - date1;
        // });
        setAnnouncements(announcementsForState);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoadedAllAnnouncements(true);
    }
  }, [setAnnouncements, setLoadedAllAnnouncements, handleGlobalError]);

  /**
   * Load the user's recent projects and update the UI accordingly.
   */
  const getRecentProjects = useCallback(async () => {
    try {
      const res = await axios.get("/projects/recent");
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (res.data.projects && Array.isArray(res.data.projects)) {
        setRecentProjects(res.data.projects);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoadedAllRecents(true);
    }
  }, [setRecentProjects, setLoadedAllRecents, handleGlobalError]);

  /**
   * Load the users's pinned projects and update the UI accordingly.
   */
  const getPinnedProjects = useCallback(async () => {
    try {
      setLoadedAllPinned(false);
      const res = await axios.get("/projects/pinned");
      if (res.data?.err) {
        throw new Error(res.data.errMsg);
      }
      if (Array.isArray(res.data.projects)) {
        setPinnedProjects(res.data.projects);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoadedAllPinned(true);
    }
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
   * Open the Announcement View modal
   * and bring the request announcement
   * into state.
   */
  const openViewAnnounceModal = (idx: number) => {
    if (announcements[idx] !== undefined) {
      setViewAnnounce(announcements[idx]);
      setShowViewAnnounceModal(true);
    }
  };

  /**
   * Close the Announcement View modal
   * and reset state to the empty announcement.
   */
  const closeViewAnnounceModal = () => {
    setShowViewAnnounceModal(false);
    setViewAnnounce(undefined);
  };

  async function handlePinProject(projectID: string) {
    if (!projectID) return;
    setLoadedAllPinned(true);
    const success = await pinProject(projectID);
    if (!success) {
      handleGlobalError("Failed to pin project.");
    }
    getPinnedProjects();
    setLoadedAllPinned(false);
  }

  return (
    <Grid className="component-container" divided="vertically" stackable>
      <div className="flex flex-col my-4 w-full">
        <Header className="component-header">Home</Header>
        <div className="border border-b-gray-300 w-full"></div>
      </div>
      {showSystemAnnouncement && (
        <div className="flex w-full mb-4">
          <Message icon info>
            <Icon name="info circle" />
            <Message.Content>
              <Message.Header>{systemAnnouncementData.title}</Message.Header>
              <p>{systemAnnouncementData.message}</p>
            </Message.Content>
          </Message>
        </div>
      )}
      <div className="flex flex-col xl:flex-row">
        <div className="flex flex-col mb-8 xl:w-1/6 xl:mr-12 xl:mb-0">
          <UserMenu />
        </div>
        <div className="flex flex-col mb-8 xl:w-1/2 xl:mr-12 xl:mb-0">
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
                      onClick={() => setShowPinnedModal(true)}
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
                      onPin={(pid) => handlePinProject(pid)}
                    />
                  ))}
                {recentProjects.length === 0 && (
                  <p>You don't have any projects right now.</p>
                )}
              </Card.Group>
            </Segment>
          </Segment>
        </div>
        <div className="flex flex-col mb-8 xl:w-1/3 xl:mb-0">
          <Segment padded>
            <div className="dividing-header-custom">
              <h3>
                Announcements
              </h3>
              {(user.isCampusAdmin === true || user.isSuperAdmin === true) && (
                <div className="right-flex">
                  <Popup
                    content="New Announcement"
                    trigger={
                      <Button
                        color="green"
                        onClick={() => setShowNewAnnounceModal(true)}
                        icon
                        circular
                      >
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
                  <Annnouncement
                    announcement={item}
                    index={index}
                    key={index}
                    onClick={(idx) => openViewAnnounceModal(idx)}
                  />
                );
              })}
              {loadedAllAnnouncements && announcements.length === 0 && (
                <p className="text-center mt-4p">No recent announcements.</p>
              )}
            </div>
          </Segment>
        </div>
      </div>
      {/* New Announcement Modal */}
      <NewAnnouncementModal
        show={showNewAnnounceModal}
        onClose={() => setShowNewAnnounceModal(false)}
        onDataChange={() => getAnnouncements()}
      />
      {/* Announcement View Modal */}
      <ViewAnnouncementModal
        show={showViewAnnounceModal}
        announcement={viewAnnounce}
        onClose={() => closeViewAnnounceModal()}
      />
      {/* New Member Modal */}
      <NewMemberModal
        show={showNMModal}
        onClose={() => setShowNMModal(false)}
      />
      {/* Edit Pinned Projects Modal */}
      <PinProjectsModal
        show={showPinnedModal}
        pinnedProjects={pinnedProjects}
        onDataChange={() => getPinnedProjects()}
        onClose={() => setShowPinnedModal(false)}
      />
    </Grid>
  );
};

export default Home;
