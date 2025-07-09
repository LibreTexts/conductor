import classNames from "classnames";
import { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
  name: string;
  label: string;
  options: Array<{
    value: string;
    label: string;
  }>;
  selectClassName?: string;
}

const Select: React.FC<SelectProps> = ({
  name,
  label,
  options,
  className,
  selectClassName,
  ...props
}) => {
  return (
    <div className={classNames(className)}>
      <label
        htmlFor={name}
        className="block text-sm/6 font-medium text-gray-700"
      >
        {label}
      </label>
      <select
        id={name}
        name={name}
        className={classNames(
          selectClassName,
          "col-start-1 row-start-1 w-full appearance-none rounded-md bg-white py-2 pl-3 pr-8 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Select;
