import React, { useEffect, useState } from "react";
import { Alert, Button, Modal, Stack } from "@libretexts/davis-react";
import {
  ReferenceEntry,
  ReferenceFormData,
  ReferenceFormatType,
} from "../model";
import ReferenceFormFields from "./ReferenceFormFields";

interface EditReferenceProps {
  /** The reference being edited; the dialog is open while this is set. */
  reference: ReferenceEntry | null;
  /** The current project, to tell its own references from borrowed ones. */
  projectID: string;
  referenceFormat?: ReferenceFormatType;
  saving: boolean;
  onClose: () => void;
  onSave: (data: ReferenceFormData & { referenceID: string }) => void;
}

const toFormData = (reference: ReferenceEntry): ReferenceFormData => {
  const { referenceID: _id, projectID: _project, ...fields } = reference;
  return fields;
};

const EditReference: React.FC<EditReferenceProps> = ({
  reference,
  projectID,
  referenceFormat,
  saving,
  onClose,
  onSave,
}) => {
  const [form, setForm] = useState<ReferenceFormData | null>(null);

  useEffect(() => {
    setForm(reference ? toFormData(reference) : null);
  }, [reference]);

  const isBorrowed =
    !!reference?.projectID && reference.projectID !== projectID;
  const keyChanged =
    !!reference &&
    !!form &&
    form.citationKey.trim() !== "" &&
    form.citationKey.trim() !== reference.citationKey;

  return (
    <Modal
      open={!!reference}
      onClose={() => {
        if (!saving) onClose();
      }}
      size="lg"
    >
      <Modal.Header>
        <Modal.Title>Edit reference</Modal.Title>
        <Modal.Close aria-label="Close" />
      </Modal.Header>
      <Modal.Body>
        {form && (
          <Stack direction="vertical" gap="md">
            {isBorrowed && (
              <Alert
                variant="info"
                message="This reference comes from another project. Saving creates an editable copy for this project and leaves the original unchanged."
              />
            )}
            <ReferenceFormFields
              form={form}
              onChange={setForm}
              referenceFormat={referenceFormat}
              idPrefix="edit-"
              citationKeyNotice={
                keyChanged && (
                  <Alert
                    variant="warning"
                    message={`Pages that cite \\librecite{${reference?.citationKey}} won't find this reference under its new key until they're updated.`}
                  />
                )
              }
            />
          </Stack>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="primary"
          loading={saving}
          disabled={saving || !form || !reference}
          onClick={() => {
            if (!form || !reference) return;
            onSave({ ...form, referenceID: reference.referenceID });
          }}
        >
          Save changes
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default EditReference;
