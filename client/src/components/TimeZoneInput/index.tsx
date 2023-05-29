import { useTimezoneSelect, allTimezones } from "react-timezone-select";
import { Form } from "semantic-ui-react";
import { TimeZoneOption } from "../../types";

/**
 * Default time zone option for Pacific Time
 */
export const PTDefaultTimeZone: TimeZoneOption = {
  value: "America/Los_Angeles",
  label: "(GMT-7:00) Pacific Time",
  offset: -7,
  abbrev: "PDT",
  altName: "Pacific Daylight Time",
};

export interface TimeZoneInputProps {
  value: TimeZoneOption;
  label: string;
  onChange: (timezone: TimeZoneOption) => void;
  inlineLabel?: boolean;
  className?: string;
  required?: boolean;
  error?: boolean;
  disabled?: boolean;
}

const TimeZoneInput = ({
  value,
  label,
  onChange,
  inlineLabel = false,
  className = "",
  required = false,
  error = false,
  disabled = false,
}: TimeZoneInputProps) => {

  const { options, parseTimezone } = useTimezoneSelect({
    timezones: allTimezones,
  });
  
  return (
    <Form.Select
      options={options.map((option) => {
        return {
          key: option.value,
          value: option.value,
          text: option.label,
        };
      })}
      value={value.value}
      onChange={(_e, { value }) => onChange(parseTimezone(value as string))}
      placeholder="Select a time zone"
      label={label}
      inline={inlineLabel}
      fluid
      selection
      error={error}
      disabled={disabled}
      className={className}
      required={required}
    />
  );
};

export default TimeZoneInput;
