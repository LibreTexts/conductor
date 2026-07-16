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
  /** Auto-numbered prefix/index pieces used as placeholders/defaults when override is first enabled. */
  formattedPathPartsDefault?: { prefix: string; index: string };
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
    formattedPathPartsDefault,
    library
  } = props;
  const [page, setPage] = useState<RemixerSubPage | undefined>(currentPage);

  const handleSaveClick = () => {
    if (!page) return;
    const title = sanitizeRemixerTitle(page.title ?? page["@title"] ?? "");
    const overridden = page.formattedPathOverride === true;
    const prefix = overridden ? (page.formattedPathPrefix ?? "") : undefined;
    const index = overridden ? (page.formattedPathIndex ?? "") : undefined;
    const normalizedPage: RemixerSubPage = {
      ...page,
      title,
      "@title": title,
      formattedPathOverride: overridden,
      formattedPathPrefix: prefix,
      formattedPathIndex: index,
      formattedPath: overridden ? `${prefix}${index}`.trim() : undefined,
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
      
      <Checkbox
          name="formattedPathOverride"
          label="Override Prefix"
          className={DAVIS_REMIXER_CHECKBOX_CLASS.labelLeft}
          labelClassName="font-bold text-md"
          checked={page?.formattedPathOverride ?? false}
          onChange={(checked) =>
            setPage((prev) => {
              if (!prev) return prev;
              const enabled = checked === true;
              return {
                ...prev,
                formattedPathOverride: enabled,
                formattedPathPrefix: enabled
                  ? (prev.formattedPathPrefix ?? formattedPathPartsDefault?.prefix ?? "")
                  : undefined,
                formattedPathIndex: enabled
                  ? (prev.formattedPathIndex ?? formattedPathPartsDefault?.index ?? "")
                  : undefined,
              };
            })
          }
        />
        <Stack direction="horizontal" gap="md">
        <Input
          name="formattedPathPrefix"
          label="Prefix"
          placeholder="Custom prefix (leave blank to hide prefix)"
          value={
            page?.formattedPathOverride
              ? (page?.formattedPathPrefix ?? "")
              : (formattedPathPartsDefault?.prefix ?? "")
          }
          disabled={page?.formattedPathOverride !== true}
          onChange={(e) =>
            setPage((prev) =>
              prev ? { ...prev, formattedPathPrefix: e.target.value } : prev,
            )
          }
          className="flex-1"
        />
        <Input
          type="text"
          name="formattedPathIndex"
          label="Index"
          placeholder="Custom index (e.g. 2.1)"
          className="flex-1"
          disabled={page?.formattedPathOverride !== true}
          value={
            page?.formattedPathOverride
              ? (page?.formattedPathIndex ?? "")
              : (formattedPathPartsDefault?.index ?? "")
          }
          onChange={(e) =>
            setPage((prev) =>
              prev ? { ...prev, formattedPathIndex: e.target.value } : prev,
            )
          }
        />
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
          className="flex-7"
        />
       
        </Stack>
        {!currentPage?.["@id"].startsWith("new-") && (
          <a
            href={currentPage?.["uri.ui"] && currentPage?.["uri.ui"] !== "" ? currentPage?.["uri.ui"] : `https://${library}.libretexts.org/@go/page/${currentPage?.["@id"]}`}
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
