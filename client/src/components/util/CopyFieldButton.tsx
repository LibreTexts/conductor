import { Button, VisuallyHidden } from "@libretexts/davis-react";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import CopyButton from "./CopyButton";

/**
 * A ghost "Copy" button for a labeled value, such as an ID or an attribution.
 * Its accessible name says what it copies, and a polite live region announces
 * the copy, since the visible label changes only briefly.
 */
const CopyFieldButton = ({
  value,
  label,
  size = "sm",
}: {
  value: string;
  label: string;
  size?: "sm" | "md";
}) => (
  <CopyButton val={value} timeout={2000}>
    {({ copied, copy }) => (
      <>
        <Button
          variant="ghost"
          size={size}
          icon={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          onClick={() => copy()}
          aria-label={copied ? `${label} copied` : `Copy ${label}`}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
        <VisuallyHidden aria-live="polite">{copied ? `${label} copied to clipboard` : ""}</VisuallyHidden>
      </>
    )}
  </CopyButton>
);

export default CopyFieldButton;
