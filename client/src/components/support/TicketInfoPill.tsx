import {
  IconAlertTriangle,
  IconCircleCheck,
  IconClock,
  IconMessage,
  IconUserQuestion,
  IconUserShare,
} from "@tabler/icons-react";
import { getPrettySupportTicketStatus } from "../../utils/supportHelpers";
import { Badge, type BadgeVariant } from "@libretexts/davis-react";

export const TicketPriorityPill: React.FC<{
  priority: string;
}> = ({ priority }) => {
  const variant = (): BadgeVariant => {
    switch (priority) {
      case "low":
        return "success"
      case "medium":
        return "warning";
      case "high":
        return "danger";
      default:
        return "success";
    }
  };

  return (
    <Badge
      variant={variant()}
      icon={<IconAlertTriangle size={16} />}
      label={priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : "Low"}
    />
  );
};

export const TicketStatusPill: React.FC<{
  status: string;
}> = ({ status }) => {
  const StatusIcon = () => {
    switch (status) {
      case "open":
        return <IconUserQuestion size={16} />;
      case "assigned":
        return <IconUserShare size={16} />;
      case "in_progress":
        return <IconClock size={16} />;
      case "awaiting_requester":
        return <IconClock size={16} />;
      case "closed":
        return <IconCircleCheck size={16} />;
      default:
        return <IconMessage size={16} />;
    }
  };

  const getVariant = (): BadgeVariant => {
    switch (status) {
      case "open":
        return "danger"
      case "assigned":
        return "default"
      case "in_progress":
        return "default"
      case "awaiting_requester":
        return "warning"
      case "closed":
        return "success"
      default:
        return "primary"
    }
  };

  return (
    <Badge
      variant={getVariant()}
      label={getPrettySupportTicketStatus(status)}
      icon={<StatusIcon />}
    />
  );
};
