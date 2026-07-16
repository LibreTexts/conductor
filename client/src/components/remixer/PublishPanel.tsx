import React, { useEffect, useMemo, useRef } from "react";
import {
  Icon,
  List,
  Progress,
} from "semantic-ui-react";
import { RemixerSubPage } from "./model";
import { appendSiblingTitleSuffix } from "./services";
import { Accordion, Button, Modal, Text } from "@libretexts/davis-react";
interface PublishPanelProps {
  open: boolean;
  dimmer: string;
  handleClose: () => void;
  handlePublish: () => void;
  currentBook?: RemixerSubPage[];
  publishInProgress?: boolean;
  publishStatus?: "idle" | "pending" | "running" | "success" | "error";
  publishMessages?: string[];
}

interface SummarySection {
  key:
    | "added"
    | "moved"
    | "renamed"
    | "deleted"
    | "unchanged";
  label: string;
  color: string;
  items: RemixerSubPage[];
}

const PublishPanel: React.FC<PublishPanelProps> = ({
  open,
  dimmer,
  handleClose,
  currentBook = [],
  handlePublish,
  publishInProgress = false,
  publishStatus = "idle",
  publishMessages = [],
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [publishMessages]);

  const publish = () => {
    handlePublish();
  };

  const canClose = !publishInProgress;

  const progressInfo = useMemo(() => {
    if (publishStatus === "idle") return null;
    const total = currentBook.length;
    const processed = publishMessages.filter((m) => m.endsWith("- processed") || m.endsWith("- skipped")).length;
    let percent: number;
    if (publishStatus === "success") {
      percent = 100;
    } else if (publishStatus === "error") {
      percent = total > 0 ? Math.round((processed / total) * 100) : 0;
    } else {
      percent = total > 0 ? Math.round((processed / total) * 100) : 0;
    }
    return { percent, total, processed };
  }, [publishStatus, publishMessages, currentBook]);

  const sections = useMemo<SummarySection[]>(() => {
    const deleted = currentBook.filter((page) => page.deletedItem);
    const renamed = currentBook.filter(
      (page) => page.renamedItem && !page.deletedItem,
    );
    const moved = currentBook.filter(
      (page) => page.movedItem && !page.deletedItem,
    );
    const added = currentBook.filter(
      (page) => page.addedItem && !page.deletedItem,
    );
    const unchanged = currentBook.filter(
      (page) =>
        !page.addedItem &&
        !page.movedItem &&
        !page.renamedItem &&
        !page.deletedItem,
    );
    return [
      {
        key: "added",
        label: "pages will be added",
        color: "#2e7d32",
        items: added,
      },
      {
        key: "moved",
        label: "pages will be moved",
        color: "#f39c12",
        items: moved,
      },
      {
        key: "renamed",
        label: "pages will be renamed",
        color: "#f39c12",
        items: renamed,
      },

      {
        key: "deleted",
        label: "pages will be deleted",
        color: "#e53935",
        items: deleted,
      },
      {
        key: "unchanged",
        label: "pages will be unchanged",
        color: "#7f8c8d",
        items: unchanged,
      },
    ];
  }, [currentBook]);

  return (
    <Modal
      open={open}
      size="xl"
      onClose={() => {
        if (canClose) handleClose();
      }}
    >
      <Modal.Header>Save to Library</Modal.Header>
      <Modal.Body>
        {publishStatus !== "idle" && (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 6,
              background: "#f8f9fb",
              border: "1px solid #dfe3e8",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 700 }}>
                Status:{" "}
                {publishStatus === "error"
                  ? "Failed"
                  : publishStatus.charAt(0).toUpperCase() + publishStatus.slice(1)}
              </span>
              {progressInfo && (
                <span style={{ fontSize: 12, color: "#555" }}>
                  {progressInfo.processed} / {progressInfo.total} pages
                </span>
              )}
            </div>
            {progressInfo && (
              <Progress
                value={progressInfo.processed}
                total={progressInfo.total}
                color={
                  publishStatus === "success"
                    ? "green"
                    : publishStatus === "error"
                      ? "red"
                      : "blue"
                }
                indicating={publishStatus === "running"}
                success={publishStatus === "success"}
                error={publishStatus === "error"}
                style={{ marginBottom: 10 }}
              />
            )}
            {publishMessages.length > 0 ? (
              <div
                style={{
                  maxHeight: 180,
                  overflowY: "auto",
                  paddingRight: 4,
                }}
              >
                <List bulleted>
                  {publishMessages.map((message, index) => (
                    <List.Item key={`${message}-${index}`}>{message}</List.Item>
                  ))}
                </List>
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <span style={{ color: "#8a8a8a" }}>No messages yet</span>
            )}
          </div>
        )}
        <Accordion variant="bordered" className="mt-4 w-full">
          {sections.map((section) => (
            <Accordion.Item key={section.key} defaultOpen={false}>
              <Accordion.Trigger>
                <span
                  className="font-semibold"
                  style={{ color: section.color }}
                >
                  {section.items.length} {section.label}
                </span>
              </Accordion.Trigger>
              <Accordion.Panel>
                {section.items.length === 0 ? (
                  <Text color="muted">No pages</Text>
                ) : (
                  <ul className="list-disc space-y-1 pl-5">
                    {section.items.map((item) => (
                      <li key={item["@id"]} className="text-sm text-gray-800">
                        {appendSiblingTitleSuffix(
                          item["@title"] || item.title || "",
                          item,
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={handleClose} disabled={!canClose} variant="outline" className="bg-neutral-100 text-neutral-700 hover:bg-neutral-200">Close</Button>
        <Button variant="primary" onClick={publish} loading={publishInProgress} disabled={publishInProgress}>
          <Icon name="save" /> Save 
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PublishPanel;