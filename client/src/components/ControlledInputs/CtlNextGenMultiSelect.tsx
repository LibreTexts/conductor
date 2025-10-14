import { ControlledInputProps } from "../../types";
import { Controller, FieldPath, FieldValues } from "react-hook-form";
import MultiSelect, { MultiSelectProps } from "../NextGenInputs/MultiSelect";

interface CtlNextGenMultiSelectProps extends MultiSelectProps {}

export default function CtlNextGenMultiSelect<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  name,
  control,
  rules,
  ...rest
}: ControlledInputProps<TFieldValues, TName> & CtlNextGenMultiSelectProps) {
  const isRequired = rules?.required ? true : false;
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field, fieldState: { error } }) => (
        <MultiSelect
          {...rest}
          {...field}
          required={isRequired}
          error={!!error}
        />
      )}
    />
  );
}
