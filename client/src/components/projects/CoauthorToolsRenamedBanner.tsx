import { Alert } from "@libretexts/davis-react";
import useUXAcknowledgment from "../../hooks/useUXAcknowledgment";
import { UX_ACKNOWLEDGMENT_KEYS } from "../../utils/uxAcknowledgmentKeys";

/**
 * One-off notice that the Accessibility and AI Co-Author tools were renamed
 * and their buttons moved. Acknowledgments are permanent, so this also
 * has a hard cutoff: past it the notice is stale
 * for everyone, including users who never knew the old name.
 */
const NOTICE_EXPIRES = new Date("2026-11-30T00:00:00Z");

const CoauthorToolsRenamedBanner: React.FC = () => {
  const { shouldShow, acknowledge } = useUXAcknowledgment(
    UX_ACKNOWLEDGMENT_KEYS.COAUTHOR_TOOLS_MOVED
  );

  if (!shouldShow || new Date() > NOTICE_EXPIRES) return null;

  return (
    <Alert
      variant="info"
      message={'The Accessibility and AI Co-Author tools can now be found under Co-Authoring Tools as Accessibility Remediation and Metadata Editor, respectively.'}
      dismissible
      onDismiss={() => acknowledge("dismissed")}
      className="mb-4"
    />
  );
};

export default CoauthorToolsRenamedBanner;