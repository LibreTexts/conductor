import { RadioGroup } from "@libretexts/davis-react";
import { GlossaryConfigMode } from "./model";

export type ScopeModeOption = {
  label: string;
  value: GlossaryConfigMode;
  description: string;
};

interface GlossaryModeSelectorProps {
  value: GlossaryConfigMode;
  onChange: (mode: GlossaryConfigMode) => void;
  disabled?: boolean;
  /** Wording for another feature using the same scope model (e.g. references). */
  options?: ScopeModeOption[];
  label?: string;
  name?: string;
}

const MODE_OPTIONS: ScopeModeOption[] = [
  {
    label: "Glossary at the end of each page",
    value: "PAGE",
    description: "Every page is its own glossary group.",
  },
  {
    label: "Glossary by chapter",
    value: "CHAPTER",
    description:
      "Pages are grouped by top-level chapter — each chapter and everything under it shares one group.",
  },
  {
    label: "Backmatter glossary",
    value: "BACKMATTER",
    description: "All pages in the book share a single glossary group.",
  },
];

const GlossaryModeSelector = ({
  value,
  onChange,
  disabled,
  options = MODE_OPTIONS,
  label = "Glossary Mode",
  name = "glossary-config-mode",
}: GlossaryModeSelectorProps) => {
  const selected = options.find((option) => option.value === value);

  return (
    <div>
      <RadioGroup
        name={name}
        label={label}
        value={value}
        onChange={(v) => onChange(v as GlossaryConfigMode)}
        disabled={disabled}
        orientation="horizontal"
        options={options.map(({ label, value: optionValue }) => ({
          label,
          value: optionValue,
        }))}
      />
      {selected && (
        <p className="mt-2 text-sm text-neutral-600">{selected.description}</p>
      )}
    </div>
  );
};

export default GlossaryModeSelector;
