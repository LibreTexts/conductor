import React, { useMemo } from "react";
import { GlossaryEntry } from "./model";
import { Alert, Badge, Button, Dialog, Modal, Stack } from "@libretexts/davis-react";
import { TableOfContents } from "../../../types";
import { findTocNodeById } from "./services";

interface AddPageDialogProps {
  open: boolean;
  onClose: () => void;
  pageIds: string[];
  selectedTerms: GlossaryEntry[];
  toc: TableOfContents;
  setSelectedPageIds: (pageIds: string[]) => void;
  handleAddTermsToPages: () => void;
  editingUsageID: string | null;
  setEditingUsageID: (usageID: string) => void;
  glossaryEntries: GlossaryEntry[];
}

const AddPageDialog: React.FC<AddPageDialogProps> = ({
  open,
  onClose,
  pageIds,
  selectedTerms,
  toc,
  setSelectedPageIds,
  handleAddTermsToPages
}) => {
  const pageTitles = useMemo(() => {
    return pageIds.map((pageId) => ({
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
            <Badge label={term.term} variant="primary" size="md" />
          ))}
        </Stack>
        <p>to the following pages:</p>
        <Stack direction="vertical" gap="sm">
          {pageTitles.reverse().map(({ id, title }) => (
            <Alert message={title} variant="info" dismissible={true} onDismiss={() => {
                setSelectedPageIds(pageIds.filter((p) => p !== id));
            }}/>
          ))}
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose} >
          Cancel
        </Button>
        <Button variant="primary" onClick={handleAddTermsToPages} disabled={pageIds.length === 0 || selectedTerms.length === 0}>
          Add
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddPageDialog;
