import React, { useEffect, useRef, useState } from "react";
import { Library, RemixerSubPage } from "./model";
import {
  Button,
  Checkbox,
  Input,
  Stack,
  Modal,
  Link,
  Text,
  IconButton,
} from "@libretexts/davis-react";
import { IconDeviceFloppy, IconEdit } from "@tabler/icons-react";
import {
  getRemixerPageUriUi,
  isRemixerBookRoot,
  sanitizeRemixerPageTitle,
  toEditableRemixerTitle,
} from "./services";

interface EditPanelProps {
  open: boolean;
  onClose: () => void;
  currentPage?: RemixerSubPage;
  handleSave: (page: RemixerSubPage) => void;
  /** Auto-numbered prefix/index pieces used as placeholders/defaults when override is first enabled. */
  formattedPathPartsDefault?: { prefix: string; index: string };
  library: Library;
  /** Project cover page id; the book root allows colons in its title. */
  coverPageId: string;
  /** True for default front/back-matter pages and matter-root containers — URL ending is not user-editable for these. */
  isMatterPage?: boolean;
}

/** Truncate to `maxLen` characters with "..." in the middle (e.g. 25 → "abcdefghij...opqrstuvwxy"). */
function truncateMiddle(value: string, maxLen: number): string {
  if (value.length <= maxLen) return value;
  const keep = maxLen - 3;
  const front = Math.ceil(keep / 2);
  const back = Math.floor(keep / 2);
  return `${value.slice(0, front)}...${value.slice(-back)}`;
}

/** Path-segment-safe characters only — no `/`, spaces, `?`, `#`, etc. */
function sanitizeUriEnding(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[^A-Za-z0-9._~%-]/g, "");
  return cleaned.length > 0 ? cleaned : undefined; // return undefined if nothing remains after sanitization
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
    isMatterPage,
  } = props;
  const [page, setPage] = useState<RemixerSubPage | undefined>(currentPage);

  const currentPageUri = getRemixerPageUriUi(currentPage);
  const currentPageParentPath = currentPageUri
    ? currentPageUri.split("/").slice(0, -1).join("/")
    : "";
 
  const titleInputRef = useRef<HTMLInputElement>(null);
  const isBookRoot = isRemixerBookRoot(currentPage, coverPageId);
  const [overrideUriUiEnding, setOverrideUriUiEnding] = useState<string|undefined>(
    sanitizeUriEnding(currentPage?.overrideUriUiEnding ||currentPageUri?.split("/").slice(-1)[0]  ||undefined),
  );
  const [enableOverrideUriUiEnding, setEnableOverrideUriUiEnding] =
    useState(false);
  // True only once the user actually types in the URL-ending field — distinct
  // from `enableOverrideUriUiEnding` (a display-mode toggle). Without this,
  // merely switching to edit mode (which seeds the field with the current
  // auto-generated ending as a preview) and saving without typing anything
  // would persist that fallback text as a brand-new explicit override.
  const [overrideUriUiEndingTouched, setOverrideUriUiEndingTouched] =
    useState(false);

  const handleSaveClick = () => {
    if (!page) return;
    const title = toEditableRemixerTitle(
      page.title ?? page["@title"] ?? "",
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
      // `enableOverrideUriUiEnding` is a display-mode toggle (read-only text vs.
      // editable input), not an on/off switch for the override itself — while
      // actively editing, persist whatever's in the field (including an
      // explicit clear-to-empty, which sanitizeUriEnding maps to undefined);
      // while just viewing, leave the page's existing saved override
      // untouched instead of wiping it or replacing it with the field's
      // fallback-seeded display value (the current auto-generated ending).
      overrideUriUiEnding: overrideUriUiEndingTouched
        ? overrideUriUiEnding
        : currentPage?.overrideUriUiEnding,
    };
    handleSave(normalizedPage);
  };

  useEffect(() => {
    if (!currentPage) {
      setPage(undefined);
      return;
    }
    const title = toEditableRemixerTitle(
      currentPage.title ?? currentPage["@title"] ?? "",
      isBookRoot,
    );
    setPage({ ...currentPage, title, "@title": title });
    const uri = getRemixerPageUriUi(currentPage);
    setOverrideUriUiEnding(
      sanitizeUriEnding(
        currentPage.overrideUriUiEnding || uri.split("/").slice(-1)[0] || "",
      ),
    );
    setEnableOverrideUriUiEnding(!!currentPage.overrideUriUiEnding);
    setOverrideUriUiEndingTouched(false);
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
              label="Override Autonumbers"
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
                // Hyphenate colons as they are typed, but never strip a
                // numbering prefix mid-edit — that happens on load/save only.
                const next = isBookRoot
                  ? e.target.value
                  : sanitizeRemixerPageTitle(e.target.value, false);
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
          {currentPageUri && !isBookRoot && !isMatterPage && (
            <Stack direction="horizontal" gap="sm" align="center" className="w-full">
              <Text className="text-sm text-gray-500 shrink-0">
                <span title={currentPageParentPath}>
                  {truncateMiddle(currentPageParentPath, 25)}
                </span>{" "}
                /
              </Text>
              {enableOverrideUriUiEnding ? (
                <Input
                  name="overrideUriUiEnding"
                  label=""
                  aria-label="URL ending"
                  value={overrideUriUiEnding}
                  onChange={(e) => {
                    setOverrideUriUiEnding(sanitizeUriEnding(e.target.value));
                    setOverrideUriUiEndingTouched(true);
                  }}
                  className="flex-1"
                />
              ) : (
                <Text className="text-sm text-gray-500">{overrideUriUiEnding}</Text>
              )}
              <IconButton
                icon={<IconEdit size={16} />}
                aria-label={
                  enableOverrideUriUiEnding
                    ? "Stop editing URL ending"
                    : "Edit URL ending"
                }
                onClick={() =>
                  setEnableOverrideUriUiEnding((prev) => !prev)
                }
              />
            </Stack>
          )}
          {!currentPage?.["@id"].startsWith("new-") && (
            <Link
              href={
                currentPageUri && currentPageUri !== ""
                  ? currentPageUri
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
