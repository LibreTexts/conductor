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
import Annnouncement from "../../../components/Home/Announcement";
import UserMenu from "../../../components/Home/UserMenu";
import useSystemAnnouncement from "../../../hooks/useSystemAnnouncement";
import PinnedProjects from "../../../components/Home/PinnedProjects/PinnedProjects";
import { useModals } from "../../../context/ModalContext";
import AddPinnedProjectModal from "../../../components/Home/PinnedProjects/AddPinnedProjectModal";
const NewMemberModal = lazy(
  () => import("../../../components/Home/NewMemberModal")
);
const ViewAnnouncementModal = lazy(
  () => import("../../../components/Home/ViewAnnouncementModal")
);
const NewAnnouncementModal = lazy(
  () => import("../../../components/Home/NewAnnouncementModal")
);
const CreateProjectModal = lazy(
  () => import("../../../components/projects/CreateProject")
);

const Home = () => {
  const { handleGlobalError } = useGlobalError();
  const { openModal, closeAllModals } = useModals();
  const location = useLocation();
  const user = useTypedSelector((state) => state.user);
  const { sysAnnouncement } = useSystemAnnouncement();

  /* Data */
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);

  /* UI */
  const [loadedAllAnnouncements, setLoadedAllAnnouncements] =
    useState<boolean>(false);
  const [loadedAllRecents, setLoadedAllRecents] = useState<boolean>(false);
  const [showNASuccess, setShowNASuccess] = useState<boolean>(false);

  // New Announcement Modal
  const [showNewAnnounceModal, setShowNewAnnounceModal] =
    useState<boolean>(false);

  // Announcement View Modal
  const [showViewAnnounceModal, setShowViewAnnounceModal] =
    useState<boolean>(false);
  const [viewAnnounce, setViewAnnounce] = useState<Announcement>();

  // New Member Modal
  const [showNMModal, setShowNMModal] = useState<boolean>(false);

  // Create Project Modal
  const [showCreateProjectModal, setShowCreateProjectModal] =
    useState<boolean>(false);

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
    getRecentProjects();
    getAnnouncements();
  }, [getRecentProjects, getAnnouncements]);

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
    openModal(
      <AddPinnedProjectModal
        projectID={projectID}
        show={true}
        onClose={() => {
          closeAllModals();
          getRecentProjects();
        }}
      />
    );
  }

  return (
    <Grid className="component-container" divided="vertically" stackable>
      <div className="flex flex-col my-4 w-full">
        <Header className="component-header">Home</Header>
        <div className="border border-b-gray-300 w-full"></div>
      </div>
      {sysAnnouncement && (
        <div className="flex w-full mb-4">
          <Message icon info>
            <Icon name="info circle" />
            <Message.Content>
              <Message.Header>{sysAnnouncement.title}</Message.Header>
              <p>{sysAnnouncement.message}</p>
            </Message.Content>
          </Message>
        </div>
      )}
      <div className="flex flex-col xl:flex-row w-full min-h-screen">
        <div className="flex flex-col mb-4 xl:w-1/6 xl:mr-12 xl:mb-0">
          <UserMenu />
        </div>
        <div className="flex flex-col mb-8 xl:w-1/2 xl:mr-12 xl:mb-0 flex-1 max-h-[1000px] min-h-fit">
          <Button
            onClick={() => setShowCreateProjectModal(true)}
            fluid
            color="green"
            content="Create Conductor Project"
            icon="add"
            labelPosition="left"
          />
          <PinnedProjects />
        </div>
        <div className="flex flex-col mb-8 xl:w-1/3 xl:mb-0">
          <Segment padded>
            <div className="dividing-header-custom">
              <h3>Announcements</h3>
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
      {/* Create Project Modal */}
      <CreateProjectModal
        show={showCreateProjectModal}
        onClose={() => setShowCreateProjectModal(false)}
      />
    </Grid>
  );
};

export default Home;
