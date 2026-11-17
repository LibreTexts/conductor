import { Button, Menu } from "@libretexts/davis-react";
import { IconEdit, IconUsers } from "@tabler/icons-react";
import { ProjectPermissions } from "../../../hooks/useProjectPermissions";

interface ProjectActionsBarProps {
  permissions: ProjectPermissions;
  isFlagged: boolean;
  onEditProperties: () => void;
  onManageTeam: () => void;
  onFlag: (mode: "set" | "clear") => void;
}

const ProjectActionsBar: React.FC<ProjectActionsBarProps> = ({
  permissions,
  isFlagged,
  onEditProperties,
  onManageTeam,
  onFlag,
}) => (
  <>
    {permissions.isMember && (
      <Button variant="primary" icon={<IconEdit size={15} />} onClick={onEditProperties}>
        Edit Properties
      </Button>
    )}
    {permissions.isAdmin && (
      <Button variant="outline" icon={<IconUsers size={15} />} onClick={onManageTeam}>
        Manage Team
      </Button>
    )}
    <Menu>
      <Menu.Button>
        <span className="flex items-center gap-1 text-sm font-medium px-1">More Tools</span>
      </Menu.Button>
      <Menu.Items className="w-[var(--button-width)]! min-w-0! py-0! overflow-hidden">
        {permissions.isMember ? (
          <Menu.Item onClick={() => onFlag(isFlagged ? "clear" : "set")}>
            {isFlagged ? "Clear Flag" : "Flag Project"}
          </Menu.Item>
        ) : (
          <Menu.Item disabled>
            <em>No actions available.</em>
          </Menu.Item>
        )}
      </Menu.Items>
    </Menu>
  </>
);

export default ProjectActionsBar;
