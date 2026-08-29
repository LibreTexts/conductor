import { Alert, Button, EmptyState, Link } from "@libretexts/davis-react";
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

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
      {label}
    </dt>
    <dd className="m-0 mt-1 text-sm text-gray-900 break-all">{value}</dd>
  </div>
);

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
          icon={<display.icon size={40} aria-hidden="true" />}
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
          icon={<display.icon size={40} aria-hidden="true" />}
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

  const facts = (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
      <Fact label="Format" value={display.label} />
      <Fact
        label="Size"
        value={entry.sizeBytes ? fileSizePresentable(entry.sizeBytes) : "Unknown"}
      />
      <Fact
        label="Generated"
        value={
          entry.generatedAt
            ? formatDate(new Date(entry.generatedAt), DATE_FORMAT)
            : "Unknown"
        }
      />
      <Fact label="Job" value={job?.id ? `#${job.id.slice(-7)}` : "Unknown"} />
    </dl>
  );

  if (display.previewable) {
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
          key={entry.downloadURL}
          title={`${display.label} preview`}
          src={entry.downloadURL}
          className="flex-1 w-full border-0 bg-gray-100"
        />
      </div>
    );
  }

  return (
    <div {...panelProps} className="h-full overflow-y-auto px-6 py-5">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="!m-0 text-lg font-semibold text-gray-900">
          {display.label}
        </h3>
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
      {facts}
      <Alert
        className="mt-6"
        variant="info"
        title=""
        message={`What this file is for: ${display.description}`}
      />
    </div>
  );
};

export default ExportDetailPane;
