import React, { useState } from "react";
import { Button, Checkbox, Modal, Stack, Text } from "@libretexts/davis-react";

export type PublishImportOptions = {
  importGlossaryTerms: boolean;
  importReferences: boolean;
};

interface PublishImportOptionsModalProps {
  onPublish: (options: PublishImportOptions) => void;
  onCancel: () => void;
}

/**
 * Asked before publishing a remix that includes pages from other books: what
 * to bring along from those pages' source books. Cancel publishes nothing.
 */
const PublishImportOptionsModal: React.FC<PublishImportOptionsModalProps> = ({
  onPublish,
  onCancel,
}) => {
  const [importGlossaryTerms, setImportGlossaryTerms] = useState(true);
  const [importReferences, setImportReferences] = useState(true);

  return (
    <Modal open onClose={onCancel} size="md">
      <Modal.Header>
        <Modal.Title>Publish remix</Modal.Title>
        <Modal.Close aria-label="Close" />
      </Modal.Header>
      <Modal.Body>
        <Stack direction="vertical" gap="md">
          <Text>
            This remix includes pages imported from other books. Choose what to
            bring into this book from those pages.
          </Text>
          <Checkbox
            name="publish-import-glossary"
            label="Glossary terms used on those pages"
            checked={importGlossaryTerms}
            onChange={(checked) => setImportGlossaryTerms(checked === true)}
          />
          <Checkbox
            name="publish-import-references"
            label="References cited on those pages"
            description="Shared with the source book, so corrections there also appear here. Run Scan Citations in the Reference Manager afterwards to show them."
            checked={importReferences}
            onChange={(checked) => setImportReferences(checked === true)}
          />
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => onPublish({ importGlossaryTerms, importReferences })}
        >
          Publish
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PublishImportOptionsModal;
