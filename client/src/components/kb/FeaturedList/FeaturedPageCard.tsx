import "./FeaturedList.css";
import { lazy, useState } from "react";
import { KBFeaturedPage } from "../../../types";
import { Card } from "@libretexts/davis-react";
import { IconTrash } from "@tabler/icons-react";
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
    <div className="relative mr-6 mb-5">
      {/* Card renders as <a>, so delete button must live OUTSIDE it in the DOM */}
      <Card
        href={`/insight/${page.page.slug}`}
        className="block w-72 text-center border-2 border-transparent"
        padding="sm"
      >
        <Card.Body className="flex flex-col items-center px-2 py-4">
          <p className="text-lg font-semibold line-clamp-2">{page.page.title}</p>
          <p className="text-sm my-1 line-clamp-3">{page.page.description}</p>
        </Card.Body>
      </Card>
      {canDelete && (
        <button
          type="button"
          aria-label={`Delete ${page.page.title}`}
          className="absolute top-2 right-2 z-10 bg-white/80 text-gray-500 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded cursor-pointer min-w-6 min-h-6 flex items-center justify-center"
          onClick={() => setShowDeleteModal(true)}
        >
          <IconTrash size={16} aria-hidden="true" />
        </button>
      )}
      <ConfirmDeleteFeaturedModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        type="page"
        id={page.uuid}
        onDeleted={handleDeleted}
      />
    </div>
  );
};

export default FeaturedPageCard;
