import React, { useEffect, useState } from "react";
import { Button, Checkbox, Input, Modal } from "semantic-ui-react";
import { RemixerSubPage } from "./model";

interface EditPanelProps {
  open: boolean;
  dimmer: string;
  onClose: () => void;
  currentPage?: RemixerSubPage;
  handleSave: (page: RemixerSubPage) => void;
  formattedPathDefault?: string;
}

/** Colons are not allowed. If present, drop the prefix before the first ":" and any remaining ":". */
function sanitizeRemixerTitle(value: string, trim: boolean = true): string {
  let s = value;
  const colonIndex = s.indexOf(":");
  if (colonIndex !== -1) {
    s = s.slice(colonIndex + 1);
  }
  if (trim) {
    return s.replace(/:/g, "").trim();
  }
  return s.replace(/:/g, "");
}

const EditPanel: React.FC<EditPanelProps> = (props) => {
  const {
    open,
    dimmer,
    onClose,
    currentPage,
    handleSave,
    formattedPathDefault,
  } = props;
  const [page, setPage] = useState<RemixerSubPage | undefined>(currentPage);

  const handleSaveClick = () => {
    if (!page) return;
    const title = sanitizeRemixerTitle(page.title ?? page["@title"] ?? "");
    const normalizedPage: RemixerSubPage = {
      ...page,
      title,
      "@title": title,
      formattedPathOverride: page.formattedPathOverride === true,
      formattedPath:
        page.formattedPathOverride === true
          ? (page.formattedPath ?? "")
          : undefined,
    };
    handleSave(normalizedPage);
  };

  useEffect(() => {
    if (!currentPage) {
      setPage(undefined);
      return;
    }
    const title = sanitizeRemixerTitle(
      currentPage.title ?? currentPage["@title"] ?? "",
    );
    setPage({ ...currentPage, title, "@title": title });
  }, [currentPage, open]);

  return (
    <Modal open={open} onClose={onClose} dimmer={dimmer}>
      <Modal.Header>Edit Page</Modal.Header>
      <Modal.Content>
        <Input
          focus
          label="Title"
          placeholder="Loading title..."
          value={page?.title ?? page?.["@title"] ?? ""}
          fluid
          onChange={(e) => {
            const next = sanitizeRemixerTitle(e.target.value,false);
            setPage((prev) =>
              prev ? { ...prev, title: next, "@title": next } : prev,
            );
          }}
        />
        <Checkbox
          label="Override Prefix"
          checked={page?.formattedPathOverride ?? false}
          onChange={(_, data) =>
            setPage((prev) => {
              if (!prev) return prev;
              const enabled = data.checked === true;
              return {
                ...prev,
                formattedPathOverride: enabled,
                formattedPath: enabled
                  ? (prev.formattedPath ?? formattedPathDefault ?? "")
                  : undefined,
              };
            })
          }
        />
        <Input
          focus
          label="Prefix"
          placeholder="Custom prefix (leave blank to hide prefix)"
          value={
            page?.formattedPathOverride
              ? (page?.formattedPath ?? "")
              : (formattedPathDefault ?? "")
          }
          disabled={page?.formattedPathOverride !== true}
          fluid
          onChange={(e) =>
            setPage((prev) =>
              prev ? { ...prev, formattedPath: e.target.value } : prev,
            )
          }
        />
      </Modal.Content>
      <Modal.Actions>
        <Button positive onClick={handleSaveClick} disabled={!page}>
          Save
        </Button>
        <Button negative onClick={onClose}>
          Cancel
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default EditPanel;
