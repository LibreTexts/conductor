import React, { useState, useEffect } from "react";
import { Modal, Button } from "semantic-ui-react";
import { useForm } from "react-hook-form";
import api from "../../api";
import CtlTextArea from "../ControlledInputs/CtlTextArea";
import { EditNoteModalProps, NoteFormData } from "../../types/Note";

export default function EditNoteModal({ open, onClose, note, userId }: EditNoteModalProps) {
  const [loading, setLoading] = useState(false);
  const { control, reset, watch, formState: { isDirty } } = useForm<NoteFormData>({
    defaultValues: {
      content: ""
    }
  });

  useEffect(() => {
    if (open) {
      reset({ content: note?.content || "" });
    }
  }, [note, open, reset]);

  const content = watch("content");
  const isOverLimit = content.length > 3000;

  const handleSave = async () => {
    setLoading(true);
    try {
      if (note) {
        await api.updateUserNote(userId, note.uuid, content);
      } else {
        await api.createUserNote(userId, content);
      }
      setLoading(false);
      onClose(true);
    } catch (error) {
      setLoading(false);
      console.error("Error saving note:", error);
    }
  };

  const handleDelete = async () => {
    if (!note) return; 
    
    setLoading(true);
    try {
      await api.deleteUserNote(userId, note.uuid);
      setLoading(false);
      onClose(true);
    } catch (error) {
      setLoading(false);
      console.error("Error deleting note:", error);
    }
  };

  return (
    <Modal open={open} onClose={() => onClose(false)} size="small">
      <Modal.Header>{note ? "Edit Note" : "Add Note"}</Modal.Header>
      <Modal.Content>
        <CtlTextArea
          name="content"
          control={control}
          rules={{ required: "Note content is required" }}
          maxLength={3000}
          showRemaining
          fluid
          bordered
          placeholder="Enter note content..."
          autoFocus
        />
      </Modal.Content>
      <Modal.Actions>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          width: "100%",
          marginBottom: "1rem"
        }}>
          <div>
            {note && (
              <Button color="red" onClick={handleDelete} loading={loading}>
                Delete
              </Button>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button color="grey" onClick={() => onClose(false)} disabled={loading}>
              {note && !isDirty ? "Close" : "Cancel"}
            </Button>
            {note ? (
              isDirty && !isOverLimit && (
                <Button color="green" onClick={handleSave} loading={loading}>
                  Save
                </Button>
              )
            ) : (
              content.trim().length > 0 && !isOverLimit && (
                <Button color="green" onClick={handleSave} loading={loading}>
                  Create
                </Button>
              )
            )}
          </div>
        </div>
      </Modal.Actions>
    </Modal>
  );
}