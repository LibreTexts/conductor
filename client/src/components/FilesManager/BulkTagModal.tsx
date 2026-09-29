import { Button, Modal, Select } from "@libretexts/davis-react";
import { IconDeviceFloppy } from "@tabler/icons-react";
import { useForm } from "react-hook-form";
import { ProjectFile } from "../../types";
import RenderTagFields from "./RenderTagFields";
import { useRef, useState } from "react";
import useGlobalError from "../error/ErrorHooks";
import api from "../../api";
import { cleanTagsForRequest } from "../../utils/assetHelpers";

interface BulkTagModalProps {
  projectID: string;
  fileIds: string[];
  onCancel: () => void;
  onSave: () => void;
}

const BulkTagModal: React.FC<BulkTagModalProps> = ({
  projectID,
  fileIds,
  onCancel,
  onSave,
}) => {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"replace" | "append">("append");
  const tagFieldsRef = useRef<React.ElementRef<typeof RenderTagFields>>(null);
  const { handleGlobalError } = useGlobalError();
  const { control, formState, watch, getValues } = useForm<ProjectFile>({
    defaultValues: { tags: [] },
  });

  async function saveTags() {
    try {
      const vals = getValues("tags");
      if (!vals || vals.length === 0) return;
      setLoading(true);

      const cleaned = cleanTagsForRequest(vals);

      await api.bulkUpdateProjectFiles(projectID, fileIds, {
        tags: cleaned,
        tagMode: mode,
      });
      onSave();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={true} onClose={() => onCancel()} size="xl">
      <Modal.Header>
        <Modal.Title>Bulk Tag Files</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>These tags will be applied to {fileIds.length} files:</p>
        <RenderTagFields
          ref={tagFieldsRef}
          control={control}
          formState={formState}
        />

        <p className="mt-10 mb-3 font-semibold">Choose how to apply the tags:</p>
        <Select
          name="bulk-tag-mode"
          label="Tag apply mode"
          labelClassName="sr-only"
          placeholder="Select mode"
          options={[
            { label: "Merge with existing tags", value: "append" },
            { label: "Replace existing tags", value: "replace" },
          ]}
          value={mode}
          onChange={(e) => setMode(e.target.value as "replace" | "append")}
          className="mt-1 mb-4"
        />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={saveTags}
          disabled={watch("tags")?.length === 0}
          loading={loading}
          icon={<IconDeviceFloppy size={16} />}
        >
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default BulkTagModal;
