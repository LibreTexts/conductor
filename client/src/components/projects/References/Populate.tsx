import React, { useMemo } from "react";
import {
  Button,
  Card,
  Modal,
  Progress,
  Stack,
  Text,
} from "@libretexts/davis-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../api";

export type PopulateJobDetails = {
  status: string;
  message: string[];
  totalPages: number;
  completedPages: number;
};

interface PopulateProps {
  open: boolean;
  onClose: () => void;
  projectID: string;
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

const Populate: React.FC<PopulateProps> = ({
  open,
  onClose,
  projectID,
  job,
}) => {
  const hasJob = hasPopulateJobData(job);

  const queryClient = useQueryClient();
  const {
    mutate: createPopulateJob,
    isPending: isCreatingJob,
    isError: startFailed,
  } = useMutation({
    mutationFn: async () => {
      const response = await api.createPopulateJob(projectID);
      if (response.err) throw new Error("Failed to start populate job");
      return response;
    },
    onSuccess: () => {
      // Refetching the job shows its progress here; a page reload would also
      // throw away the user's place on the page.
      queryClient.invalidateQueries({
        queryKey: ["populateReferences", projectID],
      });
    },
  });

  const progressValue = useMemo(() => {
    if (!hasJob || job.totalPages <= 0) return 0;
    return Math.min(
      100,
      Math.round((job.completedPages / job.totalPages) * 100),
    );
  }, [hasJob, job]);

  const messages = hasJob
    ? Array.isArray(job.message)
      ? job.message
      : job.message
        ? [String(job.message)]
        : []
    : [];

  return (
    <Modal open={open} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>Scan Citations</Modal.Title>
        <Modal.Close aria-label="Close" />
      </Modal.Header>
      <Modal.Body>
        {hasJob ? (
          <Stack direction="vertical" gap="md">
            <div role="status" aria-live="polite">
              <Text size="sm" weight="semibold">
                Status: {job.status}
              </Text>
            </div>
            <Progress
              value={progressValue}
              label={`${job.completedPages} / ${job.totalPages} pages`}
              showValue
            />
            {messages.length > 0 && (
              <Stack direction="vertical" gap="xs">
                <h3
                  id="populate-messages-heading"
                  className="text-sm font-semibold"
                >
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
            )}
          </Stack>
        ) : (
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
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose} disabled={isCreatingJob}>
          Close
        </Button>
        {!hasJob && (
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
