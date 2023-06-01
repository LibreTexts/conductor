import { FieldValues, FieldPath, Controller } from "react-hook-form";
import { Form, FormInputProps } from "semantic-ui-react";
import { ControlledInputProps } from "../../types";

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
  ...rest
}: ControlledInputProps<TFieldValues, TName> & FormInputProps) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({
        field: { value, onChange, onBlur },
        fieldState: { error },
      }) => (
          <Form.Input
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            error={error?.message}
            {...rest}
          />
      )}
    />
  );
}
