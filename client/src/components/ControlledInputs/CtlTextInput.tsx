import { FieldValues, FieldPath, Controller } from "react-hook-form";
import { Form, FormInputProps } from "semantic-ui-react";
import { ControlledInputProps } from "../../types";

interface CtlTextInputProps extends FormInputProps {
  label?: string;
  required?: boolean;
}

/**
 * Semantic UI Form.Input component wrapped in react-hook-form controller
 * Fall-through props allow for finer-grained control and styling on a case-by-case basis
 */
export default function CtlTextInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  name,
  control,
  rules,
  label,
  required = false,
  ...rest
}: ControlledInputProps<TFieldValues, TName> & CtlTextInputProps) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({
        field: { value, onChange, onBlur },
        fieldState: { error },
      }) => (
        <>
          {label && (
            <label
              className={`form-field-label ${required ? "form-required" : ""}`}
            >
              {label}
            </label>
          )}
          <Form.Input
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            error={error?.message}
            {...rest}
          />
        </>
      )}
    />
  );
}
