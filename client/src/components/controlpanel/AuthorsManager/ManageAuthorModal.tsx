import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Form, Modal } from "semantic-ui-react";
import { Author } from "../../../types";
import useGlobalError from "../../error/ErrorHooks";
import CtlTextInput from "../../ControlledInputs/CtlTextInput";
import { required } from "../../../utils/formRules";
import api from "../../../api";
import Button from "../../NextGenComponents/Button";
import { useQueryClient } from "@tanstack/react-query";

interface ManageAuthorModalProps {
  show: boolean;
  onClose: () => void;
  authorID?: string;
}

const ManageAuthorModal = ({ show, onClose, authorID }: ManageAuthorModalProps) => {
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();
  const { control, getValues, trigger, reset } = useForm<Author>({
    defaultValues: {
      nameKey: "",
      name: "",
      nameTitle: "",
      nameURL: "",
      note: "",
      noteURL: "",
      companyName: "",
      companyURL: "",
      pictureCircle: "yes",
      pictureURL: "",
      programName: "",
      programURL: "",
      attributionPrefix: "",
    },
  });

  const mode = authorID ? "edit" : "create";
  const [loading, setLoading] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

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
      reset(res.data.author);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    const valid = await trigger();
    if (!valid) return;

    try {
      setLoading(true);
      const values = getValues();

      if (mode === "edit" && authorID) {
        const res = await api.updateAuthor(authorID, values);
        if (res.data.err) throw new Error(res.data.errMsg);
      } else {
        const res = await api.createAuthor(values);
        if (res.data.err) throw new Error(res.data.errMsg);
      }

      queryClient.invalidateQueries({ queryKey: ["authors"] });

      onClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
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
    <Modal open={show} onClose={onClose} size="large">
      <Modal.Header>{mode === "create" ? "Add" : "Edit"} Author</Modal.Header>
      <Modal.Content>
        <Form onSubmit={(e) => e.preventDefault()} loading={loading}>
          <div className="grid grid-cols-2 gap-x-4">
            <CtlTextInput
              control={control}
              name="nameKey"
              label="Name Key"
              placeholder="e.g. johndoe"
              rules={required}
              required
              helpText="Unique identifier for this author. This key will need to be added to the 'authorname' classification on the appropriate libraries for the author to be associated with pages."
            />
            <CtlTextInput
              control={control}
              name="name"
              label="Name"
              placeholder="John Doe"
              rules={required}
              required
            />
            <CtlTextInput
              control={control}
              name="nameTitle"
              label="Name Title"
              placeholder="e.g. Chemistry Professor"
              className="mt-4"
            />
            <CtlTextInput
              control={control}
              name="nameURL"
              label="Name URL"
              placeholder="https://example.com/johndoe"
              className="mt-4"
            />
            <CtlTextInput
              control={control}
              name="companyName"
              label="Company Name"
              placeholder="Biola University"
              className="mt-4"
            />
            <CtlTextInput
              control={control}
              name="companyURL"
              label="Company URL"
              placeholder="https://www.biola.edu"
              className="mt-4"
            />
            <CtlTextInput
              control={control}
              name="programName"
              label="Program Name"
              placeholder="OER for Good"
              className="mt-4"
            />
            <CtlTextInput
              control={control}
              name="programURL"
              label="Program URL"
              placeholder="https://oerforgood.example.com"
              className="mt-4"
            />
            <CtlTextInput
              control={control}
              name="pictureURL"
              label="Picture URL"
              placeholder="https://example.com/photo.jpg"
              className="mt-4"
            />
            <CtlTextInput
              control={control}
              name="attributionPrefix"
              label="Attribution Prefix"
              placeholder="e.g. Access for free at"
              className="mt-4"
            />
            <CtlTextInput
              control={control}
              name="note"
              label="Note"
              placeholder="e.g. Donate to the author's research program."
              className="mt-4 col-span-2"
            />
            <CtlTextInput
              control={control}
              name="noteURL"
              label="Note URL"
              placeholder="https://example.com/note"
              className="mt-4"
            />
            <Form.Field className="flex items-center gap-x-2 mt-8">
              <Controller
                control={control}
                name="pictureCircle"
                render={({ field }) => (
                  <Form.Checkbox
                    label="Display picture as circle"
                    checked={field.value === "yes"}
                    onChange={(_, { checked }) => field.onChange(checked ? "yes" : "no")}
                  />
                )}
              />
            </Form.Field>
          </div>
        </Form>
        {showConfirmDelete && (
          <div className="mt-4 p-4 bg-red-50 border border-red-300 rounded-md">
            <p className="text-red-700 font-semibold mb-3">
              Are you sure you want to delete this author? This action cannot be undone.
            </p>
            <div className="flex gap-x-2">
              <Button
                onClick={handleDelete}
                loading={loading}
                className="!bg-red-600 hover:!bg-red-700"
                icon="IconTrash"
              >
                Confirm Delete
              </Button>
              <Button variant="secondary" onClick={() => setShowConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal.Content>
      <Modal.Actions>
        <div className="flex justify-between items-center w-full">
          <div>
            {mode === "edit" && authorID && !showConfirmDelete && (
              <Button
                onClick={() => setShowConfirmDelete(true)}
                className="!bg-red-600 hover:!bg-red-700"
                icon="IconTrash"
              >
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-x-2">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={loading} icon="IconDeviceFloppy">
              {mode === "create" ? "Add Author" : "Save Changes"}
            </Button>
          </div>
        </div>
      </Modal.Actions>
    </Modal>
  );
};

export default ManageAuthorModal;
