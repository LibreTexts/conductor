import React, { useMemo } from "react";
import { Input, Select, Text } from "@libretexts/davis-react";
import {
  BIBTEX_FIELDS_BY_TYPE,
  EntryType,
  EntryTypes,
  ReferenceFieldKey,
  ReferenceFormData,
  ReferenceFormatType,
  formatCitationPreview,
  getBibtexFieldLabel,
} from "../model";

interface ReferenceFormFieldsProps {
  form: ReferenceFormData;
  onChange: (next: ReferenceFormData) => void;
  /** Book-level citation style used for the live preview. */
  referenceFormat?: ReferenceFormatType;
  /** Locks the entry type, with `lockedTypeHint` explaining why. */
  lockEntryType?: boolean;
  lockedTypeHint?: string;
  /** Shown beside the entry type select, e.g. an import button. */
  typeAction?: React.ReactNode;
  /** Prefix for input names, so two forms on one page don't share ids. */
  idPrefix?: string;
  /** Shown directly below the citation key field. */
  citationKeyNotice?: React.ReactNode;
}

/** Entry type, the BibTeX fields for that type, and a citation preview. */
const ReferenceFormFields: React.FC<ReferenceFormFieldsProps> = ({
  form,
  onChange,
  referenceFormat,
  lockEntryType = false,
  lockedTypeHint,
  typeAction,
  idPrefix = "",
  citationKeyNotice,
}) => {
  const fields = BIBTEX_FIELDS_BY_TYPE[form.entryType];
  const preview = useMemo(
    () => formatCitationPreview(form, referenceFormat),
    [form, referenceFormat],
  );

  const updateField = (key: ReferenceFieldKey, value: string) => {
    onChange({ ...form, [key]: value });
  };

  return (
    <>
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[12rem] flex-1">
            <Select
              name={`${idPrefix}entryType`}
              label="Entry type"
              placeholder="Select entry type…"
              options={EntryTypes.map((t) => ({
                label: t.label,
                value: t.value,
              }))}
              value={form.entryType}
              disabled={lockEntryType}
              onChange={(e) => {
                if (lockEntryType) return;
                onChange({ ...form, entryType: e.target.value as EntryType });
              }}
            />
          </div>
          {typeAction}
        </div>
        {lockEntryType && lockedTypeHint && (
          <p className="mt-1 text-xs text-neutral-500">{lockedTypeHint}</p>
        )}
      </div>

      <div className="max-h-[40vh] overflow-y-auto rounded border border-gray-200 p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map((key) => (
            <div
              key={key}
              className={key === "citationKey" ? "sm:col-span-2" : undefined}
            >
              <Input
                name={`${idPrefix}${key}`}
                label={getBibtexFieldLabel(key)}
                value={form[key] ?? ""}
                onChange={(e) => updateField(key, e.target.value)}
                placeholder={
                  key === "citationKey"
                    ? "Auto-generated from author, year, title if left blank"
                    : undefined
                }
              />
              {key === "citationKey" && citationKeyNotice && (
                <div className="mt-2">{citationKeyNotice}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-gray-50 p-3">
        <Text size="sm" weight="semibold" className="mb-1 block">
          Preview
          {referenceFormat ? ` (${referenceFormat})` : ""}
        </Text>
        {preview ? (
          <p className="text-sm leading-relaxed text-neutral-800">{preview}</p>
        ) : (
          <p className="text-sm italic text-neutral-500">
            {referenceFormat
              ? "Fill in author or title to see a citation preview."
              : "Select a book references format to enable citation preview."}
          </p>
        )}
      </div>
    </>
  );
};

export default ReferenceFormFields;
