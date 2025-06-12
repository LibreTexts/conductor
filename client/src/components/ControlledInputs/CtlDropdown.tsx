import { DropdownProps, Form, Select } from "semantic-ui-react";
import { ControlledInputProps } from "../../types";
import { Controller, FieldPath, FieldValues } from "react-hook-form";

interface CtlDropdownProps extends DropdownProps {}

function CtlDropdown<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  name,
  control,
  rules,
  label,
  required = false,
  ...rest
}: ControlledInputProps<TFieldValues, TName> & CtlDropdownProps) {
  const { className: restClassName } = rest;
  delete rest.className;

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({
        field: { onChange: fieldOnChange, value },
        fieldState: { error },
      }) => (
        <div className={`${restClassName ?? ""}`}>
          {label && (
            <label
              className={`form-field-label ${required ? "form-required" : ""} mr-2`}
            >
              {label}
            </label>
          )}
          <Select
            {...rest}
            value={value}
            onChange={(_e, { value: newValue }) => fieldOnChange(newValue)}
            options={rest.options ?? []}
            error={error?.message ? true : false}
          />
        </div>
      )}
    />
  );
}

export default CtlDropdown;
