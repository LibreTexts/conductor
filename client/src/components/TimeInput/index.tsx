import "../../styles/global.css";
import "react-datepicker/dist/react-datepicker.css";
import "./TimeInput.css";

import { useEffect, useState, forwardRef } from "react";
import DatePicker from "react-datepicker";

export interface TimeInputProps {
  value: Date;
  onChange: (time: Date | string) => void;
  label: string;
  inlineLabel?: boolean;
  className?: string;
  error?: boolean;
  required?: boolean;
  disabled?: boolean;
}

const TimeInput = ({
  value,
  onChange,
  label,
  inlineLabel = false,
  className = "",
  error = false,
  required = false,
  disabled = false,
}: TimeInputProps) => {
  const [selected, setSelected] = useState<Date>();

  useEffect(() => {
    setSelected(value);
  }, [value]);

  const handleTimeSelect = (date: Date | null) => {
    if (disabled) return;
    if (!date) return;
    setSelected(date);
    onChange(date);
  };

  const CustomInput = forwardRef<HTMLDivElement>(
    ({ value, onClick }: any, ref) => (
      <div
        ref={ref}
        onClick={onClick}
        className={`conductor-date-input${
          inlineLabel ? " inline" : ""
        } ${className} ${disabled ? "disabled-input" : ""}`}
      >
        {label !== null && (
          <label
            className={`cdi-label${inlineLabel ? " inline" : ""}${
              required ? " form-required" : ""
            }${error ? " form-error-label" : ""}`}
          >
            {label}
          </label>
        )}
        <input
          type="text"
          placeholder={"hh:mm am/pm"}
          onChange={() => {}} //Void onChange to prevent react warnings
          value={value}
          disabled={disabled}
        />
      </div>
    )
  );

  return (
    <div className={`time-input-container ${className}`}>
      <DatePicker
        selected={selected}
        onChange={handleTimeSelect}
        showTimeSelect
        showTimeSelectOnly
        timeIntervals={5}
        timeCaption="Time"
        dateFormat="hh:mm aa"
        disabled={disabled}
        customInput={<CustomInput />}
      />
    </div>
  );
};

export default TimeInput;
