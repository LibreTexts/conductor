import { useId } from "react";
import { Badge, Button, Progress, Text } from "@libretexts/davis-react";
import { format as formatDate } from "date-fns";
import type { PublishStepStatus } from "../../../types/Publish";

const STATUS_BADGE: Record<
  PublishStepStatus,
  { label: string; variant: "default" | "primary" | "success" | "danger" }
> = {
  "not-started": { label: "Not started", variant: "default" },
  running: { label: "In progress", variant: "primary" },
  succeeded: { label: "Done", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
};

/** Matches the compile drawer, so a timestamp reads the same across Conductor. */
const DATE_FORMAT = "MM/dd/yyyy h:mm aaa";

interface PublishStepProps {
  index: number;
  title: string;
  description: string;
  status: PublishStepStatus;
  /** Short facts the step recorded — a job ID, the path it wrote. */
  facts?: (string | undefined)[];
  finishedAt?: string;
  errorMessage?: string;
  /** Progress of an in-flight run, 0-100. Omit for an indeterminate step. */
  percentage?: number;
  actionLabel: string;
  actionIcon?: React.ReactNode;
  onRun: () => void;
  isSubmitting: boolean;
  /** Blocks the action for a reason of the step's own, e.g. no destination picked. */
  actionDisabled?: boolean;
  /** Rendered between the description and the action, e.g. the destination picker. */
  children?: React.ReactNode;
}

/**
 * One row of the publishing flow.
 *
 * Every step is independently runnable, so a row never disables its button
 * because of another step. `actionDisabled` covers only reasons internal to the
 * step itself.
 */
const PublishStep: React.FC<PublishStepProps> = ({
  index,
  title,
  description,
  status,
  facts = [],
  finishedAt,
  errorMessage,
  percentage,
  actionLabel,
  actionIcon,
  onRun,
  isSubmitting,
  actionDisabled = false,
  children,
}) => {
  const errorId = useId();
  const badge = STATUS_BADGE[status];
  const running = status === "running" || isSubmitting;

  const shownFacts = facts.filter((f): f is string => !!f);
  if (status === "succeeded" && finishedAt) {
    shownFacts.push(formatDate(new Date(finishedAt), DATE_FORMAT));
  }

  return (
    <li className="border-b border-gray-200 px-6 py-5 last:border-b-0">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700"
        >
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Text weight="semibold" className="!mb-0">
              {title}
            </Text>
            {/* The status is a text label, not colour alone, so it is part of
                the row's reading for assistive tech too. */}
            <Badge variant={badge.variant} label={badge.label} />
          </div>
          <Text size="sm" color="muted" className="!mt-1 !mb-0 !mr-0.5">
            {description}
          </Text>

          {shownFacts.length > 0 && (
            <Text size="sm" color="muted" className="!mt-2 !mb-0 break-all">
              {shownFacts.join(" · ")}
            </Text>
          )}

          {/* Only shown when the runner actually reports a number. A step whose
              progress is unknown gets the badge and the button spinner rather
              than a bar implying precision that is not there. */}
          {status === "running" && percentage !== undefined && (
            <div className="mt-3 max-w-md">
              <Progress
                value={percentage}
                showValue
                aria-label={`${title} progress`}
              />
            </div>
          )}

          {status === "failed" && errorMessage && (
            <Text id={errorId} size="sm" color="danger" className="!mt-2 !mb-0">
              {errorMessage}
            </Text>
          )}

          {children && <div className="mt-4">{children}</div>}
        </div>

        <div className="shrink-0">
          <Button
            variant={status === "succeeded" ? "outline" : "primary"}
            size="sm"
            onClick={onRun}
            loading={running}
            softDisabled={actionDisabled}
            icon={actionIcon}
            aria-describedby={
              status === "failed" && errorMessage ? errorId : undefined
            }
          >
            {status === "failed" ? "Retry" : actionLabel}
          </Button>
        </div>
      </div>
    </li>
  );
};

export default PublishStep;
