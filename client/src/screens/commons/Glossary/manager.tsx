import { Alert, Button, Input, Modal, Textarea } from "@libretexts/davis-react";
import { IconPhoto, IconX } from "@tabler/icons-react";
import React, { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import GlossaryTermAutocomplete from "./GlossaryTermAutocomplete";
import api from "../../../api";
import { GlossaryEntry } from "./model";
import type { Notification } from "../../../context/NotificationContext";

interface GlossaryFormProps {
  open: boolean;
  onClose: () => void;
  selectedNode: { id: string } | null;
  coverID: string;
  bookID: string;
  library: string;
  glossaryID?: string;
  onTermCreated?: () => void;
  setGlossaryEntries?: (entries: GlossaryEntry[]) => void;
  addNotification: (notification: Notification) => void;
}

type GlossaryFormFields = {
  term: string;
  definition: string;
  altText?: string;
  caption?: string;
  link?: string;
  source?: string;
};

const DEFAULT_VALUES: GlossaryFormFields = {
  term: "",
  definition: "",
  altText: "",
  caption: "",
  link: "",
  source: "",
};


const GlossaryForm: React.FC<GlossaryFormProps> = (props) => {
  const [contextError, setContextError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { open, onClose, selectedNode, coverID, bookID, library,glossaryID, onTermCreated , addNotification} = props;

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
    trigger,
  } = useForm<GlossaryFormFields>({
    mode: "onSubmit",
    defaultValues: DEFAULT_VALUES,
  });

  const hasImage = !!imageFile;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
    trigger("altText");
  };

  const handleRemoveImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    trigger("altText");
  };

  const validateContext = (): string | null => {
    
    if (!coverID.trim()) {
      return "Cover ID is required.";
    }
    if (!library.trim()) {
      return "Library is required.";
    }
    return null;
  };

  const onSubmitHandler = async (data: GlossaryFormFields) => {
    const contextErr = validateContext();
    if (contextErr) {
      setContextError(contextErr);
      return;
    }

    setContextError(null);

    const res = await api.createGlossaryTerm({
      term: data.term.trim(),
      definition: data.definition.trim(),
      coverID: coverID.trim(),
      bookId: bookID.trim() === "" ? undefined : bookID.trim(),
      library: library.trim(),
      imageFile: imageFile ?? undefined,
      altText: data.altText?.trim() || undefined,
      caption: data.caption?.trim() || undefined,
      link: data.link?.trim() || undefined,
      source: data.source?.trim() || undefined,
      glossaryID: glossaryID?.trim() || undefined,
    });

    if (res.err) {
      setContextError(res.errMsg ?? "Failed to save glossary term.");
      return;
    }


    reset(DEFAULT_VALUES);
    handleRemoveImage();
    addNotification({
      message: "Glossary term created successfully",
      type: "success",
    });
    onTermCreated?.();
    // onClose();
  };

  return (
    <Modal open={open} onClose={(v) => !v && onClose()} size="lg">
      <Modal.Header>
        <Modal.Title>Add Glossary Term</Modal.Title>
        
        <Modal.Close aria-label="Close glossary form" />
      </Modal.Header>
      <Modal.Body>
      {!glossaryID && (
          <Alert message="Glossary page not found." variant="warning" />
           
        )}
        <form id="glossary-form" onSubmit={handleSubmit(onSubmitHandler)}>
          <GlossaryTermAutocomplete
            control={control}
            name="term"
            label="Term"
            placeholder="Search glossary terms..."
            rules={{
              required: "This field is required",
              validate: (value) =>
                value.trim().length > 0 || "This field is required",
            }}
          />
          <Textarea
            label="Definition"
            error={!!errors.definition}
            errorMessage={errors.definition?.message}
            className="mt-4"
            {...register("definition", {
              required: "This field is required",
              validate: (value) =>
                value.trim().length > 0 || "This field is required",
            })}
          />
          <div className="mt-4">
            <p className="mb-1 text-sm font-medium text-neutral-700">Image</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              id="glossary-image-upload"
              onChange={handleFileChange}
            />
            {imagePreview ? (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-32 w-auto rounded border border-neutral-200 object-contain"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  aria-label="Remove image"
                  className="absolute -right-2 -top-2 rounded-full bg-white p-0.5 shadow hover:bg-neutral-100"
                >
                  <IconX size={14} />
                </button>
                <p className="mt-1 truncate text-xs text-neutral-500 max-w-[12rem]">
                  {imageFile?.name}
                </p>
              </div>
            ) : (
              <label
                htmlFor="glossary-image-upload"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded border border-dashed border-neutral-300 px-6 py-5 text-sm text-neutral-500 hover:border-neutral-400 hover:bg-neutral-50"
              >
                <IconPhoto size={24} className="text-neutral-400" />
                <span>Click to upload an image</span>
                <span className="text-xs text-neutral-400">
                  PNG, JPG, GIF, WebP…
                </span>
              </label>
            )}
          </div>
          <Input
            label="Image Alt Text"
            placeholder="Describe the image…"
            error={!!errors.altText}
            errorMessage={errors.altText?.message}
            className="mt-4"
            required={hasImage}
            {...register("altText", {
              validate: (value) =>
                !hasImage ||
                !!value?.trim() ||
                "Alt text is required when an image is provided",
            })}
          />
          <Input
            label="Caption"
            placeholder="Image caption…"
            error={!!errors.caption}
            errorMessage={errors.caption?.message}
            className="mt-4"
            disabled={!hasImage}
            {...register("caption")}
          />
          <Input
            label="Link"
            placeholder="https://..."
            error={!!errors.link}
            errorMessage={errors.link?.message}
            className="mt-4"
            {...register("link")}
          />
          <Input
            label="Source"
            placeholder="Source of the term…"
            error={!!errors.source}
            errorMessage={errors.source?.message}
            className="mt-4"
            {...register("source")}
          />
          {contextError && (
            <p className="mt-2 text-sm text-red-700" role="alert">
              {contextError}
            </p>
          )}
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="glossary-form"
          disabled={control._formState.isSubmitting}
        >
          Submit
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default GlossaryForm;
