import classNames from "classnames";

type StyledQuantitySelectProps = {
  value?: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
  label?: string;
};

const StyledQuantitySelect: React.FC<StyledQuantitySelectProps> = ({
  value = 1,
  onChange,
  min = 1,
  max = 199,
  disabled = false,
  className = "",
  label = "Quantity:",
}) => {
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
    const newValue = parseInt(e.target.value) || min;
    const clampedValue = Math.min(Math.max(newValue, min), max);
    onChange(clampedValue);
  };

  const handleInputBlur = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Ensure value is valid on blur
    if (!e.target.value || parseInt(e.target.value) < min) {
      onChange(min);
    }
  };

  return (
    <div className={classNames("flex flex-col gap-2", className)}>
      <label className="font-medium text-gray-900">{label}</label>
      <div className="flex items-center">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || value <= min}
          className="group relative flex items-center justify-center rounded-l-md border h-[33px] border-gray-300 bg-white px-3 py-2 text-gray-900 hover:border-gray-400 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-indigo-600 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          aria-label="Decrease quantity"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
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
          type="number"
          value={value}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          min={min}
          max={max}
          disabled={disabled}
          className="w-16 border-t border-b border-gray-300 bg-white px-3 py-2 text-center text-sm font-medium text-gray-900 focus:border-indigo-600 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-indigo-600 disabled:opacity-25 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />

        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || value >= max}
          className="group relative flex items-center justify-center rounded-r-md border h-[33px] border-gray-300 bg-white px-3 py-2 text-gray-900 hover:border-gray-400 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-indigo-600 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          aria-label="Increase quantity"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
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
    </div>
  );
};

export default StyledQuantitySelect;
