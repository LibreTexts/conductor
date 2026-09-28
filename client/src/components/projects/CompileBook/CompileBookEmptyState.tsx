import { Button, EmptyState } from "@libretexts/davis-react";
import { IconBook, IconRefresh, IconSend } from "@tabler/icons-react";
import CompileProgress from "./CompileProgress";
import { useElapsedLabel } from "./elapsed";
import type { CompileStatus } from "../../../hooks/useShapeshift";

interface CompileBookEmptyStateProps {
  status:
    | Extract<
        CompileStatus,
        "never-compiled" | "submitting" | "in-progress" | "failed"
      >
    /**
     * Not a `CompileStatus`: the job is finished but its files are not being
     * served yet. Owned by the drawer, which knows about the settle window.
     */
    | "finalizing";
  isCompiling: boolean;
  onCompile: () => void;
  /** Completion percentage from Shapeshift, absent until it starts reporting. */
  progress?: number;
  /** What the job is doing right now, e.g. "Generating PDF". */
  stage?: string;
  /** ISO timestamp the job started, used for the elapsed counter. */
  startedAt?: string;
  /** Job identity, so a resubmit restarts the elapsed count. */
  jobID?: string;
}

/**
 * Fills the detail pane whenever there is no export to show.
 *
 * These three cases were not covered by the design, so they stay deliberately
 * plain: a Davis `EmptyState` and the one action that moves the user forward.
 */
const CompileBookEmptyState: React.FC<CompileBookEmptyStateProps> = ({
  status,
  isCompiling,
  onCompile,
  progress,
  stage,
  startedAt,
  jobID,
}) => {
  const running = status === "in-progress" || status === "submitting";
  const elapsedLabel = useElapsedLabel({ startedAt, running, jobID });

  // The compile succeeded; the downloads host is just a few seconds behind.
  // Deliberately says nothing about anything being missing or wrong.
  if (status === "finalizing") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
        <EmptyState
          icon={<IconBook size={32} aria-hidden="true" />}
          title="Finishing up"
          description="The compile succeeded. Your files are being published and will appear here in a few seconds."
        />
        <div className="w-80">
          <CompileProgress size="md" label="Publishing exports" />
        </div>
      </div>
    );
  }

  if (running) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
        <EmptyState
          icon={<IconBook size={32} aria-hidden="true" />}
          title="Compiling this book"
          description="This usually takes a few minutes. You can close this panel and come back later; the compile keeps running. Books that are larger or heavy in math/chem expressions (LaTeX) may take slightly longer to render and compile."
        />
        <div className="w-80">
          <CompileProgress progress={progress} size="md" />
          {/*
            Not an aria-live region on purpose: announcing this every second
            would talk over the user for the length of the compile.
          */}
          {(stage || elapsedLabel) && (
            <p className="m-0 mt-1.5 text-xs text-gray-500">
              {[stage, elapsedLabel].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <EmptyState
          icon={<IconRefresh size={32} aria-hidden="true" />}
          title="The last compile failed"
          description="Shapeshift could not finish building this book's exports. Try again, and contact support if it keeps failing."
          action={
            <Button
              variant="primary"
              icon={<IconRefresh size={16} />}
              onClick={onCompile}
              loading={isCompiling}
            >
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center px-8">
      <EmptyState
        icon={<IconBook size={32} aria-hidden="true" />}
        title="This book has not been compiled yet"
        description="Compile it to generate print-ready PDFs, an LMS cartridge, and per-page PDFs."
        action={
          <Button
            variant="primary"
            icon={<IconSend size={16} />}
            onClick={onCompile}
            loading={isCompiling}
          >
            Compile book
          </Button>
        }
      />
    </div>
  );
};

export default CompileBookEmptyState;
