import { useRef, useState } from "react";
import { Control } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Text } from "@libretexts/davis-react";
import { IconExternalLink, IconInfoCircle, IconUpload } from "@tabler/icons-react";
import api from "../../../api";
import { Project } from "../../../types";
import { required } from "../../../utils/formRules";
import { useModals } from "../../../context/ModalContext";
import { useNotifications } from "../../../context/NotificationContext";
import useGlobalError from "../../error/ErrorHooks";
import { classificationOptions, statusOptions, visibilityOptions } from "../../util/ProjectHelpers";
import AboutProjectClassificationsModal from "../AboutProjectClassificationsModal";
import SectionCard from "../ProjectView/SectionCard";
import { DESCRIP_MAX_CHARS } from "./constants";
import { SelectField, TextAreaField, TextField } from "./fields";

const toSelectOptions = (opts: { value: string; text: string }[]) =>
  opts.map((o) => ({ value: o.value, label: o.text }));

interface GeneralSectionProps {
  control: Control<Project>;
  projectID: string;
  /** From the project query, so a new upload shows without touching unsaved edits. */
  thumbnail?: string;
}

const GeneralSection = ({ control, projectID, thumbnail }: GeneralSectionProps) => {
  const queryClient = useQueryClient();
  const { openModal, closeAllModals } = useModals();
  const { addNotification } = useNotifications();
  const { handleGlobalError } = useGlobalError();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleThumbnailUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("thumbnail", file);
      const res = await api.uploadProjectThumbnail(projectID, formData);
      if (res.data.err) throw new Error(res.data.errMsg);
      await queryClient.invalidateQueries(["project", projectID]);
      addNotification({ type: "success", message: "Thumbnail uploaded. It can take a few minutes to appear everywhere." });
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <SectionCard
      id="general"
      title="General"
      description="The basics that appear across Conductor and Commons."
      bodyClassName="flex flex-col gap-4 p-5"
    >
      <TextField
        control={control}
        name="title"
        label="Project Title"
        placeholder="Enter the project title…"
        rules={required}
        required
      />
      <TextAreaField
        control={control}
        name="description"
        label="Project Description"
        placeholder="Enter project description…"
        maxLength={DESCRIP_MAX_CHARS}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <SelectField
          control={control}
          name="status"
          label="Status"
          placeholder="Choose a status…"
          options={toSelectOptions(statusOptions)}
        />
        <div className="flex flex-col gap-1">
          <SelectField
            control={control}
            name="classification"
            label="Classification"
            placeholder="Choose a classification…"
            options={toSelectOptions(classificationOptions)}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={<IconInfoCircle size={15} />}
            className="self-start"
            onClick={() =>
              openModal(<AboutProjectClassificationsModal show onClose={() => closeAllModals()} />)
            }
          >
            About Classifications
          </Button>
        </div>
        <SelectField
          control={control}
          name="visibility"
          label="Visibility"
          placeholder="Choose a visibility…"
          options={toSelectOptions(visibilityOptions)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Text weight="medium" size="sm" as="span" id="thumbnail-label">
          Thumbnail
        </Text>
        <div className="flex flex-wrap items-center gap-4">
          {thumbnail && (
            <img
              src={thumbnail}
              alt="Current project thumbnail"
              className="aspect-video w-40 rounded-md border border-neutral-200 object-cover"
            />
          )}
          <div className="flex flex-wrap gap-2">
            {thumbnail && (
              <Button
                as="a"
                href={thumbnail}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                icon={<IconExternalLink size={14} />}
              >
                View Current
                <span className="sr-only"> (opens in new tab)</span>
              </Button>
            )}
            <Button
              variant="outline"
              icon={<IconUpload size={14} />}
              loading={uploading}
              aria-describedby="thumbnail-help"
              onClick={() => fileInputRef.current?.click()}
            >
              {thumbnail ? "Replace Thumbnail" : "Upload Thumbnail"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept="image/*"
              aria-labelledby="thumbnail-label"
              onChange={handleThumbnailUpload}
            />
          </div>
        </div>
        <Text as="p" id="thumbnail-help" size="sm" color="muted" className="m-0">
          Uploads right away, separate from Save Changes. A 16:9 image looks best.
        </Text>
      </div>
    </SectionCard>
  );
};

export default GeneralSection;
