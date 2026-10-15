import React, { useEffect, useState } from "react";
import { Button, Input, Modal, Stack, Textarea } from "@libretexts/davis-react";
import { parseBibtexToForm, type ReferenceFormData } from "./model";

interface ImportBibtexDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with parsed form data when the user confirms import. */
  onImport: (form: ReferenceFormData, rawText: string) => void;
}

const ImportBibtexDialog: React.FC<ImportBibtexDialogProps> = ({
  open,
  onClose,
  onImport,
}) => {
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRawText("");
      setError(null);
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setRawText(text);
    };
    reader.onerror = () => setError("Failed to read the selected file.");
    reader.readAsText(file);
  };

  const handleImport = () => {
    const trimmed = rawText.trim();
    if (!trimmed) {
      setError("Paste BibTeX text or upload a file first.");
      return;
    }
    const parsed = parseBibtexToForm(trimmed);
    if (!parsed) {
      setError("Could not parse a BibTeX entry. Check the format and try again.");
      return;
    }
    onImport(parsed, trimmed);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>Import from BibTeX</Modal.Title>
        <Modal.Close aria-label="Close import dialog" />
      </Modal.Header>
      <Modal.Body>
        <Stack direction="vertical" gap="md">
          <Input
            name="bibtexFile"
            label="Upload BibTeX / text file"
            type="file"
            accept=".bbl,.bib,.bibtex,.txt,text/plain,application/x-bibtex,text/x-bibtex"
            onChange={handleFileChange}
          />
          <Textarea
            name="bibtexContent"
            label="Or paste BibTeX text"
            value={rawText}
            onChange={(e) => {
              setError(null);
              setRawText(e.target.value);
            }}
            rows={12}
            error={!!error}
            errorMessage={error ?? undefined}
          />
          {/* The Textarea ties the message to the field; this announces it. */}
          <p className="sr-only" role="alert">
            {error ?? ""}
          </p>
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleImport}
          disabled={!rawText.trim()}
        >
          Import into form
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ImportBibtexDialog;
