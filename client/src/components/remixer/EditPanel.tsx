import React, { useEffect, useRef, useState } from "react";
import { Library, RemixerSubPage } from "./model";
import {
  Button,
  Checkbox,
  Input,
  Stack,
  Modal,
  Link,
} from "@libretexts/davis-react";
import { IconDeviceFloppy } from "@tabler/icons-react";

interface EditPanelProps {
  open: boolean;
  onClose: () => void;
  currentPage?: RemixerSubPage;
  handleSave: (page: RemixerSubPage) => void;
  /** Auto-numbered prefix/index pieces used as placeholders/defaults when override is first enabled. */
  formattedPathPartsDefault?: { prefix: string; index: string };
  library: Library;
  /** True when editing the top-level book node; colons are allowed in book titles. */
  coverPageId: string;
}

function sanitizeRemixerTitle(
  value: string,
  trim: boolean = true,
  allowColon = false,
): string {
  let s = allowColon ? value : value.replace(/:/g, "");
  return trim ? s.trim() : s;
}

const EditPanel: React.FC<EditPanelProps> = (props) => {
  const {
    open,
    onClose,
    currentPage,
    handleSave,
    formattedPathPartsDefault,
    library,
    coverPageId,
  } = props;
  const [page, setPage] = useState<RemixerSubPage | undefined>(currentPage);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const isBookRoot =
    currentPage?.parentID === "-1" || currentPage?.["@id"] === coverPageId;

  const handleSaveClick = () => {
    if (!page) return;
    const title = sanitizeRemixerTitle(
      page.title ?? page["@title"] ?? "",
      true,
      isBookRoot,
    );
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
      true,
      isBookRoot,
    );
    setPage({ ...currentPage, title, "@title": title });
  }, [currentPage, open]);

  useEffect(() => {
    if (!open) return;
    // After Modal finishes its own focus management
    const id = window.setTimeout(() => {
      titleInputRef.current?.focus();
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  return (
    <Modal open={open} size="md" onClose={onClose}>
      <Modal.Header>
        <Modal.Title>Edit Page</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Stack direction="vertical" gap="md" align="start" className="w-full">
          {!isBookRoot && (
            <Checkbox
              name="formattedPathOverride"
              label="Override Prefix"
              className="flex-row-reverse font-bold!"
              labelClassName="font-bold! text-md!"
              checked={page?.formattedPathOverride ?? false}
              onChange={(checked) =>
                setPage((prev) => {
                  if (!prev) return prev;
                  const enabled = checked === true;
                  return {
                    ...prev,
                    formattedPathOverride: enabled,
                    formattedPathPrefix: enabled
                      ? (prev.formattedPathPrefix ??
                        formattedPathPartsDefault?.prefix ??
                        "")
                      : undefined,
                    formattedPathIndex: enabled
                      ? (prev.formattedPathIndex ??
                        formattedPathPartsDefault?.index ??
                        "")
                      : undefined,
                  };
                })
              }
            />
          )}
          <Stack direction="horizontal" gap="md" className="w-full">
            {!isBookRoot && (
              <>
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
                      prev
                        ? { ...prev, formattedPathPrefix: e.target.value }
                        : prev,
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
                      prev
                        ? { ...prev, formattedPathIndex: e.target.value }
                        : prev,
                    )
                  }
                />
              </>
            )}
            <Input
              ref={titleInputRef}
              name="title"
              label="Title"
              placeholder="Loading title..."
              value={page?.title ?? page?.["@title"] ?? ""}
              onChange={(e) => {
                const next = sanitizeRemixerTitle(
                  e.target.value,
                  false,
                  isBookRoot,
                );
                setPage((prev) =>
                  prev ? { ...prev, title: next, "@title": next } : prev,
                );
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                handleSaveClick();
              }}
              className="flex-7"
            />
          </Stack>
          {!currentPage?.["@id"].startsWith("new-") && (
            <Link
              href={
                currentPage?.["uri.ui"] && currentPage?.["uri.ui"] !== ""
                  ? currentPage?.["uri.ui"]
                  : `https://${library}.libretexts.org/@go/page/${currentPage?.["@id"]}`
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              Link to this page in the library
            </Link>
          )}
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Stack direction="horizontal" gap="md" justify="end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveClick}
            disabled={!page}
            icon={<IconDeviceFloppy size={16} />}
          >
            Save
          </Button>
        </Stack>
      </Modal.Footer>
    </Modal>
  );
};

export default EditPanel;
