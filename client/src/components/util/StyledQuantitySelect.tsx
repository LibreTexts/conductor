import classNames from "classnames";
import { useId } from "react";

type StyledQuantitySelectProps = {
  value?: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
  label?: string;
  helperText?: string;
  errorMessage?: string;
  error?: boolean;
};

const StyledQuantitySelect: React.FC<StyledQuantitySelectProps> = ({
  value = 1,
  onChange,
  min = 1,
  max = 199,
  disabled = false,
  className = "",
  label = "Quantity:",
  helperText,
  errorMessage,
  error = false,
}) => {
  const inputId = useId();
  const helperId = useId();
  const errorId = useId();

  const showError = error && !!errorMessage;
  const showHelper = !showError && !!helperText;
  const describedBy = showError ? errorId : showHelper ? helperId : undefined;

  const handleIncrement = () => {
    if (value < max && !disabled) {
      onChange(value + 1);
    }
  };

  const handleDecrement = () => {
    if (value > min && !disabled) {
      onChange(value - 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value);
    if (Number.isNaN(parsed)) {
      onChange(min);
      return;
    }
    // Hold the user's value (even if above max) so the error can be surfaced;
    // only clamp the lower bound to keep the field usable.
    onChange(Math.max(parsed, min));
  };

  const handleInputBlur = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value || parseInt(e.target.value) < min) {
      onChange(min);
    }
  };

  const inputBorderClass = showError
    ? "border-red-700 focus:border-red-700 focus:outline-red-700"
    : "border-gray-300 focus:border-indigo-600 focus:outline-indigo-600";

  const stepperBorderClass = showError ? "border-red-700" : "border-gray-300";

  return (
    <div className={classNames("flex flex-col gap-2", className)}>
      {label && (
        <label htmlFor={inputId} className="font-medium text-gray-900">
          {label}
        </label>
      )}
      <div className="flex items-center">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || value <= min}
          className={classNames(
            "group relative flex items-center justify-center rounded-l-md border h-[33px] bg-white px-3 py-2 text-gray-900 hover:border-gray-400 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-indigo-600 disabled:opacity-25 disabled:cursor-not-allowed transition-colors",
            stepperBorderClass
          )}
          aria-label="Decrease quantity"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 12H4"
            />
          </svg>
        </button>

        <input
          id={inputId}
          type="number"
          value={value}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          min={min}
          max={max}
          disabled={disabled}
          aria-invalid={showError || undefined}
          aria-describedby={describedBy}
          className={classNames(
            "w-16 border-t border-b bg-white px-3 py-2 text-center text-sm font-medium text-gray-900 focus:outline focus:outline-2 focus:outline-offset-2 disabled:opacity-25 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            inputBorderClass
          )}
        />

        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || value >= max}
          className={classNames(
            "group relative flex items-center justify-center rounded-r-md border h-[33px] bg-white px-3 py-2 text-gray-900 hover:border-gray-400 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-indigo-600 disabled:opacity-25 disabled:cursor-not-allowed transition-colors",
            stepperBorderClass
          )}
          aria-label="Increase quantity"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>
      {showError && (
        <p
          id={errorId}
          role="alert"
          className="text-sm text-red-700 font-medium"
        >
          {errorMessage}
        </p>
      )}
      {showHelper && (
        <p id={helperId} className="text-sm text-gray-700">
          {helperText}
        </p>
      )}
    </div>
  );
};

export default StyledQuantitySelect;
