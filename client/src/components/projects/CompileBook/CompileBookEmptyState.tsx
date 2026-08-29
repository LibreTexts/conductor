import { Button, EmptyState, Progress } from "@libretexts/davis-react";
import { IconBook, IconRefresh, IconSend } from "@tabler/icons-react";
import type { CompileStatus } from "../../../hooks/useShapeshift";

interface CompileBookEmptyStateProps {
  status: Extract<
    CompileStatus,
    "never-compiled" | "submitting" | "in-progress" | "failed"
  >;
  isCompiling: boolean;
  onCompile: () => void;
  /** Completion percentage from Shapeshift, absent until it starts reporting. */
  progress?: number;
  /** What the job is doing right now, e.g. "Generating PDF". */
  stage?: string;
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
}) => {
  if (status === "in-progress" || status === "submitting") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
        <EmptyState
          icon={<IconBook size={40} aria-hidden="true" />}
          title="Compiling this book"
          description="This usually takes a few minutes. You can close this panel and come back later; the compile keeps running."
        />
        {/*
          `progress` is passed straight through: Shapeshift does not report a
          percentage for every job or from the moment one is accepted, and an
          undefined value renders an indeterminate bar rather than a fabricated
          zero.
        */}
        <div className="w-80">
          <Progress
            value={progress}
            label={stage ?? "Compile in progress"}
            showValue
          />
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <EmptyState
          icon={<IconRefresh size={40} aria-hidden="true" />}
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
        icon={<IconBook size={40} aria-hidden="true" />}
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
