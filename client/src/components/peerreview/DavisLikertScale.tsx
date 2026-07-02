import { RadioGroup } from "@libretexts/davis-react";
import {
  threePointLikertOptions,
  fivePointLikertOptions,
  sevenPointLikertOptions,
} from "../util/LikertHelpers";

interface DavisLikertScaleProps {
  name: string;
  label: string;
  points: 3 | 5 | 7;
  value: number | null;
  onChange: (val: number) => void;
  required?: boolean;
  error?: boolean;
  errorMessage?: string;
}

const pointLabels: Record<3 | 5 | 7, string[]> = {
  3: threePointLikertOptions,
  5: fivePointLikertOptions,
  7: sevenPointLikertOptions,
};

/**
 * Likert scale built from Davis RadioGroup with horizontal button-style tiles.
 * Supports 3, 5, and 7 points. WCAG 2.2 AA: keyboard-navigable, legend announces
 * the prompt, selected value is announced on change.
 */
const DavisLikertScale: React.FC<DavisLikertScaleProps> = ({
  name,
  label,
  points,
  value,
  onChange,
  required,
  error,
  errorMessage,
}) => {
  const options = pointLabels[points].map((text, idx) => ({
    value: String(idx + 1),
    label: text,
  }));

  return (
    <RadioGroup
      name={name}
      label={label}
      value={value != null && value > 0 ? String(value) : undefined}
      onChange={(val) => onChange(Number(val))}
      options={options}
      orientation="horizontal"
      required={required}
      error={error}
      errorMessage={errorMessage}
    />
  );
};

export default DavisLikertScale;
