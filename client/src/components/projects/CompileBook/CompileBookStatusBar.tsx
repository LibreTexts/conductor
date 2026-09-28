import { Badge, Text } from "@libretexts/davis-react";
import { format as formatDate } from "date-fns";
import { fileSizePresentable } from "../../../utils/assetHelpers";
import CompileProgress from "./CompileProgress";
import { useElapsedLabel } from "./elapsed";
import type { CompileStatus } from "../../../hooks/useShapeshift";
import type { BookExportInfo, ShapeshiftJob } from "../../../types/Shapeshift";

interface CompileBookStatusBarProps {
  status: CompileStatus;
  job: ShapeshiftJob | null;
  exportInfo: BookExportInfo | null;
  fileCount: number;
  totalSizeBytes: number;
  /** True while a finished compile's files are still being waited on. */
  isSettling: boolean;
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
  isSettling,
}) => {
  // `finished` is true before the downloads host is serving anything, so during
  // the settle window the badge says what is actually happening rather than
  // contradicting the pane, which is showing "Finishing up".
  const badge = isSettling
    ? { label: "Finishing up", variant: "primary" as const }
    : STATUS_BADGE[status];
  const running = status === "in-progress" || status === "submitting";
  const elapsedLabel = useElapsedLabel({
    startedAt: job?.createdAt,
    running,
    jobID: job?.id,
  });

  const facts: string[] = [];

  if (running) {
    if (job?.createdAt) {
      facts.push(`Started ${formatDate(new Date(job.createdAt), DATE_FORMAT)}`);
    }
  } else if (exportInfo?.lastCompiled) {
    facts.push(
      `Last compiled ${formatDate(new Date(exportInfo.lastCompiled), DATE_FORMAT)}`,
    );
  }

  if (job?.id) facts.push(`job ${job.id}`);

  // The stage and the elapsed counter live in this line, not under the bar.
  // This row is the only part of the drawer on screen for every status, so on a
  // book that already has downloads — where the pane shows an export instead of
  // the compiling empty state — it is the one place the user can see that a
  // long phase is still moving.
  if (running) {
    if (job?.stage) facts.push(job.stage);
    if (elapsedLabel) facts.push(elapsedLabel);
  }

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
        // when a previous compile's exports are still on screen.
        <CompileProgress progress={job?.progress} size="sm" />
      )}
      {/*
        Only terminal transitions reach this region. Announcing every poll tick
        while a compile runs would talk over the user for minutes.
      */}
      <div className="sr-only" aria-live="polite">
        {/*
          `fileCount` as well as the settle window: when the window gives up
          with nothing downloadable, `isSettling` goes false while `status`
          stays `finished`, which would announce exports as ready seconds after
          the notification said none were available.
        */}
        {status === "finished" &&
          !isSettling &&
          fileCount > 0 &&
          "Compile finished. Exports are ready."}
        {status === "failed" && "Compile failed."}
      </div>
    </div>
  );
};

export default CompileBookStatusBar;
