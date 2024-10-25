import { ChangeEventHandler, memo, useEffect, useRef, useState } from "react";
import FocusTrap from "focus-trap-react";
import { DayPicker } from "react-day-picker";
import { usePopper } from "react-popper";
import { format, parse, isValid, parseISO } from "date-fns";
import "./DateInput.css";
import "react-day-picker/dist/style.css";
import "../../styles/global.css";

export interface DateInputProps {
  value: Date | string;
  onChange: (date: Date | string) => void;
  label: string | undefined;
  inlineLabel?: boolean;
  required?: boolean;
  className?: string;
  error: boolean;
  disabled?: boolean;
  popupPlacement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
}

const DateInput = ({
  value = "",
  onChange = (date) => {},
  label = undefined,
  inlineLabel = false,
  required = false,
  className = "",
  error = false,
  disabled = false,
  popupPlacement = 'bottom-start',
}: DateInputProps) => {
  const [selected, setSelected] = useState<Date>();
  const [inputValue, setInputValue] = useState<string>("");
  const [isPopperOpen, setIsPopperOpen] = useState(false);

  const popperRef = useRef<HTMLInputElement>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(
    null
  );
  const popper = usePopper(popperRef.current, popperElement, {
    placement: popupPlacement,
  });

  useEffect(() => {
    if (value) {
      const initValue = typeof value === "string" ? value : value.toISOString();
      const date = parseISO(initValue);
      if (isValid(date)) {
        formatAndSetInputValue(date);
        setSelected(date);
      }
    }
  }, [value, setSelected, setInputValue]);

  const handleInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    if (disabled) return;
    const date = parse(e.currentTarget.value, "MM/dd/yyyy", new Date());
    if (isValid(date)) {
      formatAndSetInputValue(date);
      setSelected(date);
    } else {
      setSelected(undefined);
    }
  };

  const handleOpenDialog = () => {
    if (disabled) return;
    setIsPopperOpen(true);
  };

  const handleDaySelect = (date: Date | undefined) => {
    if (disabled) return;
    if (!date) return;
    setSelected(date);
    formatAndSetInputValue(date);
    onChange(date);
    setIsPopperOpen(false);
  };

  const formatAndSetInputValue = (date: Date | undefined) => {
    if (!date) {
      setInputValue("");
      return;
    }
    setInputValue(format(date, "MM/dd/yyyy"));
  };

  return (
    <>
      <div
        ref={popperRef}
        onClick={handleOpenDialog}
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
          placeholder={"mm/dd/yyyy"}
          value={inputValue}
          onChange={handleInputChange}
          disabled={disabled}
        />
      </div>
      {isPopperOpen && (
        <FocusTrap
          active
          focusTrapOptions={{
            initialFocus: false,
            allowOutsideClick: true,
            clickOutsideDeactivates: true,
            onDeactivate: () => setIsPopperOpen(false),
          }}
        >
          <div
            style={popper.styles.popper}
            className="dialog-sheet rdp-dialog"
            {...popper.attributes.popper}
            ref={setPopperElement}
            role="dialog"
          >
            <DayPicker
              initialFocus={isPopperOpen}
              mode="single"
              defaultMonth={selected}
              selected={selected}
              onSelect={handleDaySelect}
              disabled={disabled}
            />
          </div>
        </FocusTrap>
      )}
    </>
  );
};

export default memo(DateInput);
