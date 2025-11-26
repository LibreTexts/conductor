import Button, { ButtonProps } from "./Button";

type ConsultInsightButtonProps = ButtonProps & {
  href: string;
  iconOnly?: boolean;
};

const ConsultInsightButton: React.FC<ConsultInsightButtonProps> = ({
  href,
  iconOnly = false,
  ...props
}) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="h-full "
    >
      <Button
        {...props}
        icon="IconInfoCircle"
        variant="secondary"
        title="Consult Insight Knowledge Base"
        iconClassName="!size-6"
      >
        {iconOnly ? undefined : "Consult Insight"}
      </Button>
    </a>
  );
};

export default ConsultInsightButton;
