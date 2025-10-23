import classNames from "classnames";
import { InputHTMLAttributes } from "react";

export interface TextareaProps extends InputHTMLAttributes<HTMLTextAreaElement> {
    name: string;
    label: string;
    className?: string;
    error?: boolean;
    required?: boolean;
    showRemaining?: boolean;
    rows?: number;
}

export default function Textarea({showRemaining, rows, ...props}: TextareaProps) {
    return (
        <div className={classNames("flex flex-col", props.className)}>
            <label htmlFor={props.name} className="block text-base/6 font-medium text-gray-700">
                {props.label}{props.required ? "*" : ""}
            </label>
            <div className="mt-2">
                <textarea
                    id={props.name}
                    rows={rows || 4}
                    className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                    {...props}
                />
            </div>
            {
                props.maxLength && showRemaining && typeof props.value === "string" && (
                    <span
                        className={classNames("mt-1 ml-1 text-xs text-gray-500")}
                    >
                        {props.maxLength - props.value.length} characters remaining
                    </span>
                )
            }
        </div>
    )
}
