import { Button, IconButton } from "@libretexts/davis-react";
import { IconPin, IconPinnedOff } from "@tabler/icons-react";
import { useModals } from "../../../context/ModalContext";
import { useIsProjectPinned, useUnpinProjectMutation } from "../../Home/PinnedProjects/hooks";
import AddPinnedProjectModal from "../../Home/PinnedProjects/AddPinnedProjectModal";

const PIN_MODAL_ID = "project-page-pin";

interface PinProjectButtonProps {
  projectID: string;
  /** 44px icon-only button for the mobile header. */
  compact?: boolean;
  className?: string;
}

const PinProjectButton = ({ projectID, compact = false, className }: PinProjectButtonProps) => {
  const { openModal, closeModal } = useModals();
  const isPinned = useIsProjectPinned(projectID);
  const unpinProject = useUnpinProjectMutation();

  const handlePinToggle = () => {
    if (!projectID) return;
    if (isPinned) {
      unpinProject.mutate(projectID);
      return;
    }
    openModal(
      <AddPinnedProjectModal
        show
        projectID={projectID}
        onClose={() => closeModal(PIN_MODAL_ID)}
      />,
      PIN_MODAL_ID
    );
  };

  const label = isPinned ? "Unpin Project" : "Pin Project";
  const icon = isPinned ? <IconPinnedOff size={16} /> : <IconPin size={16} />;

  if (compact) {
    return (
      <IconButton
        icon={icon}
        aria-label={label}
        variant="outline"
        className={`size-11! shrink-0 ${className ?? ""}`}
        onClick={handlePinToggle}
      />
    );
  }

  return (
    <Button variant="outline" size="sm" icon={icon} className={className} onClick={handlePinToggle}>
      {label}
    </Button>
  );
};

export default PinProjectButton;
