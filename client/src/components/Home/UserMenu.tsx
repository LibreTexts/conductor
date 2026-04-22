import { Avatar, Button, Heading } from "@libretexts/davis-react";
import {
  IconBell,
  IconBriefcase,
  IconChevronDown,
  IconChevronUp,
  IconClipboardCheck,
  IconDashboard,
  IconExternalLink,
  IconPlus,
  IconTicket,
} from "@tabler/icons-react";
import AccountStatus from "../util/AccountStatus";
import { Link } from "react-router-dom";
import { useTypedSelector } from "../../state/hooks";
import { useState } from "react";
import useClientConfig from "../../hooks/useClientConfig";

type NavItemProps = {
  label: string;
  icon: React.ReactNode;
} & (
  | { href: string; to?: never }
  | { to: string; href?: never }
);

const NavItem: React.FC<NavItemProps> = ({ label, icon, href, to }) => {
  const base =
    "flex justify-between items-center px-4 py-3 text-gray-800 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0";

  if (to) {
    return (
      <Link to={to} className={base}>
        <span>{label}</span>
        <span className="text-gray-500">{icon}</span>
      </Link>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={base}>
      <span>{label}</span>
      <span className="text-gray-500">{icon}</span>
    </a>
  );
};

const NavList: React.FC<{ showUserDetail: boolean }> = ({ showUserDetail }) => {
  const user = useTypedSelector((state) => state.user);
  const { clientConfig } = useClientConfig();

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {showUserDetail && (
        <div className="flex flex-col items-center py-6 px-4 border-b border-gray-200">
          <Avatar src={user.avatar} alt={user.firstName} size="xl" />
          <Heading level={3} className="mt-3 text-center">
            Welcome,
            <br />
            {user.firstName}
          </Heading>
          <div className="mt-2">
            <AccountStatus verifiedInstructor={user.verifiedInstructor} />
          </div>
        </div>
      )}
      {(user.isSuperAdmin || user.isCampusAdmin || user.isSupport) && (
        <NavItem label="Control Panel" icon={<IconDashboard size={20} />} to="/controlpanel" />
      )}
      <NavItem label="My Alerts" icon={<IconBell size={20} />} to="/alerts" />
      <NavItem label="My Support Tickets" icon={<IconTicket size={20} />} to="/support/dashboard" />
      <NavItem
        label="Harvesting Request"
        icon={<IconPlus size={20} />}
        href="https://commons.libretexts.org/harvestrequest"
      />
      <NavItem
        label="Adoption Report"
        icon={<IconClipboardCheck size={20} />}
        href="https://commons.libretexts.org/adopt"
      />
      {clientConfig?.instructor_verification_url && (
        <NavItem
          label="Instructor Verification Request"
          icon={<IconBriefcase size={20} />}
          href={clientConfig.instructor_verification_url}
        />
      )}
      <NavItem
        label="LibreTexts.org"
        icon={<IconExternalLink size={20} />}
        href="https://libretexts.org"
      />
    </div>
  );
};

const UserMenu: React.FC = () => {
  const user = useTypedSelector((state) => state.user);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div>
      <div className="hidden xl:block">
        <NavList showUserDetail />
      </div>
      <div className="xl:hidden border border-gray-200 rounded-lg bg-white">
        <div className="flex justify-between items-center p-3">
          <div className="flex items-center gap-2">
            <Avatar src={user.avatar} alt={user.firstName} size="md" />
            <h1 className="text-xl font-semibold">Welcome, {user.firstName}</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMenuOpen(!menuOpen)}
            icon={menuOpen ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
          />
        </div>
        {menuOpen && (
          <div className="border-t border-gray-200">
            <NavList showUserDetail={false} />
          </div>
        )}
      </div>
    </div>
  );
};

export default UserMenu;
