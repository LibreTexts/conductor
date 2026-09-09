import { RadioGroup } from "@libretexts/davis-react";
import { GlossaryConfigMode } from "./model";

interface GlossaryModeSelectorProps {
  value: GlossaryConfigMode;
  onChange: (mode: GlossaryConfigMode) => void;
  disabled?: boolean;
}

const MODE_OPTIONS: {
  label: string;
  value: GlossaryConfigMode;
  description: string;
}[] = [
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
    label: "Backend glossary",
    value: "BACKEND",
    description: "All pages in the book share a single glossary group.",
  },
];

const GlossaryModeSelector = ({
  value,
  onChange,
  disabled,
}: GlossaryModeSelectorProps) => {
  const selected = MODE_OPTIONS.find((option) => option.value === value);

  return (
    <div>
      <RadioGroup
        name="glossary-config-mode"
        label="Glossary Mode"
        value={value}
        onChange={(v) => onChange(v as GlossaryConfigMode)}
        disabled={disabled}
        orientation="horizontal"
        options={MODE_OPTIONS.map(({ label, value: optionValue }) => ({
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
