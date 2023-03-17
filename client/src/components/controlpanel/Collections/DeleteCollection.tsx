import { useState, FC, ReactElement } from "react";
import { Modal, Button, Icon } from "semantic-ui-react";
import axios from "axios";
import useGlobalError from "../../error/ErrorHooks.js";
import { Collection } from "../../../types";

type DeleteCollectionProps = {
  show: boolean;
  collectionToDelete: Collection;
  onCloseFunc: Function;
};
const DeleteCollection: FC<DeleteCollectionProps> = ({
  show,
  collectionToDelete,
  onCloseFunc,
}): ReactElement => {
  // Global Error Handling
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState<boolean>(false);

  const handleDeleteCollection = () => {
    console.log("delete collection");
  };

  return (
    <Modal open={show} closeOnDimmerClick={false}>
      <Modal.Header>Delete Collection</Modal.Header>
      <Modal.Content scrolling>
        <p>
          Are you sure you want to delete{" "}
          <strong>{collectionToDelete.title}</strong>{" "}
          <span className="muted-text">({collectionToDelete.collID})</span>?
        </p>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onCloseFunc()}>Cancel</Button>
        <Button color="red" loading={loading} onClick={handleDeleteCollection}>
          <Icon name="delete" />
          Delete
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default DeleteCollection;
