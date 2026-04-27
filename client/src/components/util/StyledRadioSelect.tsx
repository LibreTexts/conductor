import classNames from "classnames";
import React from "react";

type StyledRadioSelectProps = {
  fieldName: string;
  fieldLabel?: string;
  className?: string;
  gridClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  textClassName?: string;
  options: {
    title: string;
    value: string;
  }[];
  selectedValue: string;
  defaultValue?: string;
  onChange: (value: string) => void;
};

const StyledRadioSelect: React.FC<StyledRadioSelectProps> = ({
  fieldName,
  fieldLabel = "",
  options,
  className = "",
  gridClassName = "",
  labelClassName = "",
  inputClassName = "",
  textClassName = "",
  selectedValue,
  defaultValue = "",
  onChange,
}) => {
  return (
    <fieldset aria-label={fieldLabel} className={classNames("mt-2", className)} key={fieldLabel || crypto.randomUUID()}>
      <div
        className={classNames(
          "grid grid-cols-1 gap-3 sm:grid-cols-2",
          gridClassName
        )}
      >
        {options.map((opt) => (
          <label
            key={opt.value}
            aria-label={opt.title}
            className={classNames(
              "group relative flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-3 min-w-0 cursor-pointer has-[:checked]:border-primary-dark has-[:checked]:bg-primary-dark has-[:disabled]:opacity-25 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-border-primary hover:border-gray-400 transition-colors",
              labelClassName
            )}
          >
            <input
              name={fieldName}
              type="radio"
              value={opt.value}
              className={classNames("sr-only", inputClassName)}
              checked={(selectedValue || defaultValue) === opt.value}
              onChange={(e) => onChange(e.target.value)}
            />
            <span
              className={classNames(
                "text-sm font-medium uppercase group-has-[:checked]:text-white text-gray-900",
                textClassName
              )}
            >
              {opt.title}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};

export default StyledRadioSelect;
