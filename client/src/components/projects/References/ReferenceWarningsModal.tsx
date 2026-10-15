import React from "react";
import { Button, Modal, Stack, Text } from "@libretexts/davis-react";
import { IconAlertTriangle } from "@tabler/icons-react";
import type { ReferenceEntry } from "./model";

/** One thing worth an author's attention about a reference. */
export type ReferenceWarning = {
  /** Stable kind, used for filtering. */
  id: "not-cited";
  title: string;
  detail: string;
};

interface ReferenceWarningsModalProps {
  /** The reference whose warnings are shown; the dialog is open while set. */
  reference: ReferenceEntry | null;
  warnings: ReferenceWarning[];
  onClose: () => void;
}

/** Lists a reference's warnings with what each one means and how to fix it. */
const ReferenceWarningsModal: React.FC<ReferenceWarningsModalProps> = ({
  reference,
  warnings,
  onClose,
}) => (
  <Modal open={!!reference} onClose={onClose} size="md">
    <Modal.Header>
      <Modal.Title>Warnings for {reference?.citationKey}</Modal.Title>
      <Modal.Close aria-label="Close" />
    </Modal.Header>
    <Modal.Body>
      <Stack direction="vertical" gap="md">
        {reference?.title && (
          <Text size="sm" className="text-neutral-600">
            {reference.title}
          </Text>
        )}
        <ul className="space-y-3">
          {warnings.map((warning) => (
            <li key={warning.id} className="flex gap-3">
              <IconAlertTriangle
                size={20}
                className="mt-0.5 shrink-0 text-amber-600"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-neutral-800">
                  {warning.title}
                </p>
                <p className="text-sm text-neutral-700">{warning.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </Stack>
    </Modal.Body>
    <Modal.Footer>
      <Button variant="outline" onClick={onClose}>
        Close
      </Button>
    </Modal.Footer>
  </Modal>
);

export default ReferenceWarningsModal;
