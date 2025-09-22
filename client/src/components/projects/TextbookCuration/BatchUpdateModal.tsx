import { Button, Icon, Modal } from "semantic-ui-react";
import EventFeed from "../../util/EventFeed";
import useProject from "../../../hooks/useProject";
import api from "../../../api";
import React, { useState } from "react";
import { useNotifications } from "../../../context/NotificationContext";
import useGlobalError from "../../error/ErrorHooks";

interface BatchUpdateModalProps {
  projectID: string;
  open: boolean;
  onClose: () => void;
  pages: any[];
}

const BatchUpdateModal: React.FC<BatchUpdateModalProps> = (props) => {
  const { addNotification } = useNotifications();
  const { handleGlobalError } = useGlobalError();
  const { mutations, bookID } = useProject(props.projectID);

  const [messages, setMessages] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [didSubmit, setDidSubmit] = useState(false);

  async function updatePages() {
    try {
      if (!props.pages || props.pages.length === 0) return;

      if (!bookID) {
        throw new Error("Book ID is not available");
      }

      const eventSource = api.batchUpdateBookMetadata(bookID, props.pages);
      if (!eventSource) return;

      eventSource.onopen = () => {
        setConnected(true);
        setMessages([]);
        setDidSubmit(true);
        mutations.refreshActiveJobStatus.mutate();
        addNotification({
          type: "success",
          message: "Started bulk update job.",
        });
      };

      eventSource.onmessage = (event) => {
        setMessages((prev) => [...prev, event.data]);
        if (event.data.includes("END")) {
          eventSource.close();
          setConnected(false);
          mutations.refreshActiveJobStatus.mutate();
        }
      };

      eventSource.onerror = (err) => {
        console.error("EventSource failed:", err);
        eventSource.close();
        setConnected(false);
        mutations.refreshActiveJobStatus.mutate();
      };
    } catch (error) {
      handleGlobalError(error);
    }
  }

  return (
    <Modal size="large" open={props.open} onClose={props.onClose}>
      <Modal.Header>Batch Update Progress</Modal.Header>
      <Modal.Content>
        {!didSubmit ? (
          <p className="text-lg mb-4">
            Are you sure you want to save these changes? This will update the
            metadata for the selected pages and cannot be undone.
          </p>
        ) : (
          <>
            <p className="text-lg mb-4">
              We're applying your updates. This may take a few minutes. You can
              close this modal at any time and we'll send you an email when
              updates are complete.
            </p>
            <hr className="my-6" />
            <EventFeed
              messages={messages}
              connected={connected}
              autoScroll
              showTimestamp
              className="mt-6"
            />
          </>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={props.onClose}>
          {!didSubmit ? "Cancel" : "Close"}
        </Button>
        {!didSubmit && (
          <Button onClick={updatePages} color="green">
            <Icon name="save outline" />
            Save
          </Button>
        )}
      </Modal.Actions>
    </Modal>
  );
};

export default BatchUpdateModal;
