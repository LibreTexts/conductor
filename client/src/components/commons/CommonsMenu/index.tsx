import { Link } from "react-router-dom";
import { useTypedSelector } from "../../../state/hooks";
import { Menu, SemanticWIDTHS } from "semantic-ui-react";
import Breakpoint from "../../util/Breakpoints";
import "./CommonsMenu.css";

/**
 * A menu providing navigation around the Commons interfaces.
 */
const CommonsMenu = ({ activeItem = "catalog" }: { activeItem?: string }) => {
  // Global State
  const org = useTypedSelector((state) => state.org);

  const menuProps = {
    secondary: true,
    pointing: true,
    fluid: true,
    widths:
      org.orgID === "libretexts"
        ? (5 as SemanticWIDTHS)
        : (2 as SemanticWIDTHS),
    id: "commons-menu",
    stackable: true,
  };
  const mobileMenuProps = {
    ...menuProps,
    pointing: false,
  };

  /**
   * Generates the menu options to present based on the instance's configured Organization.
   *
   * @returns {object[]} An array of objects containing identifier keys and corresponding UI text.
   */
  const generateMenuOptions = () => {
    const catalog = { key: "catalog", text: "Catalog" };
    const collections = { key: "collections", text: "Collections" };
    if (org.orgID === "libretexts") {
      return [
        catalog,
        collections,
        { key: "homework", text: "Homework" },
        { key: "underdevelopment", text: "Under Development" },
      ];
    }
    return [catalog, collections];
  };

  /**
   * Renders the available menu options for use in the menu.
   *
   * @returns {JSX.Element}} The rendered menu options.
   */
  const MenuOptions = (): JSX.Element => {
    const options = generateMenuOptions();
    return (
      <>
        {options.map((item) => (
          <Menu.Item
            key={item.key}
            name={item.key}
            active={activeItem === item.key}
            className="commons-menu-item"
            as={Link}
            to={`/${item.key}`}
          >
            {item.text}
          </Menu.Item>
        ))}
      </>
    );
  };

  return (
    <>
      <Breakpoint name="tabletOrDesktop">
        <Menu {...menuProps}>
          <MenuOptions />
        </Menu>
      </Breakpoint>
      <Breakpoint name="mobile">
        <Menu {...mobileMenuProps}>
          <MenuOptions />
        </Menu>
      </Breakpoint>
    </>
  );
};

export default CommonsMenu;
