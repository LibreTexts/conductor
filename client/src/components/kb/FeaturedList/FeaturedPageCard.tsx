import "./FeaturedList.css";
import { lazy, useState } from "react";
import { KBFeaturedPage } from "../../../types";
import { Card } from "@libretexts/davis-react";
import { IconTrash } from "@tabler/icons-react";
import { truncateString } from "../../util/HelperFunctions";
const ConfirmDeleteFeaturedModal = lazy(() => import("./ConfirmDeleteFeaturedModal"));

const FeaturedPageCard = ({
  page,
  onDeleted,
  canDelete,
}: {
  page: KBFeaturedPage;
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
      onClick={() => window.location.assign(`/insight/${page.page.slug}`)}
      className="w-72 h-40 mr-6 mb-5 text-center overflow-hidden"
      padding="sm"
    >
      {canDelete && (
        <div
          className="flex flex-row justify-end w-full mb-1"
          onClick={(e) => {
            e.stopPropagation();
            setShowDeleteModal(true);
          }}
        >
          <IconTrash size={16} aria-label="Delete" className="text-gray-500 hover:text-red-600 cursor-pointer" />
        </div>
      )}
      <Card.Body className="flex flex-col items-center px-2">
        <p className="text-lg font-semibold line-clamp-2">{page.page.title}</p>
        <p className="text-sm my-1 line-clamp-3">{page.page.description}</p>
      </Card.Body>
      <ConfirmDeleteFeaturedModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        type="page"
        id={page.uuid}
        onDeleted={handleDeleted}
      />
    </Card>
  );
};

export default FeaturedPageCard;
