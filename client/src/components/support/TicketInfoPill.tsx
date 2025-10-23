import {
  IconAlertTriangle,
  IconCircleCheck,
  IconClock,
  IconMessage,
  IconUserQuestion,
} from "@tabler/icons-react";
import classNames from "classnames";
import { getPrettySupportTicketStatus } from "../../utils/supportHelpers";

const Pill = (props: {
  backgroundColor: string;
  textColor: string;
  icon: React.ReactNode;
  text: string;
  className?: string;
}) => {
  return (
    <div
      className={classNames(
        "flex flex-row items-center capitalize px-4 py-1 rounded-full text-xs font-semibold w-fit max-w-[160px]",
        props.backgroundColor,
        props.textColor,
        props.className
      )}
    >
      {props.icon}
      <span className="inline-block">{props.text}</span>
    </div>
  );
};

export const TicketPriorityPill: React.FC<{
  priority: string;
  className?: string;
}> = ({ priority, className }) => {
  const iconColor = () => {
    switch (priority) {
      case "low":
        return "text-green-600";
      case "medium":
        return "text-yellow-800";
      case "high":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const backgroundAndTextColor = () => {
    switch (priority) {
      case "low":
        return ["bg-green-100", "text-green-800"];
      case "medium":
        return ["bg-yellow-200", "text-yellow-800"];
      case "high":
        return ["bg-red-100", "text-red-800"];
      default:
        return ["bg-gray-100", "text-gray-800"];
    }
  };

  return (
    <Pill
      backgroundColor={backgroundAndTextColor()[0]}
      textColor={backgroundAndTextColor()[1]}
      text={priority}
      icon={
        <IconAlertTriangle
          className={`w-4 h-4 inline-block mr-1 ${iconColor()}`}
        />
      }
      className={className}
    />
  );
};

export const TicketStatusPill: React.FC<{
  status: string;
  className?: string;
}> = ({ status, className }) => {
  const StatusIcon = () => {
    const iconClasses = "w-4 h-4 inline-block mr-1";
    switch (status) {
      case "open":
        return <IconUserQuestion className={iconClasses} />;
      case "in_progress":
        return <IconClock className={iconClasses} />;
      case "awaiting_requester":
        return <IconClock className={iconClasses} />;
      case "closed":
        return <IconCircleCheck className={iconClasses} />;
      default:
        return <IconMessage className={iconClasses} />;
    }
  };

  const getBackgroundAndTextColor = () => {
    switch (status) {
      case "open":
        return ["bg-yellow-200", "text-yellow-800"];
      case "in_progress":
        return ["bg-blue-100", "text-blue-800"];
      case "awaiting_requester":
        return ["bg-orange-100", "text-orange-800"];
      case "closed":
        return ["bg-green-100", "text-green-800"];
      default:
        return ["bg-gray-100", "text-gray-800"];
    }
  };

  return (
    <Pill
      backgroundColor={getBackgroundAndTextColor()[0]}
      textColor={getBackgroundAndTextColor()[1]}
      text={getPrettySupportTicketStatus(status)}
      icon={<StatusIcon />}
      className={className}
    />
  );
};
