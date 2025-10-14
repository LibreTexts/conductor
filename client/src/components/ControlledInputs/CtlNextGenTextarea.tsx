import { FieldValues, FieldPath, Controller } from "react-hook-form";
import { ControlledInputProps } from "../../types";
import Textarea, { TextareaProps } from "../NextGenInputs/Textarea";

interface CtlNextGenTextareaProps extends TextareaProps {
    showErrorMsg?: boolean;
}

/**
 * Next-gen input component wrapped in react-hook-form controller
 * Fall-through props allow for finer-grained control and styling on a case-by-case basis
 */
export default function CtlNextGenTextarea<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
    name,
    control,
    rules,
    showErrorMsg = true,
    ...rest
}: ControlledInputProps<TFieldValues, TName> & CtlNextGenTextareaProps) {
    const isRequired = rules?.required ? true : false;
    return (
        <Controller
            control={control}
            name={name}
            rules={rules}
            render={({ field, fieldState: { error } }) => (
                <Textarea
                    {...field}
                    {...rest}
                    required={isRequired}
                    error={!!error?.message && showErrorMsg}
                />
            )}
        />
    );
}
