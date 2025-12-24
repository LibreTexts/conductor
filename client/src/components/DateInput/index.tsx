import "./DateInput.css";
import "../../styles/global.css";
import classNames from "classnames";
import { toISODateOnly } from "../../utils/misc";

export interface DateInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "type"
  > {
  type?: "date" | "datetime-local";
  value?: Date | string;
  label: string | undefined;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  inlineLabel?: boolean;
  error?: boolean;
  required?: boolean;
  disabled?: boolean;
  onChange: (date: Date | string) => void;
}

export default function DateInput({
  type = "date",
  className,
  label,
  labelClassName,
  inputClassName,
  inlineLabel,
  error,
  required,
  ...props
}: DateInputProps) {
  const calculatedValue = () => {
    if (!props.value) return "";

    if (type === "date") {
      const date =
        props.value instanceof Date ? props.value : new Date(props.value);
      // Check if date is valid before calling toISOString()
      if (isNaN(date.getTime())) return "";
      return date.toISOString().split("T")[0];
    } else if (type === "datetime-local") {
      const dt =
        props.value instanceof Date ? props.value : new Date(props.value);
      // Check if date is valid before processing
      if (isNaN(dt.getTime())) return "";
      const offset = dt.getTimezoneOffset();
      const localDt = new Date(dt.getTime() - offset * 60 * 1000);
      return localDt.toISOString().slice(0, 16);
    }

    return "";
  };

  const onChangeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!props.onChange) return;

    // Handle empty input
    if (!e.target.value) {
      props.onChange("");
      return;
    }

    if (type === "date") {
      const date = new Date(e.target.value);
      // Validate date before calling toISODateOnly
      if (isNaN(date.getTime())) {
        props.onChange("");
        return;
      }
      props.onChange(toISODateOnly(date));
    } else if (type === "datetime-local") {
      const dt = new Date(e.target.value);
      // Validate date before passing it along
      if (isNaN(dt.getTime())) {
        props.onChange("");
        return;
      }
      props.onChange(dt);
    }
  };

  return (
    <div
      className={classNames(
        "conductor-date-input",
        inlineLabel ? "inline" : "",
        className,
        props.disabled ? "disabled-input" : ""
      )}
    >
      {label !== null && (
        <label
          className={classNames(
            `cdi-label${inlineLabel ? " inline" : ""}`,
            required ? " form-required" : "",
            error ? " form-error-label" : "",
            labelClassName
          )}
        >
          {label}
          {required ? "*" : ""}
        </label>
      )}
      <input
        {...props}
        type={type}
        placeholder={"mm/dd/yyyy"}
        value={calculatedValue()}
        onChange={onChangeHandler}
        disabled={props.disabled}
        className={classNames(inputClassName, error ? "form-error-input" : "")}
      />
    </div>
  );
}
