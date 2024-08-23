import { FieldValues, FieldPath, Controller } from "react-hook-form";
import { Form, FormInputProps } from "semantic-ui-react";
import { ControlledInputProps } from "../../types";

interface CtlTextInputProps extends FormInputProps {
  label?: string;
  required?: boolean;
  showErrorMsg?: boolean;
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
  showErrorMsg = true,
  ...rest
}: ControlledInputProps<TFieldValues, TName> & CtlTextInputProps) {
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
          <Form.Input
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            error={
              error?.message && showErrorMsg
                ? error.message
                : error?.message
                ? true
                : false
            } // Display error message if showErrorMsg is true, otherwise just display error state
            className={`mt-1 ${rest.disabled ? 'bg-gray-200 border-slate-600 border rounded-md' : ''}`}
            {...rest}
          />
        </div>
      )}
    />
  );
}
