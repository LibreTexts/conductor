import { Button, EmptyState, Link } from "@libretexts/davis-react";
import { IconDownload, IconRefresh } from "@tabler/icons-react";
import { format as formatDate } from "date-fns";
import { fileSizePresentable } from "../../../utils/assetHelpers";
import { getExportDisplay } from "../../../utils/bookExports";
import type {
  BookExport,
  BookExportKey,
  ShapeshiftJob,
} from "../../../types/Shapeshift";

interface ExportDetailPaneProps {
  exportKey: BookExportKey;
  entry?: BookExport;
  job: ShapeshiftJob | null;
  isCompiling: boolean;
  onCompile: () => void;
}

const DATE_FORMAT = "MM/dd/yyyy h:mm aaa";

const ExportDetailPane: React.FC<ExportDetailPaneProps> = ({
  exportKey,
  entry,
  job,
  isCompiling,
  onCompile,
}) => {
  const display = getExportDisplay(exportKey);
  if (!display) return null;

  const panelProps = {
    role: "tabpanel" as const,
    id: `export-panel-${exportKey}`,
    "aria-labelledby": `export-tab-${exportKey}`,
    tabIndex: 0,
  };

  if (!display.enabled) {
    return (
      <div {...panelProps} className="flex h-full items-center justify-center px-8">
        <EmptyState
          icon={<display.icon size={32} aria-hidden="true" />}
          title="EPUB is coming soon"
          description="Shapeshift does not produce an EPUB yet. This format will appear here once it does."
        />
      </div>
    );
  }

  // A finished job does not guarantee every artifact landed, so a missing file
  // gets its own state instead of a broken download link.
  if (!entry?.available) {
    return (
      <div {...panelProps} className="flex h-full items-center justify-center px-8">
        <EmptyState
          icon={<display.icon size={32} aria-hidden="true" />}
          title={`${display.label} is not available`}
          description="This file is missing from the last compile, which can happen when one export fails quietly. Compiling again usually fixes it."
          action={
            <Button
              variant="primary"
              icon={<IconRefresh size={16} />}
              onClick={onCompile}
              loading={isCompiling}
            >
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  // A missing size or timestamp is dropped rather than printed as "Unknown":
  // the downloads host simply does not always send the headers these come from,
  // and a placeholder reads like something went wrong.
  const facts = [
    entry.sizeBytes ? fileSizePresentable(entry.sizeBytes) : null,
    entry.generatedAt
      ? formatDate(new Date(entry.generatedAt), DATE_FORMAT)
      : null,
    job?.id ? `job #${job.id.slice(-7)}` : null,
  ].filter(Boolean);

  if (display.previewable) {
    // The short download URL 302s to a storage host, and a frame load blocked on
    // a redirect hop reports its URL as the empty string, naming no host to
    // allowlist. The resolved URL is framed so CSP judges the real host; the
    // download link and button keep the short one, which `frame-src` never
    // applies to.
    const previewSrc = entry.previewURL || entry.downloadURL;

    return (
      <div {...panelProps} className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
          <h3 className="m-0 text-lg font-semibold text-gray-900">
            {display.label}
          </h3>
          <div className="flex items-center gap-2">
            <Link href={entry.downloadURL} external>
              Open in new tab
            </Link>
            <Button
              as="a"
              href={entry.downloadURL}
              variant="outline"
              size="sm"
              icon={<IconDownload size={16} />}
            >
              Download
            </Button>
          </div>
        </div>
        {/*
          The browser's own PDF viewer supplies page navigation and zoom, so the
          drawer does not ship a second set of controls over the top of it.
        */}
        <iframe
          key={previewSrc}
          title={`${display.label} preview`}
          src={previewSrc}
          className="flex-1 w-full border-0 bg-gray-100"
        />
      </div>
    );
  }

  // Nothing to preview, so the download is the whole point of the pane and gets
  // the center of it.
  return (
    <div
      {...panelProps}
      className="flex h-full flex-col items-center justify-center overflow-y-auto px-8 py-10 text-center"
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-gray-100 text-gray-500">
        <display.icon size={32} aria-hidden="true" />
      </div>
      <h3 className="!mt-4 !mb-1 text-lg font-semibold text-gray-900">
        {display.label}
      </h3>
      <p className="m-0 max-w-md text-sm text-gray-600">
        {display.description}
      </p>
      <Button
        as="a"
        href={entry.downloadURL}
        variant="outline"
        size="lg"
        className="mt-6"
        icon={<IconDownload size={20} />}
      >
        Download
      </Button>
      {facts.length > 0 && (
        <p className="m-0 mt-4 text-xs text-gray-500">{facts.join(" · ")}</p>
      )}
    </div>
  );
};

export default ExportDetailPane;
