import classNames from "classnames";
import { useState, useRef, useEffect } from "react";

export interface MultiSelectProps {
  className?: string;
  name: string;
  label: string;
  options: Array<{
    value: string;
    label: string;
  }>;
  placeholder?: string;
  error?: boolean;
  required?: boolean;
  value?: string[];
  onChange?: (values: string[]) => void;
  disabled?: boolean;
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  name,
  label,
  options,
  className,
  placeholder = "Select options",
  error,
  required,
  value = [],
  onChange,
  disabled,
}) => {
  const [selectedValues, setSelectedValues] = useState<string[]>(value);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedValues(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleOption = (optionValue: string) => {
    const newValues = selectedValues.includes(optionValue)
      ? selectedValues.filter((v) => v !== optionValue)
      : [...selectedValues, optionValue];

    setSelectedValues(newValues);
    onChange?.(newValues);
  };

  const handleRemovePill = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newValues = selectedValues.filter((v) => v !== optionValue);
    setSelectedValues(newValues);
    onChange?.(newValues);
  };

  const getSelectedLabels = () => {
    return selectedValues
      .map((val) => options.find((opt) => opt.value === val)?.label)
      .filter(Boolean);
  };

  return (
    <div className={classNames(className)} ref={dropdownRef}>
      <label
        htmlFor={name}
        className="block text-base/6 font-medium text-gray-700 mb-1"
      >
        {label}
        {required ? "*" : ""}
      </label>

      <div className="relative">
        <div
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={classNames(
            "w-full min-h-[40px] rounded-md bg-white pt-[9px] pl-3 pr-8 text-base cursor-pointer",
            "!outline !outline-1 !-outline-offset-1",
            isOpen
              ? error
                ? "!outline-2 -outline-offset-2 outline-red-500"
                : "!outline-2 !-outline-offset-2 outline-primary"
              : error
              ? "!outline-red-500"
              : "!outline-black/50",
            disabled ? "bg-gray-100 cursor-not-allowed" : ""
          )}
        >
          {selectedValues.length === 0 ? (
            <span className="text-gray-400 text-sm/6">{placeholder}</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {getSelectedLabels().map((label, index) => (
                <span
                  key={selectedValues[index]}
                  className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-sm border border-blue-200"
                >
                  {label}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) =>
                        handleRemovePill(selectedValues[index], e)
                      }
                      className="hover:text-blue-900 focus:outline-none"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <svg
              className={classNames(
                "h-5 w-5 text-gray-400 transition-transform",
                isOpen ? "rotate-180" : ""
              )}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        {isOpen && !disabled && (
          <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg outline outline-1 outline-gray-300 max-h-60 overflow-auto">
            {options.map((option) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <div
                  key={option.value}
                  onClick={() => handleToggleOption(option.value)}
                  className={classNames(
                    "px-3 py-2 cursor-pointer hover:bg-gray-50 flex items-center gap-2 text-sm",
                    isSelected ? "bg-blue-50" : ""
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className={classNames("text-gray-900")}>
                    {option.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hidden input to store values for form submission */}
      <input type="hidden" name={name} value={selectedValues.join(",")} />
    </div>
  );
};

export default MultiSelect;
