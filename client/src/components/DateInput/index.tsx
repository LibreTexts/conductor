import { ChangeEventHandler, memo, useEffect, useRef, useState } from "react";
import FocusTrap from "focus-trap-react";
import { DayPicker } from "react-day-picker";
import { usePopper } from "react-popper";
import { format, parse, isValid } from "date-fns";
import "./DateInput.css";
import "react-day-picker/dist/style.css";

interface DateInputProps {
  value: Date | string;
  onChange: (date: Date | string) => void;
  label: string | undefined;
  inlineLabel: boolean;
  required: boolean;
  className: string;
  error: boolean;
}

const DateInput = ({
  value = "",
  onChange = (date) => {},
  label = undefined,
  inlineLabel = false,
  required = false,
  className = "",
  error = false,
}: DateInputProps) => {
  const [selected, setSelected] = useState<Date>();
  const [inputValue, setInputValue] = useState<string>("");
  const [isPopperOpen, setIsPopperOpen] = useState(false);

  const popperRef = useRef<HTMLInputElement>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(
    null
  );
  const popper = usePopper(popperRef.current, popperElement, {
    placement: "bottom-start",
  });

  useEffect(() => {
    if (value) {
      const initValue = typeof (value) === 'string' ? value : value.toLocaleDateString();
      const date = parse(initValue, "MM/dd/yyyy", new Date());
      if (isValid(date)) {
        setInputValue(initValue);
        setSelected(date);
      }
    }
  }, [value, setSelected, setInputValue]);

  const closePopper = () => {
    setIsPopperOpen(false);
  };

  const handleInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    setInputValue(e.currentTarget.value);
    const date = parse(e.currentTarget.value, "MM/dd/yyyy", new Date());
    if (isValid(date)) {
      setSelected(date);
    } else {
      setSelected(undefined);
    }
  };

  const handleOpenDialog = () => {
    setIsPopperOpen(true);
  };

  const handleDaySelect = (date: Date | undefined) => {
    if (date === undefined) return;
    setSelected(date);
    if (date) {
      setInputValue(format(date, "MM/dd/yyyy"));
      onChange(date);
      closePopper();
    } else {
      setInputValue("");
    }
  };

  return (
    <>
      <div
        ref={popperRef}
        onClick={handleOpenDialog}
        className={`conductor-date-input${inlineLabel ? " inline" : ""}`}
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
          placeholder={format(new Date(), "MM/dd/yyyy")}
          value={inputValue}
          onChange={handleInputChange}
          className="input-reset pa2 ma2 bg-white black ba"
        />
      </div>
      {isPopperOpen && (
        <FocusTrap
          active
          focusTrapOptions={{
            initialFocus: false,
            allowOutsideClick: true,
            clickOutsideDeactivates: true,
            onDeactivate: closePopper,
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
            />
          </div>
        </FocusTrap>
      )}
    </>
  );
};

export default memo(DateInput);
