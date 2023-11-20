import { Label, LabelProps, SemanticCOLORS } from "semantic-ui-react";

interface TicketStatusLabelProps extends LabelProps {
  status: "open" | "in_progress" | "closed";
}

const TicketStatusLabel: React.FC<TicketStatusLabelProps> = ({
  status,
  ...rest
}) => {
  const color = (): SemanticCOLORS => {
    switch (status) {
      case "open":
        return "blue";
      case "in_progress":
        return "yellow";
      case "closed":
        return "green";
      default:
        return "grey";
    }
  };

  return (
    <Label color={color()} basic {...rest}>
      {status === "open"
        ? "Open"
        : status === "in_progress"
        ? "In Progress"
        : "Closed"}
    </Label>
  );
};

export default TicketStatusLabel;
