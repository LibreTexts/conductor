import { FieldValues, FieldPath, Controller } from "react-hook-form";
import { Form, FormInputProps } from "semantic-ui-react";
import { ControlledInputProps } from "../../types";
import DateInput, { DateInputProps } from "../DateInput";

/**
 * Semantic UI Form.Input component wrapped in react-hook-form controller
 * Fall-through props allow for finer-grained control and styling on a case-by-case basis
 */
export default function CtlDateInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  name,
  control,
  rules,
  ...rest
}: ControlledInputProps<TFieldValues, TName> &
  FormInputProps &
  Omit<DateInputProps, "onChange">) {
  let { label, inlineLabel, required, className, error: hasError, disabled } = rest;

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({
        field: { value, onChange: fieldOnChange, onBlur },
        fieldState: { error },
      }) => (
        <DateInput
          {...rest}
          onChange={fieldOnChange}
          value={value}
          label={label}
          inlineLabel={inlineLabel}
          required={required}
          className={className}
          error={hasError}
          disabled={disabled}
        />
      )}
    />
  );
}
