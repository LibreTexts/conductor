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
  labelDirection?: "col" | "row";
  required?: boolean;
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
  ...rest
}: ControlledInputProps<TFieldValues, TName> & CtlCheckboxProps) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({
        field: { value, onChange, onBlur },
        fieldState: { error },
      }) => (
        <div className={labelDirection === 'row' ? 'flex-row-div' : 'flex-col-div'}>
          {label && (
            <label
              className={`form-field-label ${required ? "form-required" : ""}`}
            >
              {label}
            </label>
          )}
          <Checkbox
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            error={error?.message}
            {...rest}
          />
        </div>
      )}
    />
  );
}
