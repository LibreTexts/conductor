import { Badge } from "@libretexts/davis-react";

const STATUS_BADGES = {
  completed: { label: "Completed", variant: "success" },
  inprogress: { label: "In Progress", variant: "primary" },
  available: { label: "Available", variant: "default" },
} as const;

const TaskStatusBadge = ({ status }: { status?: string }) => {
  const badge =
    STATUS_BADGES[status as keyof typeof STATUS_BADGES] ?? STATUS_BADGES.available;
  return (
    <Badge
      label={badge.label}
      variant={badge.variant}
      size="sm"
      className="whitespace-nowrap"
    />
  );
};

export default TaskStatusBadge;
