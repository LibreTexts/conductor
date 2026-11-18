import { useState } from "react";
import { useHistory } from "react-router-dom";
import { Button, Dialog, IconButton } from "@libretexts/davis-react";
import { IconGitFork } from "@tabler/icons-react";
import api from "../../api";
import { useNotifications } from "../../context/NotificationContext";

/**
 * Copies an activity into a new private one the viewer owns, then opens it in
 * the editor. Show it only to verified instructors (`useCanCreateActivities`),
 * the same people who create.
 *
 * `reload` opens the copy with a full page load. The edit screen needs it: it
 * keeps its editor and form state across a change of route parameter.
 *
 * `unsavedChanges` asks before cloning, so a user who would rather keep
 * editing never leaves a copy behind. `beforeLeave` runs once the copy exists,
 * right before navigating, and only when the user confirmed losing changes,
 * so the editor can drop its own leave warning. Edits made while a clean
 * clone is pending keep that warning.
 */
const CloneActivityButton = ({
  activityID,
  size,
  iconOnly = false,
  reload = false,
  fullWidth = false,
  className,
  unsavedChanges = false,
  beforeLeave,
}: {
  activityID: string;
  size: "md" | "lg";
  iconOnly?: boolean;
  reload?: boolean;
  fullWidth?: boolean;
  className?: string;
  unsavedChanges?: boolean;
  beforeLeave?: () => void;
}) => {
  const history = useHistory();
  const { addNotification } = useNotifications();
  const [cloning, setCloning] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const clone = async (discardConfirmed: boolean) => {
    setConfirming(false);
    setCloning(true);
    try {
      const res = await api.cloneActivity(activityID);
      const path = `/h5p/${res.data.activity.activityID}/edit`;
      if (discardConfirmed) beforeLeave?.();
      if (reload) window.location.assign(path);
      else history.push(path);
    } catch {
      addNotification({ type: "error", message: "This activity could not be cloned. Try again in a moment." });
    } finally {
      // The user can cancel the leave warning and stay on this page.
      setCloning(false);
    }
  };
  const onClick = () => (unsavedChanges ? setConfirming(true) : clone(false));

  const confirmDialog = (
    <Dialog open={confirming} onClose={() => setConfirming(false)} size="sm">
      <Dialog.Header>
        <Dialog.Title>Clone without saving?</Dialog.Title>
        <Dialog.Description>
          The copy is made from the last saved version, and your unsaved changes here will be lost.
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.Footer>
        <Button variant="outline" onClick={() => setConfirming(false)}>
          Keep editing
        </Button>
        <Button variant="primary" onClick={() => clone(true)}>
          Clone
        </Button>
      </Dialog.Footer>
    </Dialog>
  );

  return (
    <>
      {iconOnly ? (
        <IconButton
          aria-label="Clone activity"
          variant="outline"
          size={size}
          icon={<IconGitFork size={16} />}
          onClick={onClick}
          loading={cloning}
        />
      ) : (
        <Button
          variant="outline"
          size={size}
          fullWidth={fullWidth}
          className={className}
          icon={<IconGitFork size={16} />}
          onClick={onClick}
          loading={cloning}
        >
          Clone
        </Button>
      )}
      {confirmDialog}
    </>
  );
};

export default CloneActivityButton;
