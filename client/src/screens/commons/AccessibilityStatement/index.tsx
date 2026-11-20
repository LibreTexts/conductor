import { Heading, Link, Text } from "@libretexts/davis-react";
import { useTypedSelector } from "../../../state/hooks";
import useDocumentTitle from "../../../hooks/useDocumentTitle";
import KBRenderer from "../../../components/kb/KBRenderer";
import PageNotFound from "../../../components/util/PageNotFound";

/**
 * The organization's accessibility statement, set by campus admins in Control Panel.
 */
const CommonsAccessibilityStatement = () => {
  const org = useTypedSelector((state) => state.org);
  useDocumentTitle(`${org.name} | Accessibility Statement`, true);

  if (!org.accessibilityStatement) return <PageNotFound />;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8">
      <Heading level={1}>{org.name} Accessibility Statement</Heading>
      <Text size="sm" as="p" className="mb-4" color="muted">
        This accessibility statement is managed by {org.name} and has not been
        evaluated by LibreTexts. It does not reflect the accessibility status of
        LibreTexts resources and applications. For LibreTexts' accessibility
        information, please see{" "}
        <Link href="https://commons.libretexts.org/accessibility" className="text-sm!">
          https://commons.libretexts.org/accessibility
        </Link>
        .
      </Text>
      <KBRenderer content={org.accessibilityStatement} />
    </div>
  );
};

export default CommonsAccessibilityStatement;
