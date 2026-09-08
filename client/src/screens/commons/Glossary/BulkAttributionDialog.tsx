import { Alert, Button, Input, Modal, Select } from "@libretexts/davis-react";
import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import api from "../../../api";
import { licenseOptions } from "../../../components/util/LicenseOptions";
import type { Notification } from "../../../context/NotificationContext";
import { GlossaryEntry } from "./model";

interface BulkAttributionDialogProps {
  open: boolean;
  onClose: () => void;
  library: string;
  coverID: string;
  terms: GlossaryEntry[];
  addNotification: (notification: Notification) => void;
  onUpdated: () => void;
}

type FormFields = {
  author: string;
  link: string;
  source: string;
};

const DEFAULT_VALUES: FormFields = { author: "", link: "", source: "" };

function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { errMsg?: string } | undefined;
    if (data?.errMsg) return data.errMsg;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

const BulkAttributionDialog: React.FC<BulkAttributionDialogProps> = ({
  open,
  onClose,
  library,
  coverID,
  terms,
  addNotification,
  onUpdated,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormFields>({ defaultValues: DEFAULT_VALUES });

  useEffect(() => {
    if (open) reset(DEFAULT_VALUES);
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormFields) => {
      const author = data.author.trim();
      const link = data.link.trim();
      const source = data.source.trim();
      if (!author && !link && !source) {
        throw new Error("Enter at least one field to update.");
      }
      const res = await api.bulkUpdateGlossaryAttribution({
        library,
        coverID,
        usageIds: terms.map((t) => t.usageID),
        author: author || undefined,
        link: link || undefined,
        source: source || undefined,
      });
      if (res.err) {
        throw new Error(res.errMsg ?? "Failed to update attribution.");
      }
      return res;
    },
    onSuccess: (res) => {
      addNotification({
        message: `Updated attribution for ${res.modifiedCount} glossary term${
          res.modifiedCount === 1 ? "" : "s"
        }.`,
        type: "success",
      });
      onUpdated();
      handleClose();
    },
  });

  const handleClose = () => {
    reset(DEFAULT_VALUES);
    onClose();
  };

  const values = watch();
  const hasAnyValue = !!(
    values.author?.trim() ||
    values.link?.trim() ||
    values.source?.trim()
  );

  return (
    <Modal
      open={open}
      onClose={(v) => !v && !mutation.isLoading && handleClose()}
      size="md"
    >
      <Modal.Header>
        <Modal.Title>Update Attribution</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-sm text-neutral-600">
          Apply these fields to {terms.length} selected term
          {terms.length === 1 ? "" : "s"}. Leave a field blank to leave it
          unchanged on those terms.
        </p>
        <ul className="mt-2 max-h-24 space-y-0.5 overflow-y-auto text-xs text-neutral-500">
          {terms.map((t) => (
            <li key={t.usageID} className="truncate">
              {t.term}
            </li>
          ))}
        </ul>
        <form
          className="mt-4 space-y-4"
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
        >
          <Input
            label="Link"
            placeholder="https://..."
            error={!!errors.link}
            errorMessage={errors.link?.message}
            {...register("link", {
              validate: (value) => {
                if (!value?.trim()) return true;
                try {
                  new URL(value.trim());
                  return true;
                } catch {
                  return "Please enter a valid URL";
                }
              },
            })}
          />
          <Select
            label="Source (License)"
            placeholder="Select a license…"
            options={licenseOptions.map((o) => ({
              value: o.value,
              label: o.text,
            }))}
            {...register("source")}
          />
          <Input
            label="Author"
            placeholder="Author of the term…"
            {...register("author")}
          />
        </form>
        {mutation.isError && (
          <Alert
            className="mt-4"
            message={getErrorMessage(
              mutation.error,
              "Failed to update attribution.",
            )}
            variant="error"
          />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="ghost"
          onClick={handleClose}
          disabled={mutation.isLoading}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit((data) => mutation.mutate(data))}
          loading={mutation.isLoading}
          disabled={mutation.isLoading || !hasAnyValue}
        >
          Apply to {terms.length} Term{terms.length === 1 ? "" : "s"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default BulkAttributionDialog;
