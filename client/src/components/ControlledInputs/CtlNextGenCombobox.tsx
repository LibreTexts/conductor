import { ControlledInputProps } from "../../types";
import { Controller, FieldPath, FieldValues } from "react-hook-form";
import Combobox, { ComboboxProps } from "../NextGenInputs/Combobox";
import { useEffect } from "react";

/**
 * Next-gen select component wrapped in react-hook-form controller
 * Fall-through props allow for finer-grained control and styling on a case-by-case basis
 */
export default function CtlNextGenCombobox<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  TMultiple extends boolean = false
>({
  name,
  control,
  rules,
  multiple,
  ...rest
}: ControlledInputProps<TFieldValues, TName> &
  Omit<ComboboxProps, "onChange"> & { multiple?: TMultiple }) {
  const isRequired = rules?.required ? true : false;

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({
        field: { onChange, value, ...restField },
        fieldState: { error },
      }) => {
        if (multiple) {
          return (
            <Combobox
              {...(rest as any)}
              {...restField}
              multiple={true}
              value={value as string[]}
              onChange={(values: string[]) => {
                onChange(values);
              }}
              required={isRequired}
              error={!!error}
            />
          );
        }

        return (
          <Combobox
            {...(rest as any)}
            {...restField}
            multiple={false}
            value={value as string}
            onChange={onChange}
            required={isRequired}
            error={!!error}
          />
        );
      }}
    />
  );
}
