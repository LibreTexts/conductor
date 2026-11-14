import { IconButton } from "@libretexts/davis-react";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import CopyButton from "./CopyButton";
import { useNotifications } from "../../context/NotificationContext";

/** Copy-to-clipboard affordance. Focusable, unlike the `<Icon onClick>` it replaces. */
const CopyValueButton: React.FC<{
  value: string;
  label: string;
  tooltipPosition?: "top" | "bottom" | "left" | "right";
}> = ({ value, label, tooltipPosition = "right" }) => {
  const { addNotification } = useNotifications();
  return (
    <CopyButton val={value}>
      {({ copied, copy }) => (
        <IconButton
          icon={copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
          iconClassName="items-center justify-center"
          aria-label={label}
          tooltip={label}
          tooltipPosition={tooltipPosition}
          variant="ghost"
          size="sm"
          onClick={() => {
            copy();
            addNotification({
              message: "Copied to clipboard!",
              type: "success",
              duration: 2000,
            });
          }}
        />
      )}
    </CopyButton>
  );
};

export default CopyValueButton;
