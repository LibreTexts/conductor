import { Link } from "react-router-dom";
import { useTypedSelector } from "../../../state/hooks";
import { Menu, SemanticCOLORS, SemanticWIDTHS } from "semantic-ui-react";
import Breakpoint from "../../util/Breakpoints";
import "./CommonsMenu.css";
import { sanitizeCustomColor } from "../../../utils/campusSettingsHelpers";

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
    style: {backgroundColor: `${org.primaryColor ? sanitizeCustomColor(org.primaryColor) : '#127BC4'}`}
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
    const opts: { key: string; text: string }[] = [];

    let collectionsText = org.collectionsDisplayLabel ?? 'Collections';
    const catalog = { key: "catalog", text: "Catalog" };
    opts.push(catalog);

    const collections = { key: "collections", text: `${collectionsText}` };
    if(org.showCollections === undefined || org.showCollections) { // Show by default if option not explicitly set to false
      opts.push(collections);
    }

    if (org.orgID === "libretexts") {
      opts.push(...[
        { key: "homework", text: "Homework" },
        { key: "underdevelopment", text: "Under Development" },
      ])
    }

    return opts;
  };

  const options = generateMenuOptions();
  if(options.length <= 1) return <></>; // Don't render if there's only one option

  const MenuOptions = (): JSX.Element => {
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
