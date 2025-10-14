import { FieldValues, FieldPath, Controller } from "react-hook-form";
import { ControlledInputProps } from "../../types";
import DateInput, { DateInputProps } from "../NextGenInputs/DateInput";

/**
 * Next-gen date input component wrapped in react-hook-form controller
 * Fall-through props allow for finer-grained control and styling on a case-by-case basis
 */
export default function CtlNextGenDateInput<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
    name,
    control,
    rules,
    ...rest
}: ControlledInputProps<TFieldValues, TName> &
    Omit<DateInputProps, "onChange">) {

    return (
        <Controller
            control={control}
            name={name}
            rules={rules}
            render={({
                field,
                fieldState: { error },
            }) => (
                <DateInput
                    {...rest}
                    {...field}
                    onChange={field.onChange}
                />
            )}
        />
    );
}
