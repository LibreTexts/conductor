import { useState, useEffect } from "react";
import {
  Button,
  Dropdown,
  Form,
  Icon,
  Modal,
  ModalProps,
} from "semantic-ui-react";
import { KBTreeNode } from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import axios from "axios";

interface AddPageModalProps extends ModalProps {
  open: boolean;
  onClose: () => void;
}

const AddPageModal: React.FC<AddPageModalProps> = ({
  open,
  onClose,
  ...rest
}) => {
  const { handleGlobalError } = useGlobalError();
  const [loading, setLoading] = useState(false);
  const [pageID, setPageID] = useState<string>("");
  const [tree, setTree] = useState<KBTreeNode[]>([]);

  useEffect(() => {
    loadTree();
  }, []);

  async function loadTree() {
    try {
      setLoading(true);
      const res = await axios.get("/kb/tree");
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.tree) {
        throw new Error("Invalid response from server.");
      }
      if (!Array.isArray(res.data.tree)) {
        throw new Error("Invalid response from server.");
      }

      //flatten the tree
      const flattenedTree: KBTreeNode[] = [];
      const flatten = (node: KBTreeNode) => {
        flattenedTree.push(node);
        if (node.children) {
          node.children.forEach((child) => {
            flatten(child);
          });
        }
      };

      res.data.tree.forEach((node: KBTreeNode) => {
        flatten(node);
      });

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
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      if (!res.data.page) {
        throw new Error("Invalid response from server.");
      }
      onClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="large" {...rest}>
      <Modal.Header>Add Featured Article</Modal.Header>
      <Modal.Content>
        <Form onSubmit={(e) => e.preventDefault()}>
          <Form.Field>
            <label htmlFor="pageSelect">Page</label>
            <Dropdown
              id="pageSelect"
              placeholder="Select a page"
              fluid
              search
              selection
              options={tree.map((page) => {
                return {
                  key: page.uuid,
                  text: page.title,
                  value: page.uuid,
                };
              })}
              onChange={(e, { value }) => setPageID(value as string)}
            />
          </Form.Field>
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>
          <Icon name="cancel" /> Cancel
        </Button>
        <Button color="green" loading={loading} onClick={() => handleSave()}>
          <Icon name="plus" /> Add
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default AddPageModal;
