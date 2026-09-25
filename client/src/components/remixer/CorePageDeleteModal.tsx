import React from "react";

import { Button, Modal, Stack, Text } from "@libretexts/davis-react";
import { IconAlertTriangle } from "@tabler/icons-react";

interface CorePageDeleteModalProps {
  open: boolean;
  /** "section" for the Front/Back Matter container, "page" for a default page inside it. */
  kind: "page" | "section";
  /** Title of the core front/back matter node about to be deleted. */
  pageTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation for deleting core front/back matter: the Front/Back Matter
 * containers or their default pages (TitlePage, InfoPage, Index, …). These
 * are normally locked, so deleting one needs an explicit acknowledgement.
 */
const CorePageDeleteModal: React.FC<CorePageDeleteModalProps> = ({
  open,
  kind,
  pageTitle,
  onConfirm,
  onCancel,
}) => (
  <Modal open={open} size="md" onClose={onCancel}>
    <Modal.Header>
      <Modal.Title>
        <IconAlertTriangle
          size="1.25em"
          className="inline-block text-warning-500"
          aria-hidden="true"
        />{" "}
        {kind === "section" ? "Delete Core Section?" : "Delete Core Page?"}
      </Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <Stack direction="vertical" gap="sm">
        {kind === "section" ? (
          <Text as="p" className="text-gray-700">
            <strong>{pageTitle}</strong> is a core section of the book.
            Deleting it also deletes every page inside it, including the core
            pages LibreTexts generates automatically (such as the title page,
            licensing details, glossary and index) that other features may
            rely on.
          </Text>
        ) : (
          <Text as="p" className="text-gray-700">
            <strong>{pageTitle}</strong> is a core page of the book's front or
            back matter. LibreTexts generates these pages automatically, and
            other features (such as the title page, licensing details, glossary
            and index) may rely on them.
          </Text>
        )}
        <Text as="p" size="sm" className="text-warning-500">
          Only delete this {kind} if you are sure. The deletion is applied to
          the library when you save, and it will not be recreated
          automatically.
        </Text>
      </Stack>
    </Modal.Body>
    <Modal.Footer>
      <Stack direction="horizontal" gap="md" justify="end">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          Delete Anyway
        </Button>
      </Stack>
    </Modal.Footer>
  </Modal>
);

export default CorePageDeleteModal;
