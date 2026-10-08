import { Button, Modal, Radio, RadioGroup, Stack, Text } from "@libretexts/davis-react";
import React, { useState } from "react";

export type RefreshMode = "content" | "page";

interface RefreshModeModalProps {
  onCancel: () => void;
  onConfirm: (mode: RefreshMode) => void;
}

const RefreshModeModal: React.FC<RefreshModeModalProps> = ({
  onCancel,
  onConfirm,
}) => {
  const [mode, setMode] = useState<RefreshMode>("page");

  return (
    <Modal open onClose={onCancel} size="md">
      <Modal.Header>
        <Modal.Title>Refresh License Data</Modal.Title>
        <Modal.Close aria-label="Close refresh options" />
      </Modal.Header>
      <Modal.Body>
        <Stack direction="vertical" gap="sm">
          <Text size="sm" className="text-neutral-600">
            Choose how much license data to reload from the library.
          </Text>
          <RadioGroup
            name="restacker-refresh-mode"
            label="Refresh type"
            value={mode}
            onChange={(value) => setMode(value as RefreshMode)}
          >
            <Radio
              value="page"
              label="Page level"
              description="Updates only the page and book licenses. Keeps the existing Source and Content license data. Fast."
            />
            <Radio
              value="content"
              label="Content level"
              description="Reviews every block of each page's content for Source and Content licenses and remixing. Can take several minutes."
            />
          </RadioGroup>
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        {/* Pending Davis fix: outline Button border and Radio/Modal.Close
            contrast are below 3:1. */}
        <Button
          variant="outline"
          onClick={onCancel}
          aria-label="Cancel Refresh License Data"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => onConfirm(mode)}
          aria-label="Refresh License Data"
        >
          Refresh
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RefreshModeModal;
