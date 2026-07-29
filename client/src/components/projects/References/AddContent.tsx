import React, { useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Select, Stack, Text } from "@libretexts/davis-react";
import {
  BIBTEX_FIELDS_BY_TYPE,
  BibtexEntryType,
  BibtexEntryTypes,
  BibtexFieldKey,
  BibtexFormData,
  emptyBibtexForm,
  formToBibtex,
  formatCitationPreview,
  generateCitationKey,
  getBibtexFieldLabel,
  ReferenceFormatType,
} from "./model";
import ImportBibtexDialog from "./ImportBibtexDialog";

interface AddContentProps {
  open: boolean;
  onClose: () => void;
  onAdd: (content: string) => void;
  /** Book-level citation style used for the live preview. */
  referenceFormat?: ReferenceFormatType;
}

const AddContent: React.FC<AddContentProps> = ({
  open,
  onClose,
  onAdd,
  referenceFormat,
}) => {
  const [form, setForm] = useState<BibtexFormData>(emptyBibtexForm());
  const [importOpen, setImportOpen] = useState(false);
  const [fromBibtex, setFromBibtex] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(emptyBibtexForm());
      setImportOpen(false);
      setFromBibtex(false);
    }
  }, [open]);

  const updateField = (key: BibtexFieldKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleTypeChange = (entryType: BibtexEntryType) => {
    if (fromBibtex) return;
    setForm((prev) => ({ ...prev, entryType }));
  };

  const handleClear = () => {
    setForm(emptyBibtexForm());
    setFromBibtex(false);
  };

  const handleAdd = () => {
    const withKey = form.citationKey.trim()
      ? form
      : { ...form, citationKey: generateCitationKey(form) };
    const content = formToBibtex(withKey).trim();
    if (!content) return;
    onAdd(content);
    onClose();
  };

  const fields = BIBTEX_FIELDS_BY_TYPE[form.entryType];
  const preview = useMemo(
    () => formatCitationPreview(form, referenceFormat),
    [form, referenceFormat],
  );
  const canAdd =
    !!form.citationKey.trim() ||
    !!form.author?.trim() ||
    !!form.title?.trim() ||
    !!form.year?.trim();

  return (
    <>
      <Modal open={open} onClose={onClose} size="lg">
        <Modal.Header>
          <Modal.Title>Add reference</Modal.Title>
          <Modal.Close aria-label="Close" />
        </Modal.Header>
        <Modal.Body>
          <Stack direction="vertical" gap="md">
            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-[12rem] flex-1">
                  <Select
                    name="entryType"
                    label="Entry type"
                    placeholder="Select entry type…"
                    options={BibtexEntryTypes.map((t) => ({
                      label: t.label,
                      value: t.value,
                    }))}
                    value={form.entryType}
                    disabled={fromBibtex}
                    onChange={(e) =>
                      handleTypeChange(e.target.value as BibtexEntryType)
                    }
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => setImportOpen(true)}
                >
                  Import from BibTeX
                </Button>
              </div>
              {fromBibtex && (
                <p className="mt-1 text-xs text-neutral-500">
                  Entry type is locked because this reference was imported from BibTeX.
                </p>
              )}
            </div>

            <div className="max-h-[40vh] overflow-y-auto rounded border border-gray-200 p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {fields.map((key) => (
                  <div
                    key={key}
                    className={
                      key === "citationKey" ? "sm:col-span-2" : undefined
                    }
                  >
                    <Input
                      name={key}
                      label={getBibtexFieldLabel(key)}
                      value={form[key] ?? ""}
                      onChange={(e) => updateField(key, e.target.value)}
                      placeholder={
                        key === "citationKey"
                          ? "Auto-generated from author, year, title if left blank"
                          : undefined
                      }
                    />
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
                <p className="text-sm leading-relaxed text-neutral-800">
                  {preview}
                </p>
              ) : (
                <p className="text-sm italic text-neutral-500">
                  {referenceFormat
                    ? "Fill in author or title to see a citation preview."
                    : "Select a book references format to enable citation preview."}
                </p>
              )}
            </div>
          </Stack>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline" onClick={handleClear}>
            Clear
          </Button>
          <Button variant="primary" onClick={handleAdd} disabled={!canAdd}>
            Add
          </Button>
        </Modal.Footer>
      </Modal>

      <ImportBibtexDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(parsed) => {
          setForm(parsed);
          setFromBibtex(true);
        }}
      />
    </>
  );
};

export default AddContent;
