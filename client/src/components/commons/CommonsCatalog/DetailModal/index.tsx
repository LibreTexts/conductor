import { Modal } from "semantic-ui-react";
import {
  Book,
  Author,
  ConductorSearchResponseFile,
  Project,
} from "../../../../types";
import AssetDetailModal from "./AssetDetailModal";

interface DetailModalProps {
  item?:
    | Book
    | ConductorSearchResponseFile
    | Project
    | Author;
  open: boolean;
  onClose: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ item, open, onClose }) => {
  if (!item) return null;
  return (
    <Modal open={open} onClose={onClose}>
      <AssetDetailModal file={item as ConductorSearchResponseFile} />
    </Modal>
  );
};

export default DetailModal;
