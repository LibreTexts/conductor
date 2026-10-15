import React from "react";
import { Alert, Button, Modal, Stack, Text } from "@libretexts/davis-react";
import type { ReferenceEntry } from "./model";

interface BulkRemoveModalProps {
  open: boolean;
  /** The selected references, all of which will be removed. */
  references: ReferenceEntry[];
  /**
   * References the last citation scan found cited on pages, or undefined when
   * no scan has run, so whether any are cited is unknown.
   */
  citedIDs?: Set<string>;
  removing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirms removing the selected references. Lists every key so references
 * selected but currently hidden by search or a filter aren't removed unseen.
 */
const BulkRemoveModal: React.FC<BulkRemoveModalProps> = ({
  open,
  references,
  citedIDs,
  removing,
  onCancel,
  onConfirm,
}) => {
  const count = references.length;
  const noun = count === 1 ? "reference" : "references";
  const citedCount = citedIDs
    ? references.filter((reference) => citedIDs.has(reference.referenceID))
        .length
    : 0;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!removing) onCancel();
      }}
      size="md"
    >
      <Modal.Header>
        <Modal.Title>Remove {noun}</Modal.Title>
        <Modal.Close aria-label="Close" />
      </Modal.Header>
      <Modal.Body>
        <Stack direction="vertical" gap="md">
          <Text size="sm">
            {count === 1
              ? "Remove this reference from this project?"
              : `Remove these ${count} ${noun} from this project?`}
          </Text>
          {citedIDs === undefined ? (
            <Alert
              variant="warning"
              message={`If ${count === 1 ? "this reference is" : "any of these are"} cited on pages, those citations will stop working and show as “?” until the reference is added back or the citation is removed.`}
            />
          ) : (
            citedCount > 0 && (
              <Alert
                variant="warning"
                message={
                  count === 1
                    ? "This reference is cited on pages. Those citations will stop working and show as “?” until the reference is added back or the citation is removed."
                    : `${citedCount} of these ${citedCount === 1 ? "is" : "are"} cited on pages (marked below). Those citations will stop working and show as “?” until the reference is added back or the citation is removed.`
                }
              />
            )
          )}
          <ul
            className="max-h-48 list-disc space-y-1 overflow-y-auto rounded border border-gray-200 py-2 pl-8 pr-3 text-sm"
            tabIndex={0}
            aria-label={`${count} ${noun} to remove`}
          >
            {references.map((reference) => (
              <li key={reference.referenceID}>
                <code className="font-semibold">{reference.citationKey}</code>
                {citedIDs?.has(reference.referenceID) && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900">
                    Cited
                  </span>
                )}
                {reference.title && (
                  <span className="text-neutral-600"> — {reference.title}</span>
                )}
              </li>
            ))}
          </ul>
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onCancel} disabled={removing}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={onConfirm}
          loading={removing}
          disabled={removing || count === 0}
        >
          {count === 1 ? "Remove" : `Remove ${count} ${noun}`}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default BulkRemoveModal;
