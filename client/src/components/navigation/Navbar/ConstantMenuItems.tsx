import { Link } from "react-router-dom";
import { Menu } from "semantic-ui-react";

/**
 * Menu items that are always present in the Navbar.
 */

interface ConstantMenuItemsProps {
  activeItem: string;
  setActiveItem: React.Dispatch<React.SetStateAction<string>>;
}

const ConstantMenuItems: React.FC<ConstantMenuItemsProps> = ({
  activeItem,
  setActiveItem,
}) => (
  <>
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
      name="my-projects"
      as={Link}
      to="/projects"
      active={activeItem === "projects"}
      onClick={(_e, data) => {
        setActiveItem(data.name ?? "");
      }}
    />
  </>
);

export default ConstantMenuItems;
