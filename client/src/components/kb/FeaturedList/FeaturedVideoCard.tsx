import "./FeaturedList.css";
import { lazy, useState } from "react";
import { KBFeaturedVideo } from "../../../types";
import { Card } from "@libretexts/davis-react";
import { IconTrash, IconVideo } from "@tabler/icons-react";
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
    <div className="relative mr-6 mb-5">
      {/* Card renders as <a>, so delete button must live OUTSIDE it in the DOM */}
      <Card
        href={video.url}
        target="_blank"
        className="block w-80 text-center border-2 border-transparent"
        padding="sm"
      >
        <Card.Body className="flex flex-col items-center gap-3 py-4">
          <IconVideo size={40} className="text-primary" aria-hidden="true" />
          <p className="text-md font-medium px-3">
            {truncateString(video.title, 100)}
          </p>
        </Card.Body>
      </Card>
      {canDelete && (
        <button
          type="button"
          aria-label={`Delete ${video.title}`}
          className="absolute top-2 right-2 z-10 bg-white/80 text-gray-500 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded cursor-pointer min-w-6 min-h-6 flex items-center justify-center"
          onClick={() => setShowDeleteModal(true)}
        >
          <IconTrash size={16} aria-hidden="true" />
        </button>
      )}
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
