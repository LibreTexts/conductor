import React from "react";
import { Icon } from "semantic-ui-react";
import {
  Button,
  Card,
  Heading,
  Modal,
  Stack,
  Text,
} from "@libretexts/davis-react";

export interface AvailableSources {
  hasLocal: boolean;
  hasServer: boolean;
  hasServerDraft: boolean;
  localTimestamp?: number;
  serverUpdatedAt?: string | Date;
  serverUpdatedBy?: string;
}

export type BookSourceType = "local" | "serverDraft" | "server" | "fresh";

interface RecoveryModalProps {
  open: boolean;
  loading: boolean;
  dismissible?: boolean;
  availableSources: AvailableSources;
  onLoadSource: (source: BookSourceType) => void;
  onClose: () => void;
}

const RecoveryModal: React.FC<RecoveryModalProps> = ({
  open,
  loading,
  dismissible = false,
  availableSources,
  onLoadSource,
  onClose,
}) => {
  return (
    <Modal
      open={open}
      size="md"
      onClose={dismissible && !loading ? onClose : () => {}}
    >
      <Modal.Header>
        <Modal.Title>
          <Icon name="history" /> Load Remixer State
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Text className="text-gray-700">
          Choose which version to load. This will replace your current book
          tree.
        </Text>
        <Stack direction="vertical" gap="md" className="mt-4">
          {availableSources.hasServerDraft && (
            <Card
              variant="outline"
              padding="md"
              className={
                loading
                  ? "cursor-default"
                  : "cursor-pointer transition-colors hover:bg-surface-hover"
              }
              onClick={() => !loading && onLoadSource("serverDraft")}
            >
              <Card.Body>
                <Heading level={4} className="flex items-center gap-2">
                  <Icon name="cloud download" /> Server Draft(Recommended)
                </Heading>
                {(availableSources.serverUpdatedAt != null ||
                  availableSources.serverUpdatedBy) && (
                  <Stack direction="vertical" gap="xs" className="mt-1">
                    {availableSources.serverUpdatedAt != null && (
                      <Text size="sm" className="block text-gray-500">
                        Saved:{" "}
                        {new Date(
                          availableSources.serverUpdatedAt,
                        ).toLocaleString()}
                      </Text>
                    )}
                    {availableSources.serverUpdatedBy && (
                      <Text size="sm" className="block text-gray-500">
                        By: {availableSources.serverUpdatedBy.trim()}
                      </Text>
                    )}
                  </Stack>
                )}
                <Text className="mt-2 text-gray-600">
                  Load the draft saved to the server.
                </Text>
              </Card.Body>
            </Card>
          )}

          <Card
            variant="outline"
            padding="md"
            className={
              loading
                ? "cursor-default"
                : "cursor-pointer transition-colors hover:bg-surface-hover"
            }
            onClick={() => !loading && onLoadSource("fresh")}
          >
            <Card.Body>
              <Heading level={4} className="flex items-center gap-2">
                <Icon name="book" /> Fresh from Library
              </Heading>
              <Stack direction="vertical" gap="xs" className="mt-1">
                <Text className="mt-2 text-gray-600">
                  Reload the original book structure from the library.
                </Text>
                <Text size="sm" className="block text-warning-500 ">
                  This will reset your current book tree to the original
                  structure. All the configuration will be lost.
                </Text>
              </Stack>
            </Card.Body>
          </Card>

          {availableSources.hasLocal && (
            <Card
              variant="outline"
              padding="md"
              className={
                loading
                  ? "cursor-default"
                  : "cursor-pointer transition-colors hover:bg-surface-hover"
              }
              onClick={() => !loading && onLoadSource("local")}
            >
              <Card.Body>
                <Heading level={4} className="flex items-center gap-2">
                  <Icon name="computer" /> Browser Draft
                </Heading>
                <Stack direction="vertical" gap="xs" className="mt-1">
                {availableSources.localTimestamp != null && (
                  <Text size="sm" className="mt-1 text-gray-500">
                    Saved:{" "}
                    {new Date(availableSources.localTimestamp).toLocaleString()}
                  </Text>
                )}
                <Text className="mt-2 text-gray-600">
                  Restore unsaved changes from this browser.
                </Text></Stack>
              </Card.Body>
            </Card>
          )}
        </Stack>
      </Modal.Body>
      {dismissible && (
        <Modal.Footer>
          <Stack direction="horizontal" gap="md" justify="end">
            <Button
              onClick={onClose}
              disabled={loading}
              variant="outline"
              className="bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            >
              Close
            </Button>
          </Stack>
        </Modal.Footer>
      )}
    </Modal>
  );
};

export default RecoveryModal;
