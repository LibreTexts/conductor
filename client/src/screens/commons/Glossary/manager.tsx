import {
  Alert,
  Badge,
  Button,
  Input,
  Modal,
  Select,
  Tabs,
  Textarea,
} from "@libretexts/davis-react";
import { IconPhoto, IconX } from "@tabler/icons-react";
import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import GlossaryTermAutocomplete from "./GlossaryTermAutocomplete";
import { licenseOptions } from "../../../components/util/LicenseOptions";
import api from "../../../api";
import { GlossaryEntry } from "./model";
import type { Notification } from "../../../context/NotificationContext";

interface GlossaryFormProps {
  open: boolean;
  onClose: () => void;
  coverID: string;
  bookID: string;
  library: string;
  glossaryID?: string;
  onTermCreated?: () => void;
  setGlossaryEntries?: (entries: GlossaryEntry[]) => void;
  addNotification: (notification: Notification) => void;
  editingTerm: GlossaryEntry | null;
  setEditingUsageID: (usageID: string | null) => void;
  existingTerms?: GlossaryEntry[];
}

type GlossaryFormFields = {
  usageID?: string;
  term: string;
  definition: string;
  aliasInput?: string;
  aliases?: string[];
  link?: string;
  source?: string;
  author?: string;
  imageSource?: string;
  caption?: string;
  altText?: string;
  imageAuthor?: string;
  imageLicense?: string;
};

const DEFAULT_VALUES: GlossaryFormFields = {
  term: "",
  definition: "",
  altText: "",
  caption: "",
  link: "",
  source: "",
  imageSource: "",
  aliasInput: "",
  aliases: [],
  author: "",
  imageAuthor: "",
  imageLicense: "",
  usageID: undefined,
};

const GlossaryForm: React.FC<GlossaryFormProps> = (props) => {
  const [contextError, setContextError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTab, setSelectedTab] = useState<number>(0);


  const {
    open,
    onClose,
    coverID,
    bookID,
    library,
    glossaryID,
    onTermCreated,
    addNotification,
    editingTerm,
    setEditingUsageID,
    existingTerms,
  } = props;

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
    trigger,
    getValues,
    setValue,
    watch,
  } = useForm<GlossaryFormFields>({
    mode: "onSubmit",
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (!open || !editingTerm) return;

    const baseUrl =
      import.meta.env.MODE === "development"
        ? import.meta.env.VITE_DEV_BASE_URL
        : "";
    setValue("term", editingTerm.term ?? "");
    setValue("definition", editingTerm.definition ?? "");
    setValue("aliases", editingTerm.aliases ?? []);
    setValue("link", editingTerm.link ?? "");
    setValue("source", editingTerm.source ?? "");
    setValue("author", editingTerm.author ?? "");
    setValue("imageSource", editingTerm.imageSource ?? "");
    setValue("imageAuthor", editingTerm.imageAuthor ?? "");
    setValue("imageLicense", editingTerm.imageLicense ?? "");
    setValue("altText", editingTerm.altText ?? "");
    setValue("caption", editingTerm.caption ?? "");
    setValue("usageID", editingTerm.usageID ?? undefined);

    setImageFile(null);
    setRemoveExistingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (editingTerm.imageUrl) {
      setImagePreview(`${baseUrl}${editingTerm.imageUrl}?t=${Date.now()}`);
    } else {
      setImagePreview(null);
    }
  }, [editingTerm, open, setValue]);

  const hasImage = !!imageFile || !!imagePreview;

  const handleExistingTermMatch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) {
      setEditingUsageID(null);
      setValue("usageID", undefined);
      return;
    }

    const existingTerm = existingTerms?.find((t) => t.term === trimmed);
    if (existingTerm) {
      setEditingUsageID(existingTerm.usageID);
    } else {
      setEditingUsageID(null);
      setValue("usageID", undefined);
    }
  };

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
    if (imagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    if (!imageFile && editingTerm?.imageUrl) {
      setRemoveExistingImage(true);
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

      const payload = {
        usageID: data.usageID?.trim() || undefined,
        term: data.term.trim(),
        definition: data.definition.trim(),
        coverID: coverID.trim(),
        bookId: bookID.trim() === "" ? undefined : bookID.trim(),
        library: library.trim(),
        imageFile: imageFile ?? undefined,
        removeImage: removeExistingImage || undefined,
        altText: data.altText?.trim() || undefined,
        caption: data.caption?.trim() || undefined,
        link: data.link?.trim() || undefined,
        source: data.source?.trim() || undefined,
        glossaryID: glossaryID?.trim() || undefined,
        author: data.author?.trim() || undefined,
        imageAuthor: data.imageAuthor?.trim() || undefined,
        imageLicense: data.imageLicense?.trim() || undefined,
        aliases: data?.aliases ? data.aliases : [],
        imageSource: data.imageSource?.trim() || undefined,
      }
    const res = await api.createGlossaryTerm(payload);

    if (res.err) {
      setContextError(res.errMsg ?? "Failed to save glossary term.");
      return;
    }

    handleClearAll();
    addNotification({
      message: "Glossary term created successfully",
      type: "success",
    });
    onTermCreated?.();
    // onClose();
  };

  const handleClearAll = () => {
    reset(DEFAULT_VALUES);
    handleRemoveImage();
    setSelectedTab(0);
    setContextError(null);
    setImageFile(null);
    setImagePreview(null);
    setRemoveExistingImage(false);

    setValue("aliases", []);
    setEditingUsageID(null);
  };
  const handleClose = (v: boolean) => {
    if (!v) {
      handleClearAll();
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={() => {}} size="lg">
      <Modal.Header>
        <Modal.Title>Add Glossary Term</Modal.Title>

        {/* <Modal.Close aria-label="Close glossary form" /> */}
      </Modal.Header>
      <Modal.Body>
        <form id="glossary-form" onSubmit={handleSubmit(onSubmitHandler)}>
          {!glossaryID && (
            <Alert message="Glossary page not found." variant="warning" />
          )}
          <Tabs selectedIndex={selectedTab} onChange={setSelectedTab}>
            <Tabs.List>
              <Tabs.Tab>Term</Tabs.Tab>
              <Tabs.Tab>Attribution</Tabs.Tab>
              <Tabs.Tab>Image</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel>
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
                
                disabled={!!editingTerm}
                onSelect={handleExistingTermMatch}
                onBlur={handleExistingTermMatch}
              />
              <div className="mt-4 flex items-end gap-2">
                <div className="flex-1">
                  <GlossaryTermAutocomplete
                    control={control}
                    name="aliasInput"
                    label="Aliases"
                    placeholder="Search aliases..."
                    onSelect={(term) => {
                      const current = getValues("aliases") ?? [];
                      if (!current.includes(term)) {
                        setValue("aliases", [...current, term]);
                      }
                      setValue("aliasInput", "");
                    }}
                    onBlur={(term) => {
                      const trimmed = term.trim();
                      if (!trimmed) {
                        setValue("aliasInput", "");
                        return;
                      }
                      const current = getValues("aliases") ?? [];
                      if (!current.includes(term)) {
                        setValue("aliases", [...current, term]);
                      }
                      setValue("aliasInput", "");
                    }}
                    
                  />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(watch("aliases") ?? []).map((alias) => (
                  <Badge
                    key={alias}
                    label={alias}
                    variant="primary"
                    onRemove={() =>
                      setValue(
                        "aliases",
                        (getValues("aliases") ?? []).filter((a) => a !== alias),
                      )
                    }
                    removeLabel={`Remove alias ${alias}`}
                  />
                ))}
              </div>
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
                rows={10}
              />
            </Tabs.Panel>
            <Tabs.Panel>
              <Input
                label="Link"
                placeholder="https://..."
                error={!!errors.link}
                errorMessage={errors.link?.message}
                className="mt-4"
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
                error={!!errors.source}
                errorMessage={errors.source?.message}
                className="mt-4"
                {...register("source")}
              />
              <Input
                label="Author"
                placeholder="Author of the term…"
                error={!!errors.author}
                errorMessage={errors.author?.message}
                className="mt-4"
                {...register("author")}
              />
            </Tabs.Panel>
            <Tabs.Panel>
              <div className="mt-4">
                <p className="mb-1 text-sm font-medium text-neutral-700">
                  Image
                </p>
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
                      {imageFile?.name ?? editingTerm?.imageUrl?.split("/").pop()}
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
                disabled={!hasImage}
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
                label="Image Source URL"
                placeholder="Image Source URL…"
                error={!!errors.imageSource}
                errorMessage={errors.imageSource?.message}
                className="mt-4"
                disabled={!hasImage}
                {...register("imageSource")}
              />
              <Input
                label="Image Author"
                placeholder="Image Author…"
                error={!!errors.imageAuthor}
                errorMessage={errors.imageAuthor?.message}
                className="mt-4"
                disabled={!hasImage}
                {...register("imageAuthor")}
              />

              <Select
                label="Image License"
                placeholder="Select a license…"
                options={licenseOptions.map((o) => ({
                  value: o.value,
                  label: o.text,
                }))}
                error={!!errors.imageLicense}
                errorMessage={errors.imageLicense?.message}
                className="mt-4"
                disabled={!hasImage}
                {...register("imageLicense")}
              />
            </Tabs.Panel>{" "}
          </Tabs>
          {contextError && (
            <p className="mt-2 text-sm text-red-700" role="alert">
              {contextError || "Failed to save glossary term."}
            </p>
          )}
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={() => handleClose(false)}>
          Cancel
        </Button>
        <Button variant="ghost" onClick={handleClearAll}>
          Clear All
        </Button>

        <Button
          type="submit"
          form="glossary-form"
          disabled={control._formState.isSubmitting}
        >
          Submit {control._formState.isSubmitting ? "..." : ""}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default GlossaryForm;
