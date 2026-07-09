import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  Modal,
  Button,
  Checkbox,
  Input,
  FormSection,
  Stack,
  Alert,
} from "@libretexts/davis-react";
import { IconDeviceFloppy, IconTrash } from "@tabler/icons-react";
import { Author } from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";
import { useQueryClient } from "@tanstack/react-query";
import FileUploader from "../../FileUploader";
import { useNotifications } from "../../../context/NotificationContext";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

// Work with the pictureCircle field as a boolean in the form, but convert to "yes"/"no" when sending to the API.
type ManageAuthorFormValues = Omit<Author, 'pictureCircle'> & { pictureCircle: boolean };

interface ManageAuthorModalProps {
  show: boolean;
  onClose: () => void;
  authorID?: string;
}

const ManageAuthorModal = ({ show, onClose, authorID }: ManageAuthorModalProps) => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const { handleGlobalError } = useGlobalError();
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ManageAuthorFormValues>({
    defaultValues: {
      nameKey: "",
      name: "",
      nameURL: "",
      note: "",
      noteURL: "",
      campusName: "",
      campusURL: "",
      pictureCircle: false,
      pictureURL: "",
      programName: "",
      programURL: "",
      attributionPrefix: "",
    },
  });

  const mode = authorID ? "edit" : "create";
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const pictureURL = watch("pictureURL");
  const pictureCircle = watch("pictureCircle");

  useEffect(() => {
    if (show) {
      setShowConfirmDelete(false);
      if (authorID) {
        loadAuthor();
      } else {
        reset();
      }
    }
  }, [show, authorID]);

  async function loadAuthor() {
    try {
      if (!authorID) return;
      setLoading(true);
      const res = await api.getAuthor(authorID);
      if (res.data.err) throw new Error(res.data.errMsg);
      if (!res.data.author) throw new Error("Invalid response from server.");
      reset({
        ...res.data.author,
        pictureCircle: res.data.author.pictureCircle === "yes",
      });
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(values: ManageAuthorFormValues) {
    try {
      setLoading(true);

      const payload = {
        ...values,
        pictureCircle: values.pictureCircle ? "yes" : "no",
      };

      if (mode === "edit" && authorID) {
        const res = await api.updateAuthor(authorID, payload);
        if (res.data.err) throw new Error(res.data.errMsg);
      } else {
        const res = await api.createAuthor(payload);
        if (res.data.err) throw new Error(res.data.errMsg);
      }
      
      queryClient.invalidateQueries({ queryKey: ["authors"] });
      
      addNotification({
        message:
          mode === "create"
            ? "The author has been successfully added."
            : "The author's information has been successfully updated.",
        type: "success",
      });

      onClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleImageUpload(files: FileList) {
    try {
      // FileUploader fires on every state change, including when files are cleared.
      if (uploadingImage || !authorID || !files || files.length === 0) return;

      setUploadingImage(true);
      const formData = new FormData();
      formData.append("file", files[0]);

      const res = await api.uploadAuthorImage(authorID, formData);
      if (res.data.err) throw new Error(res.data.errMsg);
      if (!res.data.url) throw new Error("Invalid response from server.");

      // Sync the form field so a subsequent save keeps the new URL and doesn't clobber other edits.
      setValue("pictureURL", res.data.url, { shouldDirty: false });
      addNotification({
        message: "The author's image has been successfully uploaded.",
        type: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["authors"] });
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleDelete() {
    try {
      if (!authorID) return;
      setLoading(true);
      const res = await api.deleteAuthor(authorID);
      if (res.data.err) throw new Error(res.data.errMsg);
      queryClient.invalidateQueries({ queryKey: ["authors"] });
      onClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
      setShowConfirmDelete(false);
    }
  }

  return (
    <Modal open={show} onClose={onClose} size="xl">
      <Modal.Header>
        <Modal.Title>{mode === "create" ? "Add" : "Edit"} Author</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body className="overflow-y-auto max-h-[70vh]">
        <Stack gap="xl">
          <FormSection
            title="Identity"
            description="Core information used to attribute this author across libraries."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Name Key"
                placeholder="e.g. johndoe"
                required
                className="sm:col-span-2"
                helperText="Unique identifier for this author. All lowercase letters and numbers only, hyphenated. This key must be added to the 'authorname' classification on the appropriate libraries for the author to be associated with pages."
                error={!!errors.nameKey}
                errorMessage={errors.nameKey?.message}
                {...register("nameKey", { required: "Name Key is required." })}
              />
              <Input
                label="Name"
                placeholder="John Doe"
                required
                className="sm:col-span-2"
                error={!!errors.name}
                errorMessage={errors.name?.message}
                {...register("name", { required: "Name is required." })}
              />
              <Input
                label="Name URL"
                type="url"
                className="sm:col-span-2"
                placeholder="https://example.com/johndoe"
                {...register("nameURL")}
              />
            </div>
          </FormSection>

          <FormSection
            title="Affiliation"
            description="Optional institution and program credited alongside the author."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Campus Name"
                placeholder="Biola University"
                {...register("campusName")}
              />
              <Input
                label="Campus URL"
                type="url"
                placeholder="https://www.biola.edu"
                {...register("campusURL")}
              />
              <Input
                label="Program Name"
                placeholder="OER for Good"
                {...register("programName")}
              />
              <Input
                label="Program URL"
                type="url"
                placeholder="https://oerforgood.example.com"
                {...register("programURL")}
              />
            </div>
          </FormSection>

          <FormSection
            title="Display & Attribution"
            description="Control how the author's picture and attribution text appear."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="flex flex-col items-center gap-1 shrink-0">
                  {pictureURL ? (
                    <img
                      src={pictureURL}
                      alt="Author picture preview"
                      className={`h-24 w-24 object-cover border border-gray-200 ${
                        pictureCircle ? "rounded-full" : "rounded-md"
                      }`}
                    />
                  ) : (
                    <div
                      className={`h-24 w-24 flex items-center justify-center bg-gray-50 border border-dashed border-gray-300 text-xs text-gray-400 text-center px-2 ${
                        pictureCircle ? "rounded-full" : "rounded-md"
                      }`}
                    >
                      No picture
                    </div>
                  )}
                </div>
                <div className="grow w-full">
                  {mode === "edit" ? (
                    <>
                      <FileUploader
                        fileTypes={ALLOWED_IMAGE_TYPES}
                        maxFiles={1}
                        maxFileSize={MAX_IMAGE_SIZE}
                        disabled={uploadingImage}
                        onUpload={handleImageUpload}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {uploadingImage
                          ? "Uploading picture…"
                          : "Upload a JPEG, PNG, or WebP image (max 5 MB). The picture is saved immediately."}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Save the author first to upload a picture.
                    </p>
                  )}
                </div>
              </div>
              <Input
                label="Picture URL"
                type="url"
                placeholder="https://example.com/photo.jpg"
                className="sm:col-span-2"
                helperText="Automatically set when you upload a picture. You can also paste an external URL."
                {...register("pictureURL")}
              />
              <Input
                label="Attribution Prefix"
                placeholder="e.g. Access for free at"
                className="sm:col-span-2"
                {...register("attributionPrefix")}
              />
              <div className="sm:col-span-2">
                <Controller
                  control={control}
                  name="pictureCircle"
                  render={({ field }) => (
                    <Checkbox
                      name="pictureCircle"
                      label="Display picture as circle"
                      description="When enabled, the author's picture is cropped to a circular frame."
                      checked={field.value}
                      onChange={(checked) => field.onChange(checked)}
                    />
                  )}
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Note"
            description="Optional call-to-action shown with the author's attribution."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Note"
                placeholder="e.g. Donate to the author's research program."
                className="sm:col-span-2"
                {...register("note")}
              />
              <Input
                label="Note URL"
                type="url"
                placeholder="https://example.com/note"
                className="sm:col-span-2"
                {...register("noteURL")}
              />
            </div>
          </FormSection>

          {showConfirmDelete && (
            <Stack gap="sm">
              <Alert
                variant="error"
                title="Delete this author?"
                message="This action cannot be undone."
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  icon={<IconTrash size={16} />}
                  loading={loading}
                  onClick={handleDelete}
                >
                  Confirm Delete
                </Button>
                <Button variant="secondary" onClick={() => setShowConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            </Stack>
          )}
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-between items-center w-full">
          <div>
            {mode === "edit" && authorID && !showConfirmDelete && (
              <Button
                variant="destructive"
                icon={<IconTrash size={16} />}
                onClick={() => setShowConfirmDelete(true)}
              >
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={<IconDeviceFloppy size={16} />}
              onClick={handleSubmit(onSubmit)}
              loading={loading}
            >
              {mode === "create" ? "Add Author" : "Save Changes"}
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default ManageAuthorModal;
