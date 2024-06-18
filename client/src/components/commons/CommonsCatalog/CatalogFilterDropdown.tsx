import { SemanticICONS } from "semantic-ui-react";
import { GenericKeyTextValueObj } from "../../../types";
import { useEffect, useRef, useState } from "react";

const DROPDOWN_CLASSES = "icon !min-w-44 !text-center h-[36px]";
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // This function is used to intercept the filter select event
  // and if the value is empty, sends the reset_one action to the parent
  function interceptFilterSelect(type: string, value: string) {
    if (value === "") {
      onFilterSelect("reset_one", type);
    } else {
      onFilterSelect(type, value);
    }
  }

  // This useEffect is used to close the dropdown menu when the user clicks outside of it
  useEffect(() => {
    document.addEventListener("click", (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    });

    return () => {
      document.removeEventListener("click", () => {});
    };
  });

  return (
    <div
      role="listbox"
      aria-expanded="false"
      className={`ui basic button floating labeled dropdown ${DROPDOWN_CLASSES}`}
      tabIndex={0}
      onClick={() => setMenuOpen(!menuOpen)}
      aria-busy={loading}
      ref={dropdownRef}
      style={{ position: "relative" }}
    >
      <div
        aria-atomic="true"
        aria-live="polite"
        role="alert"
        className="divider text"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span>{text}</span>
        {text.includes(" - ") && (
          <span
            className="font-bold text-black"
            style={{
              cursor: "pointer",
              marginLeft: "auto", // Push the clear icon to the right
              zIndex: 1000,
              paddingLeft: "0.5rem",
              marginRight: "-10px",
            }}
            onClick={(e) => {
              e.stopPropagation(); // Prevent dropdown from toggling when clear icon is clicked
              interceptFilterSelect(filterKey, "");
            }}
          >
            X
          </span>
        )}
      </div>
      <i aria-hidden="true" className={icon + " icon"}></i>
      <div
        className={`menu transition ${MENU_CLASSES}`}
        style={{ display: menuOpen ? "block" : "none" }}
        aria-expanded={menuOpen}
      >
        {options.length > 0 &&
          options.map((option) => (
            <div
              key={option.key}
              role="option"
              className="item"
              onClick={() => interceptFilterSelect(filterKey, option.value)}
            >
              <span className="text">{option.text}</span>
            </div>
          ))}
        {options.length === 0 && (
          <div role="option" className="item">
            <span className="text">No options available</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CatalogFilterDropdown;
