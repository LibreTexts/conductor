import "./FeaturedList.css";
import { lazy, useState } from "react";
import { KBFeaturedPage } from "../../../types";
import { Icon } from "semantic-ui-react";
const ConfirmDeleteModal = lazy(() => import("./ConfirmDeleteModal"));

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
    <div className="app-item-container">
      {canDelete && (
        <div className="flex flex-row justify-end w-full mb-2">
          <Icon
            name="trash"
            size="small"
            onClick={() => setShowDeleteModal(true)}
          />
        </div>
      )}
      <div className="app-item-text-container">
        <p className="app-item-header">{page.page.title}</p>
        <p className="app-item-descrip">{}</p>
      </div>
      <ConfirmDeleteModal
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
