import "./FeaturedList.css";
import { lazy, useState } from "react";
import { KBFeaturedPage } from "../../../types";
import { Icon } from "semantic-ui-react";
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

  function handleClicked() {
    window.location.assign(`/insight/${page.page.slug}`);
  }

  return (
    <div className="featured-article-card" onClick={handleClicked}>
      {canDelete && (
        <div
          className="flex flex-row justify-end w-full mb-1"
          onClick={(e) => {
            e.stopPropagation();
            setShowDeleteModal(true);
          }}
        >
          <Icon name="trash" size="small" />
        </div>
      )}
      <div className="flex flex-col px-4">
        <p className="text-lg font-semibold flex-wrap">
          {truncateString(page.page.title, 50)}
        </p>
        <p className="text-sm flex-wrap my-1">{truncateString(page.page.description, 100)}</p>
      </div>
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
