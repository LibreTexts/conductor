import { useState, FC, ReactElement } from "react";
import { Modal, Button, Icon } from "semantic-ui-react";
import axios from "axios";
import useGlobalError from "../../error/ErrorHooks.js";
import { Collection } from "../../../types";

type DeleteCollectionProps = {
  show: boolean;
  onCloseFunc: () => void;
  onDeleteSuccess: () => void;
  collectionToDelete?: Collection;
};
const DeleteCollection: FC<DeleteCollectionProps> = ({
  show,
  onCloseFunc,
  onDeleteSuccess,
  collectionToDelete,
}): ReactElement => {
  // Global Error Handling
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState<boolean>(false);

  const handleDeleteCollection = () => {
    if (!collectionToDelete) return;
    setLoading(true);
    axios
      .delete(`/commons/collection/${collectionToDelete.collID}`)
      .then((res) => {
        if (!res.data.err) {
          onDeleteSuccess();
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setLoading(false);
      })
      .catch((err) => {
        handleGlobalError(err);
      });
  };

  return (
    <Modal open={show} closeOnDimmerClick={false}>
      <Modal.Header>Delete Collection</Modal.Header>
      <Modal.Content scrolling>
        <p>
          Are you sure you want to delete{" "}
          <strong>{collectionToDelete?.title}</strong>{" "}
          <span className="muted-text">({collectionToDelete?.collID})</span>?
        </p>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onCloseFunc}>Cancel</Button>
        <Button color="red" loading={loading} onClick={handleDeleteCollection}>
          <Icon name="delete" />
          Delete
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default DeleteCollection;
