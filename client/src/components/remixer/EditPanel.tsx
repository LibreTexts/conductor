import React, { useEffect, useState } from "react";
import {    Icon, Modal } from "semantic-ui-react";
import { Library, RemixerSubPage } from "./model";
import { Button, Checkbox, Input, Stack } from "@libretexts/davis-react";
import { DAVIS_REMIXER_BTN_CLASS, DAVIS_REMIXER_CHECKBOX_CLASS, DAVIS_REMIXER_LINK_CLASS } from "./style";

interface EditPanelProps {
  open: boolean;
  dimmer: string;
  onClose: () => void;
  currentPage?: RemixerSubPage;
  handleSave: (page: RemixerSubPage) => void;
  formattedPathDefault?: string;
  library:Library;
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
    library
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
          name="title"
          label="Title"
          placeholder="Loading title..."
          value={page?.title ?? page?.["@title"] ?? ""}
          onChange={(e) => {
            const next = sanitizeRemixerTitle(e.target.value,false);
            setPage((prev) =>
              prev ? { ...prev, title: next, "@title": next } : prev,
            );
          }}
        />
        <Checkbox
          name="formattedPathOverride"
          label="Override Prefix"
          className={DAVIS_REMIXER_CHECKBOX_CLASS.labelLeft}
          checked={page?.formattedPathOverride ?? false}
          onChange={(checked) =>
            setPage((prev) => {
              if (!prev) return prev;
              const enabled = checked === true;
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
          name="formattedPath"
          label="Prefix"
          placeholder="Custom prefix (leave blank to hide prefix)"
          value={
            page?.formattedPathOverride
              ? (page?.formattedPath ?? "")
              : (formattedPathDefault ?? "")
          }
          disabled={page?.formattedPathOverride !== true}
          onChange={(e) =>
            setPage((prev) =>
              prev ? { ...prev, formattedPath: e.target.value } : prev,
            )
          }
        />
        {!currentPage?.["@id"].startsWith("new-") && (
          <a
            href={`https://${library}.libretexts.org/@go/page/${currentPage?.["@id"]}`}
            target="_blank"
            rel="noopener noreferrer"
            className={DAVIS_REMIXER_LINK_CLASS.external}
          >
            Link to this page in the library
            <Icon name="external alternate" className="!ml-2" />
          </a>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Stack direction="horizontal" gap="md" justify="end">
        <Button  onClick={onClose} className={DAVIS_REMIXER_BTN_CLASS.base}>
          Cancel
        </Button>
        <Button  onClick={handleSaveClick} disabled={!page} className={DAVIS_REMIXER_BTN_CLASS.success}>
          Save
        </Button>
        </Stack>
      </Modal.Actions>
    </Modal>
  );
};

export default EditPanel;
