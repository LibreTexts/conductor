import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Modal,
  Form,
  Button,
  Icon,
  ModalProps,
  Table,
  Dropdown,
  Input,
} from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { AssetTagValueTypeOptions, ProjectFile } from "../../types";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { required } from "../../utils/formRules";
import CtlTextArea from "../ControlledInputs/CtlTextArea";
import { isAssetTag } from "../../utils/typeHelpers";

interface EditFileModalProps extends ModalProps {
  show: boolean;
  onClose: () => void;
  projectID: string;
  file: ProjectFile;
  onFinishedEdit: () => void;
}

/**
 * Modal tool to rename an Project file entry.
 */
const EditFile: React.FC<EditFileModalProps> = ({
  show,
  onClose,
  projectID,
  file,
  onFinishedEdit,
  rest,
}) => {
  const DESCRIP_MAX_CHARS = 500;

  // Global State & Hooks
  const { handleGlobalError } = useGlobalError();
  const { control, getValues, setValue, watch, reset, formState } =
    useForm<ProjectFile>({
      defaultValues: {
        name: "",
        description: "",
      },
    });
  const { fields, append, prepend, remove, swap, move, insert } = useFieldArray(
    {
      control,
      name: "tags",
    }
  );

  // Data & UI
  const [loading, setLoading] = useState(false);

  // Effects
  useEffect(() => {
    if (show) {
      reset(file);
    }
  }, [show]);

  // Handlers & Methods
  /**
   * Submits the file edit request to the server (if form is valid) and
   * closes the modal on completion.
   */
  async function handleEdit() {
    if (!formState.isValid) return;
    if (!formState.isDirty) {
      onFinishedEdit();
      return;
    }
    setLoading(true);
    try {
      const editRes = await axios.put(
        `/project/${projectID}/files/${getValues().fileID}`,
        getValues()
      );

      if (editRes.data.err) {
        throw new Error(editRes.data.errMsg);
      }

      setLoading(false);
      onFinishedEdit();
    } catch (e) {
      handleGlobalError(e);
    } finally {
      setLoading(false);
    }
  }

  function handleAddTag() {}

  return (
    <Modal open={show} onClose={onClose} {...rest}>
      <Modal.Header>Edit File</Modal.Header>
      <Modal.Content>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            handleEdit();
          }}
        >
          <CtlTextInput
            name="name"
            label="Name"
            required
            control={control}
            rules={required}
            maxLength={100}
          />
          <CtlTextArea
            name="description"
            label="Description"
            control={control}
            placeholder="Describe this file or folder..."
            maxLength={DESCRIP_MAX_CHARS}
            className="mt-4"
          />
          <span className="muted-text small-text">
            Characters remaining:{" "}
            {watch("description") &&
            DESCRIP_MAX_CHARS - watch("description").length < 0
              ? 0
              : watch("description") &&
                DESCRIP_MAX_CHARS - watch("description").length}
          </span>

          <p className="!mt-6 form-field-label">Tags</p>
          <Table celled className="!mt-1">
            <Table.Header fullWidth>
              <Table.Row key="header">
                <Table.HeaderCell>Tag Title</Table.HeaderCell>
                <Table.HeaderCell>Value</Table.HeaderCell>{" "}
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {(!fields || fields.length === 0) && (
                <Table.Row>
                  <Table.Cell colSpan={3} className="text-center">
                    No tags have been added to this file.
                  </Table.Cell>
                </Table.Row>
              )}
              {fields &&
                fields.length > 0 &&
                fields.map((tag, index) => (
                  <Table.Row key={tag.id}>
                    <Table.Cell>
                      <CtlTextInput
                        name={`tags.${index}.title`}
                        control={control}
                        fluid
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Controller
                        render={({ field }) => (
                          <Dropdown
                            options={AssetTagValueTypeOptions}
                            {...field}
                            onChange={(e, data) => {
                              field.onChange(data.value?.toString() ?? "text");
                            }}
                            fluid
                          />
                        )}
                        name={`tags.${index}.value`}
                        control={control}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        color="red"
                        icon="trash"
                        onClick={() => remove(index)}
                      ></Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
            </Table.Body>
          </Table>
          <Button color="blue" onClick={() => append({ title: "", value: "" })}>
            <Icon name="plus" />
            Add Tag
          </Button>
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="blue" onClick={handleEdit} loading={loading}>
          <Icon name="edit" />
          Edit
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default EditFile;
