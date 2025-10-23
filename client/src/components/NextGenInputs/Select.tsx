import {
  Field,
  Label,
  Select as SelectElement,
  SelectProps as SelectElementProps,
} from "@headlessui/react";
import classNames from "classnames";

export interface SelectProps extends SelectElementProps {
  className?: string;
  name: string;
  label: string;
  options: Array<{
    value: string;
    label: string;
  }>;
  placeholder?: string;
  selectClassName?: string;
  error?: boolean;
  required?: boolean;
}

const Select: React.FC<SelectProps> = ({
  name,
  label,
  options,
  className,
  selectClassName,
  placeholder,
  error,
  required,
  disabled = false,
  ...props
}) => {
  const ResolvedOptions = (): JSX.Element => {
    return (
      <>
        {placeholder && (
          <option key="placeholder" value="" disabled hidden selected>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </>
    );
  };

  return (
    <Field className={classNames(className)} disabled={disabled}>
      <Label className="block text-base/6 font-medium text-gray-700 mb-1">
        {label}
        {required ? "*" : ""}
      </Label>
      <SelectElement
        name={name}
        className={classNames(
          selectClassName,
          "col-start-1 row-start-1 w-full appearance-none rounded-md bg-white py-2 pl-3 pr-8 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary sm:text-sm/6",
          error ? "!outline-red-500 focus:outline-red-500 !bg-red-100" : "",
          props.value ? "" : "text-gray-400"
        )}
        {...props}
      >
        <ResolvedOptions />
      </SelectElement>
    </Field>
  );
};

export default Select;
