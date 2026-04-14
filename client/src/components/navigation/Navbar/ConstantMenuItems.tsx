import { Link } from "react-router-dom";

interface ConstantMenuItemsProps {
  activeItem: string;
  setActiveItem: React.Dispatch<React.SetStateAction<string>>;
}

const base =
  "flex items-center px-3 py-2 text-base font-medium rounded-md transition-colors min-h-[44px] " +
  "hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const active = "text-primary font-semibold border-b-2 border-primary";
const inactive = "text-text hover:text-primary";

/**
 * Menu items that are always present in the Navbar.
 */
const ConstantMenuItems: React.FC<ConstantMenuItemsProps> = ({
  activeItem,
  setActiveItem,
}) => (
  <>
    <Link
      to="/home"
      className={`${base} ${activeItem === "home" ? active : inactive}`}
      aria-current={activeItem === "home" ? "page" : undefined}
      onClick={() => setActiveItem("home")}
    >
      Home
    </Link>
    <Link
      to="/projects"
      className={`${base} ${activeItem === "projects" ? active : inactive}`}
      aria-current={activeItem === "projects" ? "page" : undefined}
      onClick={() => setActiveItem("projects")}
    >
      My Projects
    </Link>
  </>
);

export default ConstantMenuItems;
