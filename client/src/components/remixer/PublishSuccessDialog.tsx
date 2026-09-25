import React from "react";
import { Button, Dialog, Text } from "@libretexts/davis-react";

interface PublishSuccessDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Persistent confirmation shown when a publish job finishes. Opened after the
 * Save to Library modal, so Headless UI stacks it on top of that modal; it
 * stays up until the user dismisses it.
 */
const PublishSuccessDialog: React.FC<PublishSuccessDialogProps> = ({
  open,
  onClose,
}) => (
  <Dialog open={open} onClose={onClose} size="md">
    <Dialog.Header>
      <Dialog.Title>Publish complete</Dialog.Title>
      <Dialog.Close aria-label="Close publish confirmation" />
    </Dialog.Header>
    <div className="px-6 py-6">
      <Text as="p" size="xl" weight="semibold" color="success">
        Publish completed successfully.
      </Text>
      <Text as="p" size="lg" className="mt-2">
        Your changes have been saved to the library.
      </Text>
    </div>
    <Dialog.Footer>
      <Button variant="primary" onClick={onClose}>
        OK
      </Button>
    </Dialog.Footer>
  </Dialog>
);

export default PublishSuccessDialog;
