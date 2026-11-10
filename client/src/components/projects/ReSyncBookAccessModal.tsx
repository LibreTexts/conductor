import { useState } from "react";
import { Alert, Button, Modal, Stack, Switch } from "@libretexts/davis-react";
import { IconRefresh } from "@tabler/icons-react";

export type ReSyncCascade = "delta" | "absolute";

interface ReSyncBookAccessModalProps {
  open?: boolean;
  /** Shows the absolute-cascade override. The server enforces this independently. */
  canOverwriteSubpages: boolean;
  onConfirm: (cascade: ReSyncCascade) => void;
  onCancel: () => void;
}

const ReSyncBookAccessModal: React.FC<ReSyncBookAccessModalProps> = ({
  open = true,
  canOverwriteSubpages,
  onConfirm,
  onCancel,
}) => {
  const [overwriteSubpages, setOverwriteSubpages] = useState(false);
  const absolute = canOverwriteSubpages && overwriteSubpages;

  return (
    <Modal open={open} onClose={onCancel} size="md">
      <Modal.Header>
        <Modal.Title>Re-Sync Book Access</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        <Stack direction="vertical" gap="md">
          <p className="text-gray-700">
            Are you sure you want to re-sync book access? Conductor handles this
            automatically, so this is only necessary if you are having issues
            with access.
          </p>
          {canOverwriteSubpages && (
            <Switch
              name="overwriteSubpages"
              label="Overwrite all permissions on subpages to the settings on this page (use with caution)"
              checked={overwriteSubpages}
              onChange={setOverwriteSubpages}
            />
          )}
          {absolute && (
            <Alert
              variant="warning"
              title="Subpage permissions will be replaced"
              message="Any permissions set directly on a subpage, such as access granted to a chapter author or TA, will be removed. This cannot be undone."
            />
          )}
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant={absolute ? "destructive" : "primary"}
          icon={<IconRefresh />}
          onClick={() => onConfirm(absolute ? "absolute" : "delta")}
        >
          {absolute ? "Re-Sync and Overwrite" : "Re-Sync"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ReSyncBookAccessModal;
