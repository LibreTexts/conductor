import clsx from "clsx";
import { forwardRef, InputHTMLAttributes } from "react";
import { input } from "./variants";
import { VariantProps } from "tailwind-variants";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof input> {
  name: string;
  label: string;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: boolean;
  required?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      name,
      labelClassName,
      inputClassName,
      leftIcon,
      rightIcon,
      error,
      required,
      variant,
      size,
      ...props
    },
    ref
  ) => {
    return (
      <div className={clsx(className)}>
        <label
          htmlFor={name}
          className={clsx(
            "block text-base/6 font-medium text-gray-700",
            labelClassName
          )}
        >
          {label}
          {required ? "*" : ""}
        </label>
        <div className="mt-1.5">
          <div className="relative">
            {leftIcon && (
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                {leftIcon}
              </div>
            )}
            <input
              ref={ref}
              id={name}
              name={name}
              placeholder={props.placeholder || label}
              className={clsx(
                input({ variant: error ? "error" : variant, size }),
                inputClassName,
                leftIcon ? "pl-10" : "pl-3",
                rightIcon ? "pr-10" : "pr-3"
              )}
              {...props}
            />
            {rightIcon && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {rightIcon}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

Input.displayName = "Input";
