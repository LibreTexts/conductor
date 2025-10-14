import { ControlledInputProps } from "../../types";
import { Controller, FieldPath, FieldValues } from "react-hook-form";
import Select, { SelectProps } from "../NextGenInputs/Select";

interface CtlNextGenSelectProps extends SelectProps { }

/**
 * Next-gen select component wrapped in react-hook-form controller
 * Fall-through props allow for finer-grained control and styling on a case-by-case basis
 */
export default function CtlNextGenSelect<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
    name,
    control,
    rules,
    ...rest
}: ControlledInputProps<TFieldValues, TName> & CtlNextGenSelectProps) {
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
                <Select
                    {...rest}
                    {...field}
                    required={isRequired}
                    error={!!error}
                />
            )}
        />
    );
}