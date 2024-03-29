import "./FeaturedList.css";
import { lazy, useState } from "react";
import { KBFeaturedVideo } from "../../../types";
import { Icon } from "semantic-ui-react";
import { truncateString } from "../../util/HelperFunctions";
const ConfirmDeleteFeaturedModal = lazy(
  () => import("./ConfirmDeleteFeaturedModal")
);

const FeaturedVideoCard = ({
  video,
  onDeleted,
  canDelete,
}: {
  video: KBFeaturedVideo;
  onDeleted: () => void;
  canDelete?: boolean;
}) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  function handleDeleted() {
    setShowDeleteModal(false);
    onDeleted();
  }

  return (
    <div className="video-item">
      {canDelete && (
        <div className="flex flex-row justify-end w-full mb-2">
          <Icon
            name="trash"
            size="small"
            onClick={() => setShowDeleteModal(true)}
          />
        </div>
      )}
      <iframe src={video.url} className="max-w-full rounded-md" />
      <p className="text-md font-medium mt-2 px-3">
        {truncateString(video.title, 100)}
      </p>
      <ConfirmDeleteFeaturedModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        type="video"
        id={video.uuid}
        onDeleted={handleDeleted}
      />
    </div>
  );
};

export default FeaturedVideoCard;
