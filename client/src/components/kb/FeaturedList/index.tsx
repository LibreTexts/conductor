import { Button, Icon } from "semantic-ui-react";
import { useTypedSelector } from "../../../state/hooks";
import FeaturedPageCard from "./FeaturedPageCard";
import useGlobalError from "../../error/ErrorHooks";
import { useEffect, useState, lazy } from "react";
import axios from "axios";
import { KBFeaturedPage, KBFeaturedVideo } from "../../../types";
import FeaturedVideoCard from "./FeaturedVideoCard";
const AddPageModal = lazy(() => import("./AddPageModal"));
const AddVideoModal = lazy(() => import("./AddVideoModal"));
import "./FeaturedList.css";
import { canEditKB } from "../../../utils/kbHelpers";

const FeaturedList = () => {
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);

  const [loadingContent, setLoadingContent] = useState(false);
  const [featuredPages, setFeaturedPages] = useState<KBFeaturedPage[]>([]);
  const [featuredVideos, setFeaturedVideos] = useState<KBFeaturedVideo[]>([]);
  const [showAddPage, setShowAddPage] = useState(false);
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    loadFeaturedContent();
  }, []);

  useEffect(() => {
    setCanEdit(canEditKB(user));
  }, [user]);

  async function loadFeaturedContent() {
    try {
      setLoadingContent(true);
      const res = await axios.get("/kb/featured");
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.pages || !res.data.videos) {
        throw new Error("No featured content found.");
      }
      if (!Array.isArray(res.data.pages) || !Array.isArray(res.data.videos)) {
        throw new Error("Invalid response from server.");
      }
      setFeaturedPages(res.data.pages);
      setFeaturedVideos(res.data.videos);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoadingContent(false);
    }
  }

  function handleCloseAddPage() {
    setShowAddPage(false);
    loadFeaturedContent();
  }

  function handleCloseAddVideo() {
    setShowAddVideo(false);
    loadFeaturedContent();
  }

  return (
    <div className="flex flex-col p-8" aria-busy={loadingContent}>
      <div className="flex flex-col lg:flex-row justify-between">
        <div className="flex flex-col">
          <p className="text-3xl font-bold">Featured Content</p>
          <p className="text-xl font-semibold">
            Explore featured insight articles and videos curated by the
            LibreTexts team.
          </p>
        </div>
        {canEdit && (
          <div className="mt-2 lg:mt-0">
            <Button
              size="tiny"
              color="blue"
              onClick={() => setShowAddPage(true)}
            >
              <Icon name="plus" />
              Add Featured Article
            </Button>
            <Button
              size="tiny"
              color="blue"
              onClick={() => setShowAddVideo(true)}
            >
              <Icon name="plus" />
              Add Featured Video
            </Button>
          </div>
        )}
      </div>
      <div className="mt-8">
        <p className="text-lg font-semibold">Featured Articles</p>
        <div className="items-list">
          {featuredPages.length > 0 &&
            featuredPages.map((page) => (
              <FeaturedPageCard
                key={page.uuid}
                page={page}
                canDelete={canEdit}
                onDeleted={loadFeaturedContent}
              />
            ))}
          {featuredPages.length === 0 && (
            <p className="text-md text-gray-500 italic">
              No featured articles yet!.
            </p>
          )}
        </div>
      </div>
      <div className="mt-8">
        <p className="text-lg font-semibold">Featured Videos</p>
        <div className="items-list">
          {featuredPages.length > 0 &&
            featuredVideos.map((video) => (
              <FeaturedVideoCard
                key={video.uuid}
                video={video}
                canDelete={canEdit}
                onDeleted={loadFeaturedContent}
              />
            ))}
          {featuredVideos.length === 0 && (
            <p className="text-md text-gray-500 italic">
              No featured videos yet!.
            </p>
          )}
        </div>
      </div>
      <AddPageModal open={showAddPage} onClose={handleCloseAddPage} />
      <AddVideoModal open={showAddVideo} onClose={handleCloseAddVideo} />
    </div>
  );
};

export default FeaturedList;
