import { Badge } from "@libretexts/davis-react";
import { IconCircleCheck, IconCircleDashed, IconLoader2, IconLock, IconWorld } from "@tabler/icons-react";
import { CIDDescriptor, Project, ProjectTag } from "../../../types";
import { capitalizeFirstLetter } from "../../util/HelperFunctions";

const STATUS_META: Record<string, { label: string; variant: "primary" | "success"; icon: JSX.Element }> = {
  available: { label: "Available", variant: "primary", icon: <IconCircleDashed size={13} aria-hidden="true" /> },
  open: { label: "In progress", variant: "success", icon: <IconLoader2 size={13} aria-hidden="true" /> },
  completed: { label: "Completed", variant: "success", icon: <IconCircleCheck size={13} aria-hidden="true" /> },
};

export const getProjectStatusLabel = (status: string) =>
  STATUS_META[status]?.label ?? capitalizeFirstLetter(status);

export const getProjectVisibilityLabel = (visibility: string) => capitalizeFirstLetter(visibility);

export const ProjectStatusBadge = ({ status }: { status: string }) => {
  const meta = STATUS_META[status];
  return (
    <Badge
      label={getProjectStatusLabel(status)}
      variant={meta?.variant ?? "default"}
      icon={meta?.icon}
    />
  );
};

export const ProjectVisibilityBadge = ({ visibility }: { visibility: string }) => (
  <Badge
    label={getProjectVisibilityLabel(visibility)}
    variant={visibility === "public" ? "success" : "default"}
    icon={
      visibility === "public" ? (
        <IconWorld size={13} aria-hidden="true" />
      ) : (
        <IconLock size={13} aria-hidden="true" />
      )
    }
  />
);

// GET /project flattens tags to titles and C-IDs to descriptors, despite the declared types.
export const tagLabel = (tag: ProjectTag | string) =>
  typeof tag === "string" ? tag : tag.title ?? "";
export const cidLabel = (cid: CIDDescriptor | string) =>
  typeof cid === "string" ? cid : cid.descriptor;

export const hasSourceProperties = (project: Project) =>
  !!(project.author || project.license?.sourceURL || project.license?.name);
