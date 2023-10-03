import { FieldValues, FieldPath, Controller } from "react-hook-form";
import { Form, FormTextAreaProps } from "semantic-ui-react";
import { ControlledInputProps } from "../../types";

interface CtlTextAreaProps extends FormTextAreaProps {
  label?: string;
  required?: boolean;
}

/**
 * Semantic UI Form.TextArea component wrapped in react-hook-form controller
 * Fall-through props allow for finer-grained control and styling on a case-by-case basis
 */
export default function CtlTextArea<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  name,
  control,
  rules,
  label,
  required = false,
  ...rest
}: ControlledInputProps<TFieldValues, TName> & CtlTextAreaProps) {
  const { className: restClassName } = rest;
  delete rest.className;

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({
        field: { value, onChange, onBlur },
        fieldState: { error },
      }) => (
        <div className={`${restClassName ?? ""}`}>
          {label && (
            <label
              className={`form-field-label ${required ? "form-required" : ""}`}
            >
              {label}
            </label>
          )}
          <Form.TextArea
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            error={error?.message}
            className="mt-1"
            {...rest}
          />
        </div>
      )}
    />
  );
}
