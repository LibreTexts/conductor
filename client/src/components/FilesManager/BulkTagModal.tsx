import { Button, Dropdown, Icon, Modal, ModalProps } from "semantic-ui-react";
import { useForm } from "react-hook-form";
import { ProjectFile } from "../../types";
import RenderTagFields from "./RenderTagFields";
import { useRef, useState } from "react";
import useGlobalError from "../error/ErrorHooks";
import api from "../../api";
import { cleanTagsForRequest } from "../../utils/assetHelpers";

interface BulkTagModalProps extends ModalProps {
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
  ...props
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
    <Modal {...props} open={true} onClose={onCancel}>
      <Modal.Header>Bulk Tag Files</Modal.Header>
      <Modal.Content>
        <p>These tags will be applied to {fileIds.length} files:</p>
        <RenderTagFields
          ref={tagFieldsRef}
          control={control}
          formState={formState}
        />

        <p className="mt-8 mb-1 font-semibold">Choose how to apply the tags:</p>
        <Dropdown
          placeholder="Select mode"
          options={[
            { key: "append", text: "Merge with existing tags", value: "append" },
            { key: "replace", text: "Replace existing tags", value: "replace" },
          ]}
          value={mode}
          onChange={(e, { value }) => setMode(value as "replace" | "append")}
          fluid
          selection
          className="mt-1 mb-4"
        />
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          color="green"
          onClick={saveTags}
          disabled={watch("tags")?.length === 0}
          loading={loading}
        >
          <Icon name="save" />
          Save
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default BulkTagModal;
