import { FieldValues, FieldPath, Controller } from "react-hook-form";
import { ControlledInputProps } from "../../types";
import Checkbox, { CheckboxProps } from "../NextGenInputs/Checkbox";

interface CtlNextGenCheckboxProps extends CheckboxProps { }

/**
 * Next-gen checkbox component wrapped in react-hook-form controller
 * Fall-through props allow for finer-grained control and styling on a case-by-case basis
 */
export default function CtlNextGenCheckbox<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  name,
  control,
  rules,
  ...rest
}: ControlledInputProps<TFieldValues, TName> & CtlNextGenCheckboxProps) {
  const isRequired = rules?.required ? true : false;

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({
        field,
        fieldState: { error },
      }) => (
        <Checkbox
          {...field}
          {...rest}
          required={isRequired}
          error={!!error}
        />
      )}
    />
  );
}
