import React, { useMemo } from "react";
import {
  Button,
  Card,
  Modal,
  Progress,
  Stack,
  Text,
} from "@libretexts/davis-react";
import { useMutation } from "@tanstack/react-query";
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

  const { mutate: createPopulateJob, isPending: isCreatingJob } = useMutation({
    mutationFn: () => api.createPopulateJob(projectID),
    onSuccess: (response) => {
      if (response.err) return;
      window.location.reload();
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
        <Modal.Title>Populate References</Modal.Title>
        <Modal.Close aria-label="Close" />
      </Modal.Header>
      <Modal.Body>
        {hasJob ? (
          <Stack direction="vertical" gap="md">
            <Text size="sm" weight="semibold">
              Status: {job.status}
            </Text>
            <Progress
              value={progressValue}
              label={`${job.completedPages} / ${job.totalPages} pages`}
              showValue
            />
            {messages.length > 0 && (
              <Stack direction="vertical" gap="xs">
                <Text size="sm" weight="semibold">
                  Messages
                </Text>
                <Card variant="elevated">
                  <Card.Body className="max-h-48 overflow-y-auto">
                    <ul className="list-disc space-y-1 pl-5">
                      {messages.map((message, index) => (
                        <li key={`${index}-${message}`}>
                          <Text size="sm">{message}</Text>
                        </li>
                      ))}
                    </ul>
                  </Card.Body>
                </Card>
              </Stack>
            )}
          </Stack>
        ) : (
          <Stack direction="vertical" gap="sm">
            <Text size="lg" weight="bold">
              Before you populate, please note:
            </Text>
            <Text>Add all the references tags to the pages.</Text>
            <Text>Configure the references format and display location.</Text>
            <Text>
              Populate the references will generate the references list and
              updates your book.
            </Text>
            <Text>It may take a few minutes to populate the references.</Text>
            <Text>You will be notified when the references are populated.</Text>
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
            Populate
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default Populate;
