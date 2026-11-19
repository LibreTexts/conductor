import { useMemo, useState } from "react";
import { Badge, Combobox, Text } from "@libretexts/davis-react";

export type ComboOption = { value: string; label: string; description?: string };

/** Long lists such as tags and C-IDs only render this many matches at once. */
const MAX_VISIBLE = 50;

interface MultiComboboxFieldProps {
  label: string;
  /** Used in each chip's remove label, e.g. "Remove tag Biology". */
  itemNoun: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: ComboOption[];
  placeholder: string;
  helperText?: string;
  loading?: boolean;
  disabled?: boolean;
  /** Offer the typed text as a new value when nothing matches it exactly. */
  allowCreate?: boolean;
  /** Called with the raw query, for lists that search on the server. */
  onQueryChange?: (query: string) => void;
  /** Chip text for a value. Defaults to the value itself. */
  chipLabel?: (value: string) => string;
}

/**
 * A searchable picker that adds one value per choice, with each value shown
 * as a removable badge underneath. Same pattern as the H5P subjects and tags.
 */
const MultiComboboxField = ({
  label,
  itemNoun,
  value,
  onChange,
  options,
  placeholder,
  helperText,
  loading = false,
  disabled = false,
  allowCreate = false,
  onQueryChange,
  chipLabel = (v) => v,
}: MultiComboboxFieldProps) => {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();

  const matches = useMemo(() => {
    const q = trimmed.toLowerCase();
    return options.filter(
      (o) => !value.includes(o.value) && (!q || o.label.toLowerCase().includes(q))
    );
  }, [options, value, trimmed]);

  const canCreate =
    allowCreate &&
    !!trimmed &&
    !value.some((v) => v.toLowerCase() === trimmed.toLowerCase()) &&
    !options.some((o) => o.value.toLowerCase() === trimmed.toLowerCase());

  const add = (next: string | null) => {
    if (next && !value.includes(next)) onChange([...value, next]);
    setQuery("");
    onQueryChange?.("");
  };

  return (
    <div className="flex flex-col gap-2">
      <Combobox<string> value={null} nullable disabled={disabled} onChange={add}>
        <Combobox.Label>{label}</Combobox.Label>
        <Combobox.Input<string>
          placeholder={placeholder}
          displayValue={() => ""}
          onChange={(e) => {
            setQuery(e.target.value);
            onQueryChange?.(e.target.value);
          }}
        />
        <Combobox.Options>
          {canCreate && (
            <Combobox.Option<string> value={trimmed}>Add &ldquo;{trimmed}&rdquo;</Combobox.Option>
          )}
          {matches.slice(0, MAX_VISIBLE).map((o) => (
            <Combobox.Option<string> key={o.value} value={o.value}>
              {/* The highlighted option has a primary background, so the muted line turns white there. */}
              {({ active, focus }) => (
                <span className="flex flex-col">
                  <span>{o.label}</span>
                  {o.description && (
                    <span className={`text-sm ${active || focus ? "text-white" : "text-neutral-600"}`}>
                      {o.description}
                    </span>
                  )}
                </span>
              )}
            </Combobox.Option>
          ))}
          {!canCreate && matches.length === 0 && (
            <Combobox.Empty>{loading ? "Loading…" : "No matches."}</Combobox.Empty>
          )}
        </Combobox.Options>
      </Combobox>
      {helperText && (
        <Text as="p" size="sm" color="muted" className="m-0">
          {helperText}
        </Text>
      )}
      {value.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label={label}>
          {value.map((v) => (
            <li key={v}>
              <Badge
                label={chipLabel(v)}
                variant="primary"
                onRemove={disabled ? undefined : () => onChange(value.filter((x) => x !== v))}
                removeLabel={`Remove ${itemNoun} ${chipLabel(v)}`}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MultiComboboxField;
