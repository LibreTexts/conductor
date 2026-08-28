import { useState, useEffect } from "react";
import { Button, Modal, Textarea } from "@libretexts/davis-react";
import { IconDeviceFloppy, IconTrash, IconX } from "@tabler/icons-react";
import { useForm } from "react-hook-form";
import api from "../../api";
import useGlobalError from "../error/ErrorHooks";
import { EditNoteModalProps, NoteFormData } from "../../types/Note";

const MAX_NOTE_LENGTH = 3000;

export default function EditNoteModal({
  open,
  onClose,
  note,
  userId,
}: EditNoteModalProps) {
  const [loading, setLoading] = useState(false);
  const { handleGlobalError } = useGlobalError();
  const {
    register,
    reset,
    watch,
    formState: { isDirty, errors },
  } = useForm<NoteFormData>({
    defaultValues: {
      content: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({ content: note?.content || "" });
    }
  }, [note, open, reset]);

  const content = watch("content") ?? "";
  const isOverLimit = content.length > MAX_NOTE_LENGTH;
  const canSave = note
    ? isDirty && !isOverLimit
    : content.trim().length > 0 && !isOverLimit;

  const handleSave = async () => {
    setLoading(true);
    try {
      if (note) {
        await api.updateUserNote(userId, note.uuid, content);
      } else {
        await api.createUserNote(userId, content);
      }
      onClose(true);
    } catch (error) {
      handleGlobalError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!note) return;

    setLoading(true);
    try {
      await api.deleteUserNote(userId, note.uuid);
      onClose(true);
    } catch (error) {
      handleGlobalError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={() => onClose(false)} size="md">
      <Modal.Header>
        <Modal.Title>{note ? "Edit Note" : "Add Note"}</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        <Textarea
          label="Note"
          placeholder="Enter note content..."
          required
          autoFocus
          rows={6}
          maxLength={MAX_NOTE_LENGTH}
          showCharacterCount
          error={!!errors.content}
          errorMessage={errors.content?.message}
          {...register("content", { required: "Note content is required." })}
        />
      </Modal.Body>
      <Modal.Footer className="!justify-between">
        <div>
          {note && (
            <Button
              variant="destructive"
              icon={<IconTrash />}
              onClick={handleDelete}
              loading={loading}
            >
              Delete
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<IconX />}
            onClick={() => onClose(false)}
            disabled={loading}
          >
            {note && !isDirty ? "Close" : "Cancel"}
          </Button>
          <Button
            icon={<IconDeviceFloppy />}
            onClick={handleSave}
            loading={loading}
            disabled={!canSave}
          >
            {note ? "Save" : "Create"}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
