import React from "react";
import { Icon } from "semantic-ui-react";
import { Button, Card, Heading, Modal, Stack, Text } from "@libretexts/davis-react";

interface AvailableSources {
  hasLocal: boolean;
  hasServer: boolean;
  hasServerDraft: boolean;
  localTimestamp?: number;
}

export type BookSourceType = "local" | "serverDraft" | "server" | "fresh";

interface RecoveryModalProps {
  open: boolean;
  loading: boolean;
  availableSources: AvailableSources;
  onLoadSource: (source: BookSourceType) => void;
  onClose: () => void;
}

const RecoveryModal: React.FC<RecoveryModalProps> = ({
  open,
  loading,
  availableSources,
  onLoadSource,
  onClose,
}) => {
  return (
    <Modal open={open} size="md" onClose={() => {}}>
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
                {availableSources.localTimestamp != null && (
                  <Text size="sm" className="mt-1 text-gray-500">
                    Saved:{" "}
                    {new Date(availableSources.localTimestamp).toLocaleString()}
                  </Text>
                )}
                <Text className="mt-2 text-gray-600">
                 <br/> Restore unsaved changes from this browser.
                </Text>
              </Card.Body>
            </Card>
          )}
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
                  <Icon name="cloud download" /> Server Draft
                </Heading>
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
              <Text className="mt-2 text-gray-600">
                Reload the original book structure from the library.
              </Text>
            </Card.Body>
          </Card>
        </Stack>
      </Modal.Body>
    
    </Modal>
  );
};

export default RecoveryModal;
