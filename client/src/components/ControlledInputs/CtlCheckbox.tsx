import { FieldValues, FieldPath, Controller } from "react-hook-form";
import {
  Checkbox,
  CheckboxProps,
  Form,
  FormInputProps,
} from "semantic-ui-react";
import { ControlledInputProps } from "../../types";

interface CtlCheckboxProps extends CheckboxProps {
  label?: string;
  labelDirection?: "col" | "row" | "col-reverse" | "row-reverse";
  required?: boolean;
  negated?: boolean;
}

/**
 * Semantic UI Checkbox component wrapped in react-hook-form controller
 * Fall-through props allow for finer-grained control and styling on a case-by-case basis
 */
export default function CtlCheckbox<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  name,
  control,
  rules,
  label,
  labelDirection = "row",
  required = false,
  negated = false,
  ...rest
}: ControlledInputProps<TFieldValues, TName> & CtlCheckboxProps) {

  // Helper function to convert checkbox value to boolean
  // Negated checkboxes appear as the opposite of their value (ie unchecked if true, checked if false)
  const getCheckboxValue = (value: boolean | undefined) => {
    if (negated) {
      return value ? false : true;
    } else {
      return value ? true : false;
    }
  };
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({
        field: { value, onChange, onBlur },
        fieldState: { error },
      }) => (
        <div
          className={`flex flex-${labelDirection} items-center`}
        >
          {label && (
            <label
              className={`form-field-label ${required ? "form-required" : ""} ${labelDirection === "row-reverse" ? "ml-2" : ""}`}
            >
              {label}
            </label>
          )}
          <Checkbox
            checked={getCheckboxValue(value)}
            onChange={(e, { checked }) =>
              onChange(negated ? !checked : checked)
            }
            onBlur={onBlur}
            error={error?.message}
            {...rest}
          />
        </div>
      )}
    />
  );
}
