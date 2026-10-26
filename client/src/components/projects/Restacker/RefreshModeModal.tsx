import { Button, Modal, Radio, RadioGroup, Stack, Text } from "@libretexts/davis-react";
import React, { useState } from "react";

export type RefreshMode = "content" | "page";

interface RefreshModeModalProps {
  onCancel: () => void;
  onConfirm: (mode: RefreshMode) => void;
  /** Wording, so the Attribution Manager can reuse the dialog. Defaults are the Restacker's. */
  title?: string;
  intro?: string;
  pageDescription?: string;
  contentDescription?: string;
}

const RefreshModeModal: React.FC<RefreshModeModalProps> = ({
  onCancel,
  onConfirm,
  title = "Refresh License Data",
  intro = "Choose how much license data to reload from the library.",
  pageDescription = "Updates only the page and book licenses. Keeps the existing Source and Content license data. Fast.",
  contentDescription = "Reviews every block of each page's content for Source and Content licenses and remixing. Can take several minutes.",
}) => {
  const [mode, setMode] = useState<RefreshMode>("page");

  return (
    <Modal open onClose={onCancel} size="md">
      <Modal.Header>
        <Modal.Title>{title}</Modal.Title>
        <Modal.Close aria-label="Close refresh options" />
      </Modal.Header>
      <Modal.Body>
        <Stack direction="vertical" gap="sm">
          <Text size="sm" className="text-neutral-600">
            {intro}
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
              description={pageDescription}
            />
            <Radio
              value="content"
              label="Content level"
              description={contentDescription}
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
