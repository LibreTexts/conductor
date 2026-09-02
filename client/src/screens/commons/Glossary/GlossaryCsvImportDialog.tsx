import React, { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Modal } from "@libretexts/davis-react";
import { IconFileTypeCsv, IconX } from "@tabler/icons-react";
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

type JobStatus = "idle" | "pending" | "running" | "success" | "error";

const POLL_INTERVAL_MS = 2000;

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
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobID, setJobID] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>("idle");
  const [totalRows, setTotalRows] = useState(0);
  const [processedRows, setProcessedRows] = useState(0);

  const isImporting = jobStatus === "pending" || jobStatus === "running";

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!file) {
        throw new Error("Please select a CSV file to upload.");
      }
      const res = await api.importGlossaryTermsFromCsv({
        library,
        coverID,
        file,
        glossaryID,
      });
      if (res.err) {
        throw new Error(res.errMsg ?? "Failed to start glossary CSV import.");
      }
      return res;
    },
    onSuccess: (res) => {
      setError(null);
      setJobID(res.jobID);
      setTotalRows(res.totalRows);
      setProcessedRows(0);
      setJobStatus("pending");
    },
    onError: (err) => {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start glossary CSV import.",
      );
    },
  });

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = () => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const { mutate: pollJob } = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.getGlossaryCsvImportJobStatus(id);
      if (res.err) {
        throw new Error(res.errMsg ?? "Failed to check import progress.");
      }
      return res.job;
    },
    onSuccess: (job) => {
      setJobStatus(job.status);
      setTotalRows(job.totalRows);
      setProcessedRows(job.processedRows);
      if (job.status === "success") {
        stopPolling();
        addNotification({
          message: `Imported ${job.imported} glossary term${
            job.imported === 1 ? "" : "s"
          } from CSV.`,
          type: "success",
        });
        onImported();
        handleClose();
      } else if (job.status === "error") {
        stopPolling();
        setError(job.errorMessage ?? "Failed to import glossary terms.");
      }
    },
    onError: (err) => {
      stopPolling();
      setJobStatus("error");
      setError(
        err instanceof Error ? err.message : "Failed to check import progress.",
      );
    },
  });

  useEffect(() => {
    if (!jobID || !isImporting) return;
    pollIntervalRef.current = setInterval(() => pollJob(jobID), POLL_INTERVAL_MS);
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobID]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setFile(e.target.files?.[0] ?? null);
  };

  const handleClose = () => {
    stopPolling();
    setFile(null);
    setError(null);
    setJobID(null);
    setJobStatus("idle");
    setTotalRows(0);
    setProcessedRows(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  };

  const progressPercent =
    totalRows > 0 ? Math.round((processedRows / totalRows) * 100) : 0;

  return (
    <Modal open={open} onClose={(v) => !v && !isImporting && handleClose()} size="md">
      <Modal.Header>
        <Modal.Title>Import Terms from CSV</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-sm text-neutral-600">
          Upload a CSV file with two columns: <strong>term</strong> and{" "}
          <strong>definition</strong>. A header row is optional.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          id="glossary-csv-upload"
          onChange={handleFileChange}
          disabled={isImporting}
        />
        <div className="mt-4">
          {file ? (
            <div className="flex items-center gap-2 rounded border border-neutral-200 px-3 py-2">
              <IconFileTypeCsv size={20} className="text-neutral-500" />
              <span className="flex-1 truncate text-sm">{file.name}</span>
              {!isImporting && (
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  aria-label="Remove file"
                  className="rounded-full p-0.5 hover:bg-neutral-100"
                >
                  <IconX size={14} />
                </button>
              )}
            </div>
          ) : (
            <label
              htmlFor="glossary-csv-upload"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded border border-dashed border-neutral-300 px-6 py-5 text-sm text-neutral-500 hover:border-neutral-400 hover:bg-neutral-50"
            >
              <IconFileTypeCsv size={24} className="text-neutral-400" />
              <span>Click to upload a CSV file</span>
            </label>
          )}
        </div>
        {isImporting && (
          <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4">
            <p className="font-semibold text-blue-800">Import in progress</p>
            <p className="mt-1 text-sm text-blue-700">
              {totalRows > 0
                ? `Processed ${processedRows} of ${totalRows} rows...`
                : "Starting import..."}
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-blue-100">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-blue-700">
              This may take a moment for large files. Please keep this window
              open until the import finishes.
            </p>
          </div>
        )}
        {error && <Alert className="mt-4" message={error} variant="error" />}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={handleClose} disabled={isImporting}>
          {jobStatus === "success" ? "Close" : "Cancel"}
        </Button>
        <Button
          onClick={() => startMutation.mutate()}
          loading={startMutation.isLoading || isImporting}
          disabled={!file || startMutation.isLoading || isImporting}
        >
          Import
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default GlossaryCsvImportDialog;
