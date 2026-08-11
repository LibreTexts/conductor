import React, { useEffect, useState } from "react";
import {    Icon, Modal } from "semantic-ui-react";
import { Library, RemixerSubPage } from "./model";
import { Button, Checkbox, Input, Stack } from "@libretexts/davis-react";
import { DAVIS_REMIXER_BTN_CLASS, DAVIS_REMIXER_CHECKBOX_CLASS, DAVIS_REMIXER_LINK_CLASS } from "./style";
import api from "../../api";

interface EditPanelProps {
  open: boolean;
  dimmer: string;
  onClose: () => void;
  currentPage?: RemixerSubPage;
  handleSave: (page: RemixerSubPage) => void;
  formattedPathDefault?: string;
  library:Library;
  coverID?: string;
}

type ReingestState = {
  status: "idle" | "running" | "done" | "error";
  message: string;
};

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
    library,
    coverID
  } = props;
  const [page, setPage] = useState<RemixerSubPage | undefined>(currentPage);
  const [reingest, setReingest] = useState<ReingestState>({
    status: "idle",
    message: "",
  });

  // Reset the re-ingest status whenever the panel opens on a different page.
  useEffect(() => {
    setReingest({ status: "idle", message: "" });
  }, [currentPage, open]);

  const handleReingest = () => {
    const pageID = currentPage?.["@id"];
    if (!pageID || !coverID || !library) return;

    setReingest({ status: "running", message: "Starting…" });
    const evtSource = api.reingestPage(`${library}-${coverID}`, pageID);

    evtSource.addEventListener("progress", (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data);
        const label: Record<string, string> = {
          fetched: "Fetched the latest content",
          chunked: `Split into ${d.chunks} sections`,
          embedded: `Updated ${d.units_novel} of ${d.units_total} changed sections`,
          indexed: "Indexing",
        };
        setReingest({ status: "running", message: label[d.stage] ?? d.stage });
      } catch {
        /* ignore an unparseable frame */
      }
    });

    evtSource.addEventListener("done", (e: MessageEvent) => {
      let message = "Benny is up to date with this page.";
      try {
        const d = JSON.parse(e.data);
        message = `Benny is up to date (${d.chunks} sections).`;
      } catch {
        /* keep the default */
      }
      setReingest({ status: "done", message });
      evtSource.close();
    });

    // NOTE: SSE dispatches our `event: error` frame AND native transport errors
    // to the same "error" listener. Our failure frame carries JSON data; a
    // transport error does not — disambiguate on that.
    evtSource.addEventListener("error", (e: MessageEvent) => {
      let message = "Couldn't reach Benny — try again in a moment.";
      try {
        if (e?.data) message = JSON.parse(e.data).message ?? message;
      } catch {
        /* keep the default */
      }
      setReingest({ status: "error", message });
      evtSource.close();
    });
  };

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
            href={currentPage?.["uri.ui"] && currentPage?.["uri.ui"] !== "" ? currentPage?.["uri.ui"] : `https://${library}.libretexts.org/@go/page/${currentPage?.["@id"]}`}
            target="_blank"
            rel="noopener noreferrer"
            className={DAVIS_REMIXER_LINK_CLASS.external}
          >
            Link to this page in the library
            <Icon name="external alternate" className="!ml-2" />
          </a>
        )}
        {!currentPage?.["@id"].startsWith("new-") && coverID && (
          <div className="!mt-4">
            <Button
              onClick={handleReingest}
              disabled={reingest.status === "running"}
              className={DAVIS_REMIXER_BTN_CLASS.base}
            >
              {reingest.status === "running"
                ? "Updating Benny…"
                : "Update Benny for this page"}
            </Button>
            <p className="!mt-1 !text-sm !text-gray-600">
              After editing this page in the library, refresh Benny's copy so
              students see your changes now — or leave it for the weekly sync.
            </p>
            {reingest.message && (
              <p
                className={
                  reingest.status === "error"
                    ? "!mt-1 !text-sm !text-red-600"
                    : "!mt-1 !text-sm !text-gray-700"
                }
              >
                {reingest.message}
              </p>
            )}
          </div>
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
