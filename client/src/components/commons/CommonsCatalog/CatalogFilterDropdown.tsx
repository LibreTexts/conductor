import { Menu } from "@libretexts/davis-react";
import { GenericKeyTextValueObj } from "../../../types";

interface CatalogFilterDropdownProps {
  icon?: string; // kept for call-site compatibility, not used
  text: string;
  options: GenericKeyTextValueObj<string>[];
  filterKey: string;
  onFilterSelect: (type: string, value: string) => void;
  loading?: boolean;
}

const CatalogFilterDropdown: React.FC<CatalogFilterDropdownProps> = ({
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
