import { useState, useEffect } from "react";
import { Modal, Button, Select } from "@libretexts/davis-react";
import { IconX, IconPlus } from "@tabler/icons-react";
import { KBTreeNode } from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import axios from "axios";

interface AddPageModalProps {
  open: boolean;
  onClose: () => void;
}

const AddPageModal: React.FC<AddPageModalProps> = ({ open, onClose }) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);
  const [pageID, setPageID] = useState<string>("");
  const [tree, setTree] = useState<KBTreeNode[]>([]);

  useEffect(() => {
    if (open) {
      loadTree();
      setPageID("");
    }
  }, [open]);

  async function loadTree() {
    try {
      setLoading(true);
      const res = await axios.get("/kb/tree");
      if (res.data.err) throw new Error(res.data.errMsg);
      if (!res.data.tree || !Array.isArray(res.data.tree))
        throw new Error("Invalid response from server.");

      const flattenedTree: KBTreeNode[] = [];
      const flatten = (node: KBTreeNode) => {
        flattenedTree.push(node);
        if (node.children) node.children.forEach(flatten);
      };
      res.data.tree.forEach(flatten);
      setTree(flattenedTree);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setLoading(true);
      if (!pageID) return;
      const res = await axios.post("/kb/featured/page", { page: pageID });
      if (res.data.err) throw new Error(res.data.errMsg);
      if (!res.data.page) throw new Error("Invalid response from server.");
      onClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={() => onClose()} size="sm">
      <Modal.Header>
        <Modal.Title>Add Featured Article</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Select
          name="pageSelect"
          label="Page"
          placeholder="Select a page"
          options={tree.map((page) => ({ value: page.uuid, label: page.title }))}
          value={pageID}
          onChange={(e) => setPageID(e.target.value)}
          disabled={loading}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="ghost"
          icon={<IconX size={16} aria-hidden="true" />}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          icon={<IconPlus size={16} aria-hidden="true" />}
          loading={loading}
          onClick={handleSave}
        >
          Add
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddPageModal;
