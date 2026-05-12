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
    <Card
      href={video.url}
      target="_blank"
      className="w-80 mr-6 mb-5 text-center"
      padding="sm"
    >
      {canDelete && (
        <div
          className="flex flex-row justify-end w-full mb-2"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowDeleteModal(true);
          }}
        >
          <IconTrash
            size={16}
            aria-label="Delete"
            className="text-gray-500 hover:text-red-600 cursor-pointer"
          />
        </div>
      )}
      <Card.Body className="flex flex-col items-center gap-3 py-4">
        <IconVideo size={40} className="text-primary" aria-hidden="true" />
        <p className="text-md font-medium px-3">
          {truncateString(video.title, 100)}
        </p>
      </Card.Body>
      <ConfirmDeleteFeaturedModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        type="video"
        id={video.uuid}
        onDeleted={handleDeleted}
      />
    </Card>
  );
};

export default FeaturedVideoCard;
