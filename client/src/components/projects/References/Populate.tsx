import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Modal,
  Progress,
  Spinner,
  Stack,
  Text,
} from "@libretexts/davis-react";
import { IconAlertTriangle, IconCircleCheck } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../api";

export type PopulateJobDetails = {
  jobID?: string;
  status: string;
  message: string[];
  totalPages: number;
  completedPages: number;
};

interface PopulateProps {
  open: boolean;
  onClose: () => void;
  projectID: string;
  /** The book's latest scan, running or finished. */
  job?: PopulateJobDetails | null;
}

export function hasPopulateJobData(
  data: unknown,
): data is PopulateJobDetails {
  if (!data || typeof data !== "object") return false;
  const job = data as Partial<PopulateJobDetails>;
  return (
    typeof job.totalPages === "number" &&
    typeof job.completedPages === "number" &&
    typeof job.status === "string"
  );
}

/**
 * The scan this dialog is following. `previousJobID` is the latest scan when
 * following started, so that finished scan isn't mistaken for this one's
 * result while the new one is still being created.
 */
type Watch = { previousJobID?: string };

const Populate: React.FC<PopulateProps> = ({
  open,
  onClose,
  projectID,
  job,
}) => {
  const queryClient = useQueryClient();
  const [watch, setWatch] = useState<Watch | null>(null);

  const isRunning = job?.status === "pending";

  // Follow a scan that's already running when the dialog opens.
  useEffect(() => {
    if (open && isRunning && !watch) setWatch({});
  }, [open, isRunning, watch]);

  const {
    mutate: createPopulateJob,
    isPending: isCreatingJob,
    isError: startFailed,
    reset: resetStart,
  } = useMutation({
    mutationFn: async () => {
      const response = await api.createPopulateJob(projectID);
      if (response.err) throw new Error("Failed to start citation scan");
      return response;
    },
    onSuccess: () => {
      setWatch({ previousJobID: job?.jobID });
      queryClient.invalidateQueries({
        queryKey: ["populateReferences", projectID],
      });
    },
    // Usually a scan already running from elsewhere: refetching picks it up,
    // and the dialog then follows it.
    onError: () => {
      queryClient.invalidateQueries({
        queryKey: ["populateReferences", projectID],
      });
    },
  });

  // Closing ends this session; reopening offers a new scan.
  useEffect(() => {
    if (!open) {
      setWatch(null);
      resetStart();
    }
  }, [open, resetStart]);

  const finishedJob =
    watch && job && !isRunning && job.jobID !== watch.previousJobID
      ? job
      : null;
  const phase: "start" | "starting" | "running" | "finished" = !watch
    ? "start"
    : isRunning
      ? "running"
      : finishedJob
        ? "finished"
        : "starting";

  const progressValue = useMemo(() => {
    if (!job || job.totalPages <= 0) return 0;
    return Math.min(
      100,
      Math.round((job.completedPages / job.totalPages) * 100),
    );
  }, [job]);

  const messages = job
    ? Array.isArray(job.message)
      ? job.message
      : job.message
        ? [String(job.message)]
        : []
    : [];

  const messageList = messages.length > 0 && (
    <Stack direction="vertical" gap="xs">
      <h3 id="populate-messages-heading" className="text-sm font-semibold">
        Messages
      </h3>
      <Card variant="elevated">
        {/* Scrollable, so it must be reachable from the keyboard. */}
        <Card.Body>
          <div
            className="max-h-48 overflow-y-auto"
            tabIndex={0}
            role="region"
            aria-labelledby="populate-messages-heading"
          >
            <ul className="list-disc space-y-1 pl-5">
              {messages.map((message, index) => (
                <li key={`${index}-${message}`}>
                  <Text size="sm">{message}</Text>
                </li>
              ))}
            </ul>
          </div>
        </Card.Body>
      </Card>
    </Stack>
  );

  return (
    <Modal open={open} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>Scan Citations</Modal.Title>
        <Modal.Close aria-label="Close" />
      </Modal.Header>
      <Modal.Body>
        {phase === "start" && (
          <Stack direction="vertical" gap="sm">
            <h3 className="text-lg font-bold">Before you scan</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Cite references on the pages first.</li>
              <li>Set the citation format and scope.</li>
              <li>
                Scanning reads the citations on every page so the library can
                show each page&apos;s reference list, and checks them against
                this book&apos;s references. It doesn&apos;t change your pages.
              </li>
              <li>It may take a few minutes. Progress shows here.</li>
            </ul>
            <div role="alert">
              {startFailed && (
                <Text size="sm" className="text-danger">
                  The scan couldn&apos;t start. Try again, or check that a scan
                  isn&apos;t already running for this book.
                </Text>
              )}
            </div>
          </Stack>
        )}

        {phase === "starting" && <Spinner text="Starting the scan…" />}

        {phase === "running" && job && (
          <Stack direction="vertical" gap="md">
            <div role="status" aria-live="polite">
              <Text size="sm" weight="semibold">
                Scanning pages…
              </Text>
            </div>
            <Progress
              value={progressValue}
              label={`${job.completedPages} / ${job.totalPages} pages`}
              showValue
            />
            {messageList}
          </Stack>
        )}

        {phase === "finished" && finishedJob && (
          <Stack direction="vertical" gap="md">
            {finishedJob.status === "completed" ? (
              <p
                role="status"
                className="flex items-center gap-2 text-sm font-semibold text-neutral-800"
              >
                <IconCircleCheck
                  size={20}
                  className="shrink-0 text-success"
                  aria-hidden="true"
                />
                Scan finished successfully. {finishedJob.completedPages} of{" "}
                {finishedJob.totalPages} pages scanned.
              </p>
            ) : (
              <p
                role="alert"
                className="flex items-center gap-2 text-sm font-semibold text-danger"
              >
                <IconAlertTriangle
                  size={20}
                  className="shrink-0"
                  aria-hidden="true"
                />
                The scan didn&apos;t finish. Close this and open Scan Citations
                again to retry.
              </p>
            )}
            {messageList}
          </Stack>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose} disabled={isCreatingJob}>
          Close
        </Button>
        {phase === "start" && (
          <Button
            variant="primary"
            onClick={() => createPopulateJob()}
            disabled={!projectID || isCreatingJob}
            loading={isCreatingJob}
          >
            Start Scan
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default Populate;
