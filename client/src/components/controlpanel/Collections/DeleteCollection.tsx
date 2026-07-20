import { useState, FC, ReactElement } from "react";
import { Modal, Button, Text, Stack } from "@libretexts/davis-react";
import { IconTrash } from "@tabler/icons-react";
import axios from "axios";
import useGlobalError from "../../error/ErrorHooks";
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
    <Modal open={show} onClose={onCloseFunc}>
      <Modal.Header>
        <Modal.Title>Delete Collection</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        <Text>
          Are you sure you want to delete{" "}
          <strong>{collectionToDelete?.title}</strong>{" "}
          <span className="text-gray-500">({collectionToDelete?.collID})</span>?
        </Text>
      </Modal.Body>
      <Modal.Footer>
        <Stack direction="horizontal" gap="md" justify="end">
          <Button variant="outline" onClick={onCloseFunc} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            icon={<IconTrash size={16} />}
            loading={loading}
            onClick={handleDeleteCollection}
          >
            Delete
          </Button>
        </Stack>
      </Modal.Footer>
    </Modal>
  );
};

export default DeleteCollection;
