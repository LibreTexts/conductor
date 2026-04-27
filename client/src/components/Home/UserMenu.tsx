import {
  Button,
  Header,
  Icon,
  Image,
  Menu,
  Segment,
} from "semantic-ui-react";
import AccountStatus from "../util/AccountStatus";
import { Link } from "react-router-dom";
import { useTypedSelector } from "../../state/hooks";
import { getCentralAuthInstructorURL } from "../../utils/centralIdentityHelpers";
import { useState } from "react";

const UserMenu: React.FC = () => {
  const user = useTypedSelector((state) => state.user);
  const [menuOpen, setMenuOpen] = useState(false);

  const SubMenu = ({ showUserDetail }: { showUserDetail: boolean }) => (
    <Menu vertical fluid className="w-full">
      {showUserDetail && (
        <Menu.Item>
          <Header as="h1">
            <Image circular src={`${user.avatar}`} className="menu-avatar" />
            <br />
            Welcome,
            <br />
            {user.firstName}
          </Header>
          <div className="flex">
            <AccountStatus verifiedInstructor={user.verifiedInstructor} />
          </div>
        </Menu.Item>
      )}
      {(user.isSuperAdmin || user.isCampusAdmin || user.isSupport) && (
        <Menu.Item as={Link} to="/controlpanel">
          Control Panel
          <Icon name="dashboard" />
        </Menu.Item>
      )}
      <Menu.Item as={Link} to="/alerts">
        <Icon name="alarm" />
        My Alerts
      </Menu.Item>
      <Menu.Item as={Link} to="/support/dashboard">
        <Icon name="ticket" />
        My Support Tickets
      </Menu.Item>
      <Menu.Item
        href="https://commons.libretexts.org/harvestrequest"
        target="_blank"
        rel="noopener noreferrer"
      >
        Harvesting Request
        <Icon name="plus" />
      </Menu.Item>
      <Menu.Item
        href="https://commons.libretexts.org/adopt"
        target="_blank"
        rel="noopener noreferrer"
      >
        Adoption Report
        <Icon name="clipboard check" />
      </Menu.Item>
      <Menu.Item
        href={getCentralAuthInstructorURL()}
        target="_blank"
        rel="noopener noreferrer"
      >
        Instructor Verification<br></br> Request
        <Icon name="share alternate" />
      </Menu.Item>
      <Menu.Item
        href="https://libretexts.org"
        target="_blank"
        rel="noopener noreferrer"
      >
        LibreTexts.org
        <Icon name="external" />
      </Menu.Item>
    </Menu>
  );

  return (
    <div>
      <div className="hidden xl:flex">
        <SubMenu showUserDetail />
      </div>
      <div className="xl:hidden">
        <Segment>
          <div className="flex justify-between items-center">
            <div className="flex flex-row">
              <Image circular src={`${user.avatar}`} className="mb-1 w-16 mr-1" />
              <div className="flex flex-col">
                <h1 className="ml-1 text-2xl font-semibold">
                  Welcome, {user.firstName}
                </h1>
                <AccountStatus verifiedInstructor={user.verifiedInstructor} />
              </div>
            </div>
            <Button icon onClick={() => setMenuOpen(!menuOpen)}>
              <Icon name={menuOpen ? "caret up" : "caret down"} />
            </Button>
          </div>
          {menuOpen && <SubMenu showUserDetail={false} />}
        </Segment>
      </div>
    </div>
  );
};

export default UserMenu;
