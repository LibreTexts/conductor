import { FieldValues, FieldPath, Controller } from "react-hook-form";
import { Form, FormTextAreaProps } from "semantic-ui-react";
import { ControlledInputProps } from "../../types";
import "../../styles/global.css";

interface CtlTextAreaProps extends FormTextAreaProps {
  label?: string;
  required?: boolean;
  maxLength?: number;
  showRemaining?: boolean;
  fluid?: boolean;
  bordered?: boolean;
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
  maxLength,
  showRemaining = false,
  fluid = false,
  bordered = false,
  ...rest
}: ControlledInputProps<TFieldValues, TName> & CtlTextAreaProps) {
  const { className: restClassName } = rest;
  delete rest.className;

  const getRemainingChars = (str?: string) => {
    if (!maxLength) return 0;
    if (!str) return maxLength;
    return maxLength - str.length;
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
            className={`!m-0 ${fluid ? "fluid-textarea" : ""} ${bordered ? 'border border-slate-400 rounded-md padded-textarea': ''} ${bordered && showRemaining && maxLength && getRemainingChars(value) < 0 ? '!border-red-500' : ''}`}
            {...rest}
          />
          {maxLength && showRemaining && typeof value === "string" && (
            <span className={`font-semibold small-text ${getRemainingChars(value) < 0 ? '!text-red-500' : ''}`}>
              Characters remaining: {getRemainingChars(value)}
            </span>
          )}
        </div>
      )}
    />
  );
}
