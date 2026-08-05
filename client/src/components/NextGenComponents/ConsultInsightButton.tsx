import { Button, IconButton } from "@libretexts/davis-react";
import { IconInfoCircle } from "@tabler/icons-react";

type ConsultInsightButtonProps = {
  href: string;
  iconOnly?: boolean;
};

const ConsultInsightButton: React.FC<ConsultInsightButtonProps> = ({
  href,
  iconOnly = true,
}) => {

  if (iconOnly) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="h-full "
      >
        <IconButton
          icon={<IconInfoCircle size={18} />}
          variant="secondary"
          aria-label="Consult Insight Knowledge Base"
          title="Consult Insight Knowledge Base"
          className="m-0" // This is a temp fix until Semantic UI is removed from the project. It's applying a margin to the button that isn't needed
        />
      </a>
    );
  }

  return (
    <Button
      as="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      icon={<IconInfoCircle size={16} />}
      variant="secondary"
      aria-label="Consult Insight Knowledge Base"
      title="Consult Insight Knowledge Base"
    >
      {iconOnly ? undefined : "Consult Insight"}
    </Button>
  );
};

export default ConsultInsightButton;
