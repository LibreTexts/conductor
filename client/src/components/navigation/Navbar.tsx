import { useEffect, useState } from "react";
import { Link, useLocation, useHistory } from "react-router-dom";
import { Menu, Image, Dropdown, Icon, Button, Form } from "semantic-ui-react";
import { getLibGlyphURL } from "../util/LibraryOptions.js";
import AuthHelper from "../util/AuthHelper.js";
import Breakpoint from "../util/Breakpoints.js";
import withUserStateDependency from "../../enhancers/withUserStateDependency.jsx";
import "./Navbar.css";
import { useTypedSelector } from "../../state/hooks.js";
import { LIBRARIES } from "../../utils/constants.js";

const Navbar: React.FC = () => {
  // Global State, Location, and Error Handling
  const location = useLocation();
  const history = useHistory();
  const user = useTypedSelector((state) => state.user);
  const org = useTypedSelector((state) => state.org);

  // UI
  const [activeItem, setActiveItem] = useState("");
  const [searchInput, setSearchInput] = useState("");

  /**
   * Subscribe to changes to location
   * and update the Navbar with the
   * active page.
   */
  useEffect(() => {
    const currentPath = location.pathname;
    if (currentPath.includes("/home")) {
      setActiveItem("home");
    } else if (currentPath.includes("/projects")) {
      setActiveItem("projects");
    } else if (currentPath.includes("analytics")) {
      setActiveItem("analytics");
    } else if (currentPath.includes("/search")) {
      // Set the search query in the UI if the URL was visited directly
      if (searchInput === "") {
        const urlParams = new URLSearchParams(location.search);
        const urlQuery = urlParams.get("query");
        if (typeof urlQuery === "string" && urlQuery.length > 0) {
          setSearchInput(urlQuery);
        }
      }
    } else {
      setActiveItem("");
    }
  }, [location, setActiveItem, setSearchInput]);

  /**
   * Ends the user's session.
   */
  const logOut = () => {
    AuthHelper.logout();
  };

  /**
   * Process the search string and, if non-empty, navigate to the Search Results page.
   */
  const handlePerformSearch = () => {
    if (searchInput.trim() !== "") {
      history.push(`/search?query=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  if (!user.isAuthenticated) {
    return null;
  }

  return (
    <Menu className="nav-menu" secondary>
      <Menu.Item
        as={Link}
        to="/home"
        header
        name="home"
        id="nav-logo-item"
        onClick={(_e, data) => {
          setActiveItem(data.name ?? "");
        }}
      >
        {org.orgID !== "libretexts" ? (
          <Image src={org.mediumLogo} id="nav-org-logo" />
        ) : (
          <Image
            src="https://cdn.libretexts.net/Logos/conductor_full.png"
            id="nav-logo"
            alt="LibreTexts Conductor"
          />
        )}
      </Menu.Item>
      <Menu.Item
        name="home"
        as={Link}
        to="/home"
        active={activeItem === "home"}
        onClick={(_e, data) => {
          setActiveItem(data.name ?? "");
        }}
      />
      <Menu.Item
        name="projects"
        as={Link}
        to="/projects"
        active={activeItem === "projects"}
        onClick={(_e, data) => {
          setActiveItem(data.name ?? "");
        }}
      />
      <Menu.Item
        name="analytics"
        as={Link}
        to="/analytics"
        active={activeItem === "analytics"}
        onClick={(_e, data) => setActiveItem(data.name ?? "")}
      />
      <Breakpoint name="desktop">
        <Menu.Menu position="right">
          <Menu.Item>
            <Form onSubmit={handlePerformSearch} className="nav-search-form">
              <Form.Input
                type="text"
                placeholder="Search..."
                onChange={(_e, { value }) => setSearchInput(value)}
                value={searchInput}
                action
                className="nav-search-input"
              >
                <input />
                {searchInput.length > 0 && (
                  <Button
                    icon
                    type="reset"
                    onClick={() => setSearchInput("")}
                    aria-label="Clear Search Input"
                  >
                    <Icon name="x" />
                  </Button>
                )}
                <Button
                  type="submit"
                  color="blue"
                  icon
                  aria-label="Perform Search"
                >
                  <Icon name="search" />
                </Button>
              </Form.Input>
            </Form>
          </Menu.Item>
          <Menu.Item>
            <Icon name="book" />
            <Dropdown inline text="Libraries">
              <Dropdown.Menu>
                {LIBRARIES.map((library) => (
                  <Dropdown.Item
                    as="a"
                    href={library.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={library.shortName}
                  >
                    <Image
                      src={getLibGlyphURL(library.shortName)}
                      className="nav-lib-glyph"
                    />
                    {library.longName}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
          </Menu.Item>
          <Menu.Item>
            <Icon name="wrench" />
            <Dropdown inline text="Tools">
              <Dropdown.Menu>
                <Dropdown.Item
                  as="a"
                  href="https://adapt.libretexts.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="pencil" />
                  ADAPT Homework System
                </Dropdown.Item>
                <Dropdown.Item
                  as="a"
                  href="https://chat.libretexts.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="discord" />
                  Chat
                </Dropdown.Item>
                <Dropdown.Item
                  as="a"
                  href="https://groups.io/g/Libretexts-ConstructionForum"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="rss" />
                  Construction Forum
                </Dropdown.Item>
                <Dropdown.Item
                  as="a"
                  href="https://commons.libretexts.org/harvestrequest"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="plus" />
                  Harvesting Request
                </Dropdown.Item>
                <Dropdown.Item
                  as="a"
                  href="https://jupyter.libretexts.org/hub/login"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="server" />
                  JupyterHub
                </Dropdown.Item>
                <Dropdown.Item
                  as="a"
                  href="https://studio.libretexts.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="puzzle" />
                  LibreStudio
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </Menu.Item>
          <Menu.Item as={Link} to="/">
            <Icon name="handshake outline" className="mr-05e" />
            <strong>Commons</strong>
          </Menu.Item>
          <Menu.Item>
            <Image src={`${user.avatar}`} avatar />
            <Dropdown inline text={user.firstName + " " + user.lastName}>
              <Dropdown.Menu>
                <Dropdown.Item as={Link} to="/account">
                  <Icon name="settings" />
                  Settings
                </Dropdown.Item>
                <Dropdown.Item onClick={logOut}>
                  <Icon name="log out" />
                  Log out
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </Menu.Item>
        </Menu.Menu>
      </Breakpoint>
      <Breakpoint name="mobileOrTablet">
        <Menu.Menu position="right">
          <Dropdown
            item
            as={Button}
            icon="align justify"
            className="icon"
            upward={false}
            size="medium"
          >
            <Dropdown.Menu>{/* TODO: Finish mobile menu */}</Dropdown.Menu>
          </Dropdown>
        </Menu.Menu>
      </Breakpoint>
    </Menu>
  );
};

export default withUserStateDependency(Navbar);
