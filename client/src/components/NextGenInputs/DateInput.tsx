import classNames from "classnames";
import { toISODateOnly } from "../../utils/misc";


export interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
    name: string;
    value?: Date | string;
    label?: string;
    className?: string;
    labelClassName?: string;
    inputClassName?: string;
    error?: boolean;
    required?: boolean;
    onChange: (date: Date | string) => void;
}

export default function DateInput({
    className,
    label,
    name,
    labelClassName,
    inputClassName,
    error,
    required,
    ...props
}: DateInputProps) {
    return (
        <div className={classNames(className)}>
            <label className={classNames("block text-base/6 font-medium text-gray-700", labelClassName)}>
                {label}{required ? "*" : ""}
            </label>
            <input
                type="date"
                value={
                    props.value
                        ? new Date(props.value).toISOString().split("T")[0]
                        : ""
                }
                onChange={(e) => {
                    if (!props.onChange) return;
                    props.onChange(
                        toISODateOnly(new Date(e.target.value))
                    );
                }}
                className={classNames("border border-gray-300 rounded px-4 py-3", inputClassName)}
            />
        </div>
    )
}