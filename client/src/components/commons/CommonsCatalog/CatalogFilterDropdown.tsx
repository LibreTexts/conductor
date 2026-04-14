import { Menu } from "@libretexts/davis-react";
import { GenericKeyTextValueObj } from "../../../types";
import { IconFile, IconFilter, IconGavel, IconProgressCheck, IconSchool, IconTags, IconUser, IconUsers, IconWorld } from "@tabler/icons-react";

const ICON_MAP: Record<string, React.ReactNode> = {
  school: <IconSchool size={16} />,
  filter: <IconFilter size={16} />,
  globe: <IconWorld size={16} />,
  legal: <IconGavel size={16} />,
  user: <IconUser size={16} />,
  users: <IconUsers size={16} />,
  file: <IconFile size={16} />,
  status: <IconProgressCheck size={16} />,
  tags: <IconTags size={16} />,
};

interface CatalogFilterDropdownProps {
  icon?: string;
  text: string;
  options: GenericKeyTextValueObj<string>[];
  filterKey: string;
  onFilterSelect: (type: string, value: string) => void;
  loading?: boolean;
}

const CatalogFilterDropdown: React.FC<CatalogFilterDropdownProps> = ({
  icon,
  text,
  options,
  filterKey,
  onFilterSelect,
  loading,
}) => {
  const isActive = text.includes(" - ");

  function interceptFilterSelect(type: string, value: string) {
    if (value === "") {
      onFilterSelect("reset_one", type);
    } else {
      onFilterSelect(type, value);
    }
  }

  return (
    <Menu>
      <Menu.Button
        className="!min-w-44 !h-[36px] !text-sm"
        aria-busy={loading}
        aria-label={text}
      >
        {icon && ICON_MAP[icon]}
        <span className="truncate">{text}</span>
        {isActive && (
          <span
            className="ml-auto pl-1 font-bold text-gray-700 hover:text-black"
            onClick={(e) => {
              e.stopPropagation();
              interceptFilterSelect(filterKey, "");
            }}
            aria-label="Clear filter"
          >
            ✕
          </span>
        )}
      </Menu.Button>
      <Menu.Items className="max-h-52 overflow-y-auto overflow-x-clip" width="md">
        {options.length === 0 && (
          <Menu.Item disabled>No options available</Menu.Item>
        )}
        {options.map((option) => (
          <Menu.Item
            key={option.key}
            onClick={() => interceptFilterSelect(filterKey, option.value)}
          >
            {option.text}
          </Menu.Item>
        ))}
      </Menu.Items>
    </Menu>
  );
};

export default CatalogFilterDropdown;
