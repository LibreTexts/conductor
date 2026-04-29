import { Alert, Card, Timeline, Button, Heading, Stack } from "@libretexts/davis-react";
import { IconPlus } from "@tabler/icons-react";
import { useEffect, useState, useCallback, lazy } from "react";
import { useTypedSelector } from "../../../state/hooks";
import axios from "axios";
import { useLocation } from "react-router-dom";
import queryString from "query-string";
import DOMPurify from "dompurify";
import { Announcement } from "../../../types";

import useGlobalError from "../../../components/error/ErrorHooks";
import Annnouncement from "../../../components/Home/Announcement";
import UserMenu from "../../../components/Home/UserMenu";
import useSystemAnnouncement from "../../../hooks/useSystemAnnouncement";
import PinnedProjects from "../../../components/Home/PinnedProjects/PinnedProjects";
import SystemAnnouncement from "../../../components/util/SystemAnnouncement";
import RecentlyEditedProjects from "../../../components/Home/RecentlyEditedProjects";
import { useDocumentTitle } from "usehooks-ts";
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
  useDocumentTitle("LibreTexts Conductor | Home");
  const { handleGlobalError } = useGlobalError();
  const location = useLocation();
  const user = useTypedSelector((state) => state.user);
  const { sysAnnouncement } = useSystemAnnouncement();

  /* Data */
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  /* UI */
  const [loadedAllAnnouncements, setLoadedAllAnnouncements] =
    useState<boolean>(false);
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
   * Setup page and load recent data.
   */
  useEffect(() => {
    // Hook to force message links to open in new window
    DOMPurify.addHook("afterSanitizeAttributes", function (node) {
      if ("target" in node) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
    getAnnouncements();
  }, [getAnnouncements]);

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

  return (
    <Stack direction="vertical" gap="lg" className="p-6">
      {sysAnnouncement && (
        <SystemAnnouncement
          title={sysAnnouncement.title}
          message={sysAnnouncement.message}
          className="w-full py-4!"
        />
      )}
      <div className="flex flex-col mb-4 w-full">
        <Heading level={1}>Home</Heading>
        <div className="border border-b-gray-300 w-full"></div>
      </div>

      <div className="flex flex-col lg:flex-row w-full gap-12">
        <div className="flex flex-col lg:w-[15%]">
          <UserMenu />
        </div>
        <div className="flex flex-col lg:w-[65%]">
          <Button
            variant="primary"
            fullWidth
            onClick={() => setShowCreateProjectModal(true)}
            icon={<IconPlus size={18} />}
            className="mb-4!"
          >
            Create Conductor Project
          </Button>
          <PinnedProjects />
          <RecentlyEditedProjects />
        </div>
        <div className="flex flex-col lg:w-[20%]">
          <Card>
            <Card.Header>
              <div className="flex items-center justify-between">
                <Heading level={3} className="m-0!">Announcements</Heading>
                {(user.isCampusAdmin === true || user.isSuperAdmin === true) && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowNewAnnounceModal(true)}
                    icon={<IconPlus size={16} />}
                    name="New Announcement"
                    title="New Announcement"
                  />
                )}
              </div>
            </Card.Header>
            <Card.Body>
              {showNASuccess && (
                <Alert
                  variant="success"
                  title="Announcement Successfully Posted!"
                  message=""
                  dismissible
                  className="mb-4"
                  onDismiss={() => setShowNASuccess(false)}
                />
              )}
              {loadedAllAnnouncements && announcements.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No recent announcements.</p>
              ) : (
                <Timeline>
                  {announcements.map((item, index) => (
                    <Annnouncement
                      announcement={item}
                      index={index}
                      key={index}
                      onClick={(idx) => openViewAnnounceModal(idx)}
                    />
                  ))}
                </Timeline>
              )}
            </Card.Body>
          </Card>
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
    </Stack>
  );
};

export default Home;
