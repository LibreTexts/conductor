import React, { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Button, Modal } from "@libretexts/davis-react";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconFileTypeCsv,
  IconX,
} from "@tabler/icons-react";
import api from "../../../api";
import type { Notification } from "../../../context/NotificationContext";

interface GlossaryCsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  library: string;
  coverID: string;
  glossaryID?: string;
  addNotification: (notification: Notification) => void;
  onImported: () => void;
}

type FileStatus = "queued" | "confirm" | "importing" | "success" | "error";

interface QueuedFile {
  id: string;
  file: File;
  status: FileStatus;
  totalRows: number;
  processedRows: number;
  imported: number;
  updated: number;
  duplicateTerms?: string[];
  errorMessage?: string;
  jobID?: string;
}

interface RejectedFile {
  id: string;
  name: string;
  reason: string;
}

const POLL_INTERVAL_MS = 2000;
/**
 * Consecutive failed status checks tolerated before giving up on a job. A
 * single blip must not mark a still-running import failed — the user would
 * re-upload and overwrite the definitions it is writing.
 */
const MAX_CONSECUTIVE_POLL_FAILURES = 5;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const uniqueId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/** Splits a single CSV line into cells, honoring simple double-quoting. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

/**
 * Fast, best-effort client-side checks so obviously-bad files are rejected
 * immediately instead of round-tripping to the server. The server still owns
 * authoritative CSV parsing/validation.
 */
async function validateCsvFile(
  file: File,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!/\.csv$/i.test(file.name)) {
    return { ok: false, reason: "Only .csv files are supported." };
  }
  if (file.size === 0) {
    return { ok: false, reason: "File is empty." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, reason: "CSV file must be smaller than 5 MB." };
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, reason: "Unable to read file." };
  }

  const firstDataLine = text
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0);
  if (!firstDataLine) {
    return { ok: false, reason: "File is empty." };
  }
  if (splitCsvLine(firstDataLine).length < 2) {
    return {
      ok: false,
      reason: "CSV must have at least two columns (term, definition).",
    };
  }

  return { ok: true };
}

/** "imported 3 new terms and updated 2 existing terms" */
function describeImportCounts(imported: number, updated: number): string {
  const terms = (n: number) => `${n} ${n === 1 ? "term" : "terms"}`;
  const parts = [`imported ${terms(imported)}`];
  if (updated > 0) parts.push(`updated ${terms(updated)} that already existed`);
  return parts.join(" and ");
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { errMsg?: string } | undefined;
    if (data?.errMsg) return data.errMsg;
    if (err.response?.status === 413) {
      return "CSV file is too large to upload.";
    }
    if (!err.response) {
      return "Could not reach the server. Check your connection and try again.";
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

const GlossaryCsvImportDialog: React.FC<GlossaryCsvImportDialogProps> = ({
  open,
  onClose,
  library,
  coverID,
  glossaryID,
  addNotification,
  onImported,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [rejectedFiles, setRejectedFiles] = useState<RejectedFile[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [validating, setValidating] = useState(false);

  const batchStarted = activeIndex >= 0;
  const batchComplete = batchStarted && activeIndex >= queue.length;
  const activeFile =
    activeIndex >= 0 && activeIndex < queue.length ? queue[activeIndex] : null;
  const isImportingActive =
    activeFile?.status === "importing" || activeFile?.status === "queued";

  const updateQueueItem = (index: number, patch: Partial<QueuedFile>) => {
    setQueue((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const startMutation = useMutation({
    mutationFn: async (vars: {
      index: number;
      duplicateAction?: "overwrite" | "skip";
    }) => {
      const target = queue[vars.index];
      const res = await api.importGlossaryTermsFromCsv({
        library,
        coverID,
        file: target.file,
        glossaryID,
        duplicateAction: vars.duplicateAction,
      });
      if (res.err) {
        throw new Error(res.errMsg ?? "Failed to start glossary CSV import.");
      }
      return { res, index: vars.index };
    },
    onSuccess: ({ res, index }) => {
      if (res.requiresConfirmation) {
        updateQueueItem(index, {
          status: "confirm",
          duplicateTerms: res.duplicateTerms ?? [],
          totalRows: res.totalRows,
        });
        return;
      }
      updateQueueItem(index, {
        status: "importing",
        jobID: res.jobID,
        totalRows: res.totalRows,
        processedRows: 0,
      });
    },
    onError: (err, vars) => {
      updateQueueItem(vars.index, {
        status: "error",
        errorMessage: getErrorMessage(
          err,
          "Failed to start glossary CSV import.",
        ),
      });
      setActiveIndex(vars.index + 1);
    },
  });

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollFailuresRef = useRef(0);
  const stopPolling = () => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const { mutate: pollJob } = useMutation({
    mutationFn: async (vars: { jobID: string; index: number }) => {
      const res = await api.getGlossaryCsvImportJobStatus(vars.jobID);
      if (res.err) {
        throw new Error(res.errMsg ?? "Failed to check import progress.");
      }
      return { job: res.job, index: vars.index };
    },
    onSuccess: ({ job, index }) => {
      pollFailuresRef.current = 0;
      updateQueueItem(index, {
        totalRows: job.totalRows,
        processedRows: job.processedRows,
      });
      if (job.status === "success") {
        stopPolling();
        updateQueueItem(index, {
          status: "success",
          imported: job.imported,
          updated: job.updated,
        });
        addNotification({
          message: `${queue[index]?.file.name}: ${describeImportCounts(job.imported, job.updated)}.`,
          type: "success",
        });
        onImported();
        setActiveIndex(index + 1);
      } else if (job.status === "error") {
        stopPolling();
        updateQueueItem(index, {
          status: "error",
          errorMessage: job.errorMessage ?? "Failed to import glossary terms.",
        });
        setActiveIndex(index + 1);
      }
    },
    onError: (err, vars) => {
      // 4xx (job gone, no access) won't fix itself; anything else is retried
      // on the next tick until it has failed too many times in a row.
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const permanent = status !== undefined && status >= 400 && status < 500;
      pollFailuresRef.current += 1;
      if (!permanent && pollFailuresRef.current < MAX_CONSECUTIVE_POLL_FAILURES) {
        return;
      }
      stopPolling();
      updateQueueItem(vars.index, {
        status: "error",
        errorMessage: permanent
          ? getErrorMessage(err, "Failed to check import progress.")
          : "Lost contact with the server. The import may still be running — check the glossary before uploading this file again.",
      });
      setActiveIndex(vars.index + 1);
    },
  });

  // Kick off each queued file exactly once, as the batch advances to it.
  useEffect(() => {
    if (activeIndex < 0 || activeIndex >= queue.length) return;
    if (queue[activeIndex].status !== "queued") return;
    startMutation.mutate({ index: activeIndex });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  useEffect(() => {
    if (!activeFile?.jobID || activeFile.status !== "importing") return;
    const index = activeIndex;
    const jobID = activeFile.jobID;
    pollFailuresRef.current = 0;
    pollIntervalRef.current = setInterval(
      () => pollJob({ jobID, index }),
      POLL_INTERVAL_MS,
    );
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, activeFile?.jobID, activeFile?.status]);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setValidating(true);
    const accepted: QueuedFile[] = [];
    const rejected: RejectedFile[] = [];
    for (const file of Array.from(fileList)) {
      const result = await validateCsvFile(file);
      if (result.ok) {
        accepted.push({
          id: uniqueId(),
          file,
          status: "queued",
          totalRows: 0,
          processedRows: 0,
          imported: 0,
          updated: 0,
        });
      } else {
        rejected.push({ id: uniqueId(), name: file.name, reason: result.reason });
      }
    }
    setQueue((prev) => [...prev, ...accepted]);
    setRejectedFiles((prev) => [...prev, ...rejected]);
    setValidating(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    void handleFilesSelected(e.target.files);
    e.target.value = "";
  };

  const removeQueuedFile = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const dismissRejectedFile = (id: string) => {
    setRejectedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClose = () => {
    stopPolling();
    setQueue([]);
    setRejectedFiles([]);
    setActiveIndex(-1);
    setValidating(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  };

  const handleStartBatch = () => {
    if (queue.length === 0) return;
    setActiveIndex(0);
  };

  const successCount = queue.filter((q) => q.status === "success").length;
  const errorCount = queue.filter((q) => q.status === "error").length;

  return (
    <Modal
      open={open}
      onClose={(v) => !v && !isImportingActive && handleClose()}
      size="md"
    >
      <Modal.Header>
        <Modal.Title>Import Terms from CSV</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {!batchStarted && (
          <>
            <p className="text-sm text-neutral-600">
              Upload one or more CSV files, each with two columns:{" "}
              <strong>term</strong> and <strong>definition</strong>. A header
              row is optional.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              multiple
              className="sr-only"
              id="glossary-csv-upload"
              onChange={handleFileChange}
              disabled={validating}
            />
            <label
              htmlFor="glossary-csv-upload"
              className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded border border-dashed border-neutral-300 px-6 py-5 text-sm text-neutral-500 hover:border-neutral-400 hover:bg-neutral-50"
            >
              <IconFileTypeCsv size={24} className="text-neutral-400" />
              <span>
                {validating
                  ? "Checking files..."
                  : "Click to upload CSV file(s)"}
              </span>
            </label>

            {queue.length > 0 && (
              <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto">
                {queue.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 rounded border border-neutral-200 px-3 py-2"
                  >
                    <IconFileTypeCsv size={20} className="text-neutral-500" />
                    <span className="flex-1 truncate text-sm">
                      {item.file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeQueuedFile(item.id)}
                      aria-label={`Remove ${item.file.name}`}
                      className="rounded-full p-0.5 hover:bg-neutral-100"
                    >
                      <IconX size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {rejectedFiles.length > 0 && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-red-800">
                  <IconAlertTriangle size={16} />
                  {rejectedFiles.length} file
                  {rejectedFiles.length === 1 ? "" : "s"} could not be added
                </p>
                <ul className="mt-2 space-y-1">
                  {rejectedFiles.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-2 text-sm text-red-700"
                    >
                      <span>
                        <strong className="break-all">{item.name}</strong>:{" "}
                        {item.reason}
                      </span>
                      <button
                        type="button"
                        onClick={() => dismissRejectedFile(item.id)}
                        aria-label={`Dismiss error for ${item.name}`}
                        className="shrink-0 rounded-full p-0.5 hover:bg-red-100"
                      >
                        <IconX size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {batchStarted && (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {queue.map((item, index) => {
              const isActive = index === activeIndex;
              const progressPercent =
                item.totalRows > 0
                  ? Math.round((item.processedRows / item.totalRows) * 100)
                  : 0;
              return (
                <li
                  key={item.id}
                  className={`rounded-md border p-3 ${
                    isActive
                      ? "border-blue-300 bg-blue-50"
                      : "border-neutral-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {item.status === "success" && (
                      <IconCircleCheck size={18} className="text-green-600" />
                    )}
                    {item.status === "error" && (
                      <IconAlertTriangle size={18} className="text-red-600" />
                    )}
                    {(item.status === "queued" ||
                      item.status === "importing" ||
                      item.status === "confirm") && (
                      <IconFileTypeCsv size={18} className="text-blue-500" />
                    )}
                    <span className="flex-1 truncate text-sm font-medium">
                      {item.file.name}
                    </span>
                    <span className="text-xs capitalize text-neutral-500">
                      {item.status === "queued" && index > activeIndex
                        ? "Pending"
                        : item.status === "queued"
                          ? "Starting..."
                          : item.status === "importing"
                            ? "Importing"
                            : item.status === "confirm"
                              ? "Needs input"
                              : item.status === "success"
                                ? "Done"
                                : "Failed"}
                    </span>
                  </div>

                  {isActive && item.status === "importing" && (
                    <div className="mt-2">
                      <p className="text-xs text-blue-700">
                        {item.totalRows > 0
                          ? `Processed ${item.processedRows} of ${item.totalRows} rows...`
                          : "Starting import..."}
                      </p>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-blue-100">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {isActive && item.status === "confirm" && (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-semibold text-amber-800">
                        {item.duplicateTerms?.length} term
                        {item.duplicateTerms?.length === 1 ? "" : "s"}{" "}
                        already{" "}
                        {item.duplicateTerms?.length === 1
                          ? "exists"
                          : "exist"}{" "}
                        in this glossary
                      </p>
                      <p className="mt-1 text-xs text-amber-700">
                        Choose whether to overwrite the existing definitions
                        or skip these terms and import only the new ones.
                      </p>
                      <ul className="mt-2 max-h-24 list-disc overflow-y-auto pl-5 text-xs text-amber-800">
                        {item.duplicateTerms?.map((term) => (
                          <li key={term}>{term}</li>
                        ))}
                      </ul>
                      <div className="mt-3 flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          onClick={() =>
                            startMutation.mutate({
                              index,
                              duplicateAction: "skip",
                            })
                          }
                          loading={startMutation.isLoading}
                          disabled={startMutation.isLoading}
                        >
                          Skip Duplicates
                        </Button>
                        <Button
                          onClick={() =>
                            startMutation.mutate({
                              index,
                              duplicateAction: "overwrite",
                            })
                          }
                          loading={startMutation.isLoading}
                          disabled={startMutation.isLoading}
                        >
                          Overwrite
                        </Button>
                      </div>
                    </div>
                  )}

                  {item.status === "error" && item.errorMessage && (
                    <p className="mt-1 text-xs text-red-700">
                      {item.errorMessage}
                    </p>
                  )}
                  {item.status === "success" && (
                    <p className="mt-1 text-xs text-green-700">
                      {capitalizeFirst(describeImportCounts(item.imported, item.updated))}.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {batchComplete && (
          <p className="mt-3 text-sm text-neutral-600">
            Finished: {successCount} of {queue.length} file
            {queue.length === 1 ? "" : "s"} imported successfully
            {errorCount > 0 ? `, ${errorCount} failed` : ""}.
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        {!batchStarted ? (
          <>
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleStartBatch}
              disabled={queue.length === 0 || validating}
            >
              Import {queue.length > 0 ? `(${queue.length})` : ""}
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isImportingActive}
          >
            {batchComplete ? "Close" : "Cancel"}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default GlossaryCsvImportDialog;
