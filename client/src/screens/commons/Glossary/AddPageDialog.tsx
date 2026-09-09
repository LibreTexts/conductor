import React, { useMemo, useState } from "react";
import { GlossaryEntry } from "./model";
import { Alert, Badge, Button, Modal, Stack } from "@libretexts/davis-react";
import { TableOfContents } from "../../../types";
import { findTocNodeById } from "./services";

interface AddPageDialogProps {
  open: boolean;
  onClose: () => void;
  /** Snapshot of the pages to assign, taken once when the dialog opens. */
  initialPageIds: string[];
  selectedTerms: GlossaryEntry[];
  toc: TableOfContents;
  onSubmit: (pageIds: string[]) => void;
}

const AddPageDialog: React.FC<AddPageDialogProps> = ({
  open,
  onClose,
  initialPageIds,
  selectedTerms,
  toc,
  onSubmit,
}) => {
  // Owns its own working copy so removing a page badge doesn't need the
  // parent to hand back an updated prop mid-session — a fresh instance of
  // this dialog is created each time it's opened, so seeding from the prop
  // once at mount is all that's needed.
  const [pageIds, setPageIds] = useState<string[]>(initialPageIds);

  const pageTitles = useMemo(() => {
    return [...pageIds]
      .reverse()
      .map((pageId) => ({
        id: pageId,
        title: findTocNodeById(toc, pageId)?.title ?? pageId,
      }));
  }, [pageIds, toc]);

  return (
    <Modal open={open} onClose={(v) => !v && onClose()} size="lg">
      <Modal.Header>
        <Modal.Title>Assign Terms to Pages</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>Add the following term(s) </p>
        <Stack direction="horizontal" gap="sm">
          {selectedTerms.map((term) => (
            <Badge key={term.usageID} label={term.term} variant="primary" size="md" />
          ))}
        </Stack>
        <p>to the following pages:</p>
        <Stack direction="vertical" gap="sm">
          {pageTitles.map(({ id, title }) => (
            <Alert
              key={id}
              message={title}
              variant="info"
              dismissible={true}
              onDismiss={() => {
                setPageIds((prev) => prev.filter((p) => p !== id));
              }}
            />
          ))}
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => onSubmit(pageIds)}
          disabled={pageIds.length === 0 || selectedTerms.length === 0}
        >
          Add
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddPageDialog;
