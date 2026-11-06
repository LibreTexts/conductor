import { Button } from "@libretexts/davis-react";
import { iconButton } from "@libretexts/davis-core";
import { IconInfoCircle } from "@tabler/icons-react";
import useDocLinks from "../../hooks/useDocLinks";
import { DocLinkKey } from "../../utils/docLinks";

type ConsultInsightButtonProps = {
  iconOnly?: boolean;
} & (
  | { docKey: DocLinkKey; href?: never }
  | { href: string; docKey?: never }
);

const ACCESSIBLE_NAME = "Consult Insight Knowledge Base (opens in new tab)";

/**
 * A single link to an Insight article. It used to be a link wrapping an
 * IconButton, which put two focus stops (a link and a button) on one control;
 * the icon-only form now styles the link itself with Davis's icon-button
 * recipe so it looks the same but is one element.
 *
 * Prefer `docKey` over `href`: the URL then follows the article through slug
 * renames, and the button hides if the article is gone or unpublished.
 */
const ConsultInsightButton: React.FC<ConsultInsightButtonProps> = ({
  href: hrefProp,
  docKey,
  iconOnly = true,
}) => {
  const { docLinks } = useDocLinks({ enabled: !!docKey });
  const href = docKey ? docLinks[docKey] : hrefProp;
  if (!href) return null;

  if (iconOnly) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ACCESSIBLE_NAME}
        className={iconButton({ variant: "secondary", size: "md" })}
      >
        <IconInfoCircle size={18} aria-hidden="true" />
      </a>
    );
  }

  return (
    <Button
      as="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      icon={<IconInfoCircle size={16} aria-hidden="true" />}
      variant="secondary"
    >
      Consult Insight
      <span className="sr-only"> Knowledge Base (opens in new tab)</span>
    </Button>
  );
};

export default ConsultInsightButton;
