import { Dropdown, SemanticICONS } from "semantic-ui-react";
import { GenericKeyTextValueObj } from "../../../types";

const DROPDOWN_CLASSES = "icon !min-w-44 !text-center";
const MENU_CLASSES = "max-w-sm max-h-52 overflow-y-auto overflow-x-clip";

interface CatalogFilterDropdownProps {
  icon: SemanticICONS;
  text: string;
  options: GenericKeyTextValueObj<string>[];
  filterKey: string;
  onFilterSelect: (type: string, value: string) => void;
  loading?: boolean;
  showClear?: boolean;
}

const CatalogFilterDropdown: React.FC<CatalogFilterDropdownProps> = ({
  icon,
  text,
  options,
  filterKey,
  onFilterSelect,
  loading,
}) => {

  // This function is used to intercept the filter select event
  // and if the value is empty, sends the reset_one action to the parent
  function interceptFilterSelect(type: string, value: string) {
    if (value === ""){
      onFilterSelect('reset_one', type);

    } else {
      onFilterSelect(type, value);
    }
  }

  return (
    <Dropdown
      text={text}
      floating
      icon={icon}
      labeled
      button
      className={DROPDOWN_CLASSES}
      loading={loading}
      basic
    >
      <Dropdown.Menu className={MENU_CLASSES}>
        {options.length > 0 &&
          options.map((option) => (
            <Dropdown.Item
              key={option.key}
              onClick={() => interceptFilterSelect(filterKey, option.value)}
            >
              {option.text}
            </Dropdown.Item>
          ))}
        {options.length === 0 && (
          <Dropdown.Item>No options available</Dropdown.Item>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default CatalogFilterDropdown;
