import React, { useState, useCallback } from "react";
import {
  Modal,
  Button,
  Input,
  Icon,
  Message,
} from "semantic-ui-react";

interface PermanentLinkModalProps {
  open: boolean;
  link: string;
  onClose: () => void;
}

const PermanentLinkModal: React.FC<PermanentLinkModalProps> = ({
  open,
  link,
  onClose,
}) => {
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
      }, 3000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  }, [link]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="small"
    >
      <Modal.Header>Permanent Link</Modal.Header>
      <Modal.Content>
        <Input
          fluid
          value={link}
          readOnly
          style={{ marginBottom: "10px" }}
        />
        {copySuccess && (
          <Message success content="Copied to clipboard!" />
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button
          color="green"
          onClick={handleCopyToClipboard}
          disabled={!link}
        >
          <Icon name="copy" /> Copy
        </Button>
        <Button onClick={onClose}>Close</Button>
      </Modal.Actions>
    </Modal>
  );
};

export default PermanentLinkModal;
