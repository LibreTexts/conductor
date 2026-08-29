import { Badge, Progress, Text } from "@libretexts/davis-react";
import { format as formatDate } from "date-fns";
import { fileSizePresentable } from "../../../utils/assetHelpers";
import type { CompileStatus } from "../../../hooks/useShapeshift";
import type { BookExportInfo, ShapeshiftJob } from "../../../types/Shapeshift";

interface CompileBookStatusBarProps {
  status: CompileStatus;
  job: ShapeshiftJob | null;
  exportInfo: BookExportInfo | null;
  fileCount: number;
  totalSizeBytes: number;
}

const STATUS_BADGE: Record<
  CompileStatus,
  { label: string; variant: "default" | "primary" | "success" | "danger" }
> = {
  "never-compiled": { label: "Not compiled yet", variant: "default" },
  submitting: { label: "Submitting", variant: "primary" },
  "in-progress": { label: "In progress", variant: "primary" },
  finished: { label: "Compiled", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
};

/**
 * Matches the format the Shapeshift admin console uses, so a job timestamp
 * reads the same wherever it appears in Conductor.
 */
const DATE_FORMAT = "MM/dd/yyyy h:mm aaa";

const CompileBookStatusBar: React.FC<CompileBookStatusBarProps> = ({
  status,
  job,
  exportInfo,
  fileCount,
  totalSizeBytes,
}) => {
  const badge = STATUS_BADGE[status];

  const facts: string[] = [];

  if (status === "in-progress" || status === "submitting") {
    if (job?.createdAt) {
      facts.push(`Started ${formatDate(new Date(job.createdAt), DATE_FORMAT)}`);
    }
  } else if (exportInfo?.lastCompiled) {
    facts.push(
      `Last compiled ${formatDate(new Date(exportInfo.lastCompiled), DATE_FORMAT)}`,
    );
  }

  if (job?.id) facts.push(`job ${job.id}`);

  const running = status === "in-progress" || status === "submitting";
  if (running && job?.stage) facts.push(job.stage);

  if (fileCount > 0) {
    facts.push(
      `${fileCount} ${fileCount === 1 ? "file" : "files"}, ${fileSizePresentable(totalSizeBytes)}`,
    );
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-200 px-6 py-3">
      <Badge label={badge.label} variant={badge.variant} size="sm"/>
      {facts.length > 0 && (
        <Text className="m-0 text-sm " >{facts.join(" · ")}</Text>
      )}
      {running && (
        // Sits in the status bar rather than the pane so progress stays visible
        // when a previous compile's exports are still on screen. `progress` is
        // passed through as-is: undefined renders indeterminate, which is the
        // truth before Shapeshift starts reporting a percentage.
        <div className="w-full">
          <Progress
            value={job?.progress}
            size="sm"
            showValue
            label={job?.stage ?? "Compiling"}
          />
        </div>
      )}
      {/*
        Only terminal transitions reach this region. Announcing every poll tick
        while a compile runs would talk over the user for minutes.
      */}
      <div className="sr-only" aria-live="polite">
        {status === "finished" && "Compile finished. Exports are ready."}
        {status === "failed" && "Compile failed."}
      </div>
    </div>
  );
};

export default CompileBookStatusBar;
