import React from "react";
import { Button, Header, Icon, Modal, Segment } from "semantic-ui-react";

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
    <Modal open={open} size="small" onClose={() => !loading && onClose()}>
      <Modal.Header>
        <Icon name="history" /> Load Remixer State
      </Modal.Header>
      <Modal.Content>
        <p>
          Choose which version to load. This will replace your current book
          tree.
        </p>
        <Segment.Group>
          {availableSources.hasLocal && (
            <Segment
              style={{
                cursor: loading ? "default" : "pointer",
                transition: "background 0.15s",
              }}
              className="selectable"
              onClick={() => !loading && onLoadSource("local")}
            >
              <Header as="h4">
                <Icon name="computer" /> Browser Draft
                {availableSources.localTimestamp && (
                  <Header.Subheader>
                    Saved:{" "}
                    {new Date(
                      availableSources.localTimestamp,
                    ).toLocaleString()}
                  </Header.Subheader>
                )}
              </Header>
              <p style={{ margin: 0, color: "#666" }}>
                Restore unsaved changes from this browser.
              </p>
            </Segment>
          )}
          {availableSources.hasServerDraft && (
            <Segment
              style={{
                cursor: loading ? "default" : "pointer",
                transition: "background 0.15s",
              }}
              className="selectable"
              onClick={() => !loading && onLoadSource("serverDraft")}
            >
              <Header as="h4">
                <Icon name="cloud download" /> Server Draft
              </Header>
              <p style={{ margin: 0, color: "#666" }}>
                Load the draft saved to the server.
              </p>
            </Segment>
          )}
          {/* {availableSources.hasServer && (
            <Segment
              style={{
                cursor: loading ? "default" : "pointer",
                transition: "background 0.15s",
              }}
              className="selectable"
              onClick={() => !loading && onLoadSource("server")}
            >
              <Header as="h4">
                <Icon name="cloud" /> Server Saved State
              </Header>
              <p style={{ margin: 0, color: "#666" }}>
                Fetch the latest saved state from the server.
              </p>
            </Segment>
          )} */}
          <Segment
            style={{
              cursor: loading ? "default" : "pointer",
              transition: "background 0.15s",
            }}
            className="selectable"
            onClick={() => !loading && onLoadSource("fresh")}
          >
            <Header as="h4">
              <Icon name="book" /> Fresh from Library
            </Header>
            <p style={{ margin: 0, color: "#666" }}>
              Reload the original book structure from the library.
            </p>
          </Segment>
        </Segment.Group>
      </Modal.Content>
      <Modal.Actions>
        <Button disabled={loading} onClick={onClose}>
          Cancel
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default RecoveryModal;
