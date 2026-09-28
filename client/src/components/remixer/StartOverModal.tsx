import React from "react";

import {
  Button,
  Card,
  Heading,
  Modal,
  Stack,
  Text,
  Tooltip,
} from "@libretexts/davis-react";
import { IconBook, IconRefresh } from "@tabler/icons-react";
import ConsultInsightButton from "../NextGenComponents/ConsultInsightButton";

interface StartOverModalProps {
  open: boolean;
  loading: boolean;
  /** Reload the book from the library, keeping autonumbering / path formats / overrides. */
  onReloadPreservingSettings: () => void;
  /** Delete the saved Remixer draft and reload the book with settings reset. */
  onStartOver: () => void;
  onClose: () => void;
}

/** Start-over chooser; mirrors RecoveryModal's layout with just the two "Fresh from Library" modes. */
const StartOverModal: React.FC<StartOverModalProps> = ({
  open,
  loading,
  onReloadPreservingSettings,
  onStartOver,
  onClose,
}) => {
  const cardClassName = loading
    ? "cursor-default"
    : "cursor-pointer transition-colors hover:bg-surface-hover";

  return (
    <Modal open={open} size="md" onClose={loading ? () => {} : onClose}>
      <Modal.Header>
        <Modal.Title>
          <IconRefresh size="1.25em" className="inline-block" aria-hidden="true" />{" "}
          Start Over
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="flex items-start justify-between gap-4">
          <Text className="text-gray-700">
            Reload the original book structure from the library. This will
            replace your current book tree.
          </Text>
          <Tooltip placement="bottom" content="Consult the Insight Knowledge Base for more information about loading the Remixer state">
            <ConsultInsightButton href="https://commons.libretexts.org/insight/remixer---load-remixer-state" />
          </Tooltip>
        </div>
        <Stack direction="vertical" gap="md" className="mt-4">
          <Card
            variant="outline"
            padding="md"
            className={cardClassName}
            // Davis renders a clickable Card as a keyboard-operable button; drop
            // the handler while loading so it isn't announced as an active one.
            onClick={loading ? undefined : onReloadPreservingSettings}
          >
            <Card.Body>
              <Heading level={4} className="flex items-center gap-2">
                <IconBook size="1.25em" aria-hidden="true" /> Reload and Keep
                Settings
              </Heading>
              <Text className="mt-2 text-gray-600">
                Reload the book from the library but preserve autonumbering,
                path formats and override settings.
              </Text>
            </Card.Body>
          </Card>

          <Card
            variant="outline"
            padding="md"
            className={cardClassName}
            onClick={loading ? undefined : onStartOver}
          >
            <Card.Body>
              <Heading level={4} className="flex items-center gap-2">
                <IconRefresh size="1.25em" aria-hidden="true" /> Start Over
              </Heading>
              <Stack direction="vertical" gap="xs" className="mt-1">
                <Text className="mt-2 text-gray-600">
                  Reload the book from the library from scratch.
                </Text>
                <Text size="sm" className="block text-warning-500">
                  This will delete the saved Remixer draft and reload the book
                  from the library. Autonumbering and path format settings
                  will be reset. This action cannot be undone.
                </Text>
              </Stack>
            </Card.Body>
          </Card>
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Stack direction="horizontal" gap="md" justify="end">
          <Button onClick={onClose} disabled={loading} variant="outline">
            Close
          </Button>
        </Stack>
      </Modal.Footer>
    </Modal>
  );
};

export default StartOverModal;
