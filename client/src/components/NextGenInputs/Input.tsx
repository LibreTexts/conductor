import classNames from "classnames";
import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label: string;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
}

const Input: React.FC<InputProps> = ({
  className,
  label,
  name,
  labelClassName,
  inputClassName,
  ...props
}) => {
  return (
    <div className={classNames(className)}>
      <label
        htmlFor={name}
        className={classNames("block text-sm/6 font-medium text-gray-700", labelClassName)}
      >
        {label}
      </label>
      <div className="mt-1.5">
        <input
          id={name}
          name={name}
          placeholder={props.placeholder || label}
          className={classNames(
            inputClassName,
            "block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 border border-gray-400 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary sm:text-sm/6"
          )}
          {...props}
        />
      </div>
    </div>
  );
};

export default Input;
