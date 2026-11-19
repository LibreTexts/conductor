import { Link } from "react-router-dom";
import { Button } from "@libretexts/davis-react";
import {
  IconChartBar,
  IconClipboardList,
  IconClock,
  IconFlag,
  IconFlagOff,
  IconPencil,
  IconUsers,
} from "@tabler/icons-react";
import { ProjectPermissions } from "../../../hooks/useProjectPermissions";
import PinProjectButton from "./PinProjectButton";

interface ProjectActionsBarProps {
  projectID: string;
  permissions: ProjectPermissions;
  isFlagged: boolean;
  isMiniRepo: boolean;
  hasAnalytics: boolean;
  onManageTeam: () => void;
  onFlag: (mode: "set" | "clear") => void;
}

type Tool = { key: string; label: string; icon: JSX.Element } & (
  | { to: string; onClick?: never }
  | { onClick: () => void; to?: never }
);

// Labels collapse to icon-only 44px buttons on mobile but stay in the accessible name.
const TOOL_BUTTON_CLASSES = "max-sm:h-11! max-sm:px-0!";
const TOOL_ICON_CLASSES = "max-sm:mr-0!";

/**
 * Header actions. Desktop: a wrapping row led by the primary Edit properties.
 * Mobile: full-width Edit properties beside an icon-only Pin, over a row of
 * icon-only tool buttons.
 */
const ProjectActionsBar: React.FC<ProjectActionsBarProps> = ({
  projectID,
  permissions,
  isFlagged,
  isMiniRepo,
  hasAnalytics,
  onManageTeam,
  onFlag,
}) => {
  const basePath = `/projects/${projectID}`;
  const tools: Tool[] = [
    ...(permissions.isAdmin
      ? [{ key: "team", label: "Manage Team", icon: <IconUsers size={16} />, onClick: onManageTeam }]
      : []),
    ...(hasAnalytics
      ? [{ key: "analytics", label: "Analytics", icon: <IconChartBar size={16} />, to: `${basePath}/analytics` }]
      : []),
    { key: "timeline", label: "Timeline", icon: <IconClock size={16} />, to: `${basePath}/timeline` },
    ...(!isMiniRepo
      ? [{ key: "peerreview", label: "Peer Review", icon: <IconClipboardList size={16} />, to: `${basePath}/peerreview` }]
      : []),
    ...(permissions.isMember
      ? [
          {
            key: "flag",
            label: isFlagged ? "Clear Flag" : "Flag Project",
            icon: isFlagged ? <IconFlagOff size={16} /> : <IconFlag size={16} />,
            onClick: () => onFlag(isFlagged ? "clear" : "set"),
          },
        ]
      : []),
  ];

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex gap-2">
        {permissions.isMember && (
          <Button
            as={Link}
            to={`${basePath}/properties`}
            variant="primary"
            icon={<IconPencil size={16} />}
            className="max-sm:h-11! max-sm:flex-1"
          >
            Edit Properties
          </Button>
        )}
        <PinProjectButton projectID={projectID} compact className="sm:hidden!" />
      </div>
      <div className="grid auto-cols-fr grid-flow-col gap-2 sm:flex sm:flex-wrap">
        {tools.map((tool) =>
          tool.to ? (
            <Button
              key={tool.key}
              as={Link}
              to={tool.to}
              variant="outline"
              icon={tool.icon}
              className={TOOL_BUTTON_CLASSES}
              iconClassName={TOOL_ICON_CLASSES}
            >
              <span className="max-sm:sr-only">{tool.label}</span>
            </Button>
          ) : (
            <Button
              key={tool.key}
              variant="outline"
              icon={tool.icon}
              className={TOOL_BUTTON_CLASSES}
              iconClassName={TOOL_ICON_CLASSES}
              onClick={tool.onClick}
            >
              <span className="max-sm:sr-only">{tool.label}</span>
            </Button>
          )
        )}
      </div>
    </div>
  );
};

export default ProjectActionsBar;
