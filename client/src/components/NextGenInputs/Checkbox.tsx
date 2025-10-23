import classNames from "classnames";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  name: string;
  label?: string;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
  large?: boolean;
  onChange?: (checked: boolean) => void;
  required?: boolean;
  error?: boolean;
}

const Checkbox: React.FC<CheckboxProps> = ({
  className,
  label,
  name,
  inputClassName,
  labelClassName,
  large = false,
  onChange,
  required,
  error,
  ...props
}) => {
  return (
    <div className={classNames("flex gap-x-3", className)}>
      <div
        className={classNames(
          "flex shrink-0 items-center",
          large ? "h-9" : "h-6"
        )}
      >
        <div
          className={classNames(
            "group grid grid-cols-1",
            large ? "size-7" : "size-3.5"
          )}
        >
          <input
            id={name}
            name={name}
            checked={props.checked}
            onChange={(e) => {
              if (onChange) onChange(e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            type="checkbox"
            className={classNames(
              "col-start-1 row-start-1 appearance-none rounded border border-gray-300 bg-white checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:border-gray-300 disabled:bg-gray-100 disabled:checked:bg-gray-100 forced-colors:appearance-auto",
              large ? "size-7" : "size-3.5",
              inputClassName,
              error ? "!border-red-500 focus-visible:outline-red-500 !bg-red-100" : ""
            )}
            {...props}
          />
          <svg
            fill="none"
            viewBox="0 0 14 14"
            className={classNames(
              "pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-[:disabled]:stroke-gray-950/25",
              large ? "size-7" : "size-3.5",
              error ? "!stroke-red-500 !bg-red-100" : ""
            )}
          >
            <path
              d="M3 8L6 11L11 3.5"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-0 group-has-[:checked]:opacity-100"
            />
            <path
              d="M3 7H11"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-0 group-has-[:indeterminate]:opacity-100"
            />
          </svg>
        </div>
      </div>
      {label && (
        <div className="text-sm/6">
          <label
            htmlFor={name}
            className={classNames("font-medium text-gray-700", labelClassName, error ? "text-red-600" : "")}
          >
            {label}{required ? "*" : ""}
          </label>
        </div>
      )}
    </div>
  );
};

export default Checkbox;
