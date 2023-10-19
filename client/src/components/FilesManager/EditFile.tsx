import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Modal,
  Form,
  Button,
  Icon,
  ModalProps,
  Table,
  Label,
} from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import { useFieldArray, useForm } from "react-hook-form";
import { AssetTag, AssetTagFramework, ProjectFile } from "../../types";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { required } from "../../utils/formRules";
import CtlTextArea from "../ControlledInputs/CtlTextArea";
import SelectFramework from "./SelectFramework";
import api from "../../api";
import { getInitValueFromTemplate } from "../../utils/assetHelpers";
import { RenderTagInput } from "./RenderTagInput";
import { AssetTagTemplate, AssetTagValue } from "../../types/AssetTagging";
import { isAssetTagFramework, isAssetTagKeyObject } from "../../utils/typeHelpers";

interface EditFileModalProps extends ModalProps {
  show: boolean;
  onClose: () => void;
  projectID: string;
  fileID: string;
  onFinishedEdit: () => void;
}

/**
 * Modal tool to rename an Project file entry.
 */
const EditFile: React.FC<EditFileModalProps> = ({
  show,
  onClose,
  projectID,
  fileID,
  onFinishedEdit,
  rest,
}) => {
  const DESCRIP_MAX_CHARS = 500;

  // Global State & Hooks
  const { handleGlobalError } = useGlobalError();
  const { control, getValues, setValue, watch, reset, formState, trigger } =
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
  const [isFolder, setIsFolder] = useState(true); // No asset tags for folders
  const [showSelectFramework, setShowSelectFramework] = useState(false);
  const [selectedFramework, setSelectedFramework] =
    useState<AssetTagFramework | null>(null);

  // Effects
  useEffect(() => {
    if (show) {
      loadFile();
    }
  }, [show]);

  useEffect(() => {
    if (selectedFramework) {
      genTagsFromFramework();
    }
  }, [selectedFramework]);

  // Handlers & Methods
  async function loadFile() {
    try {
      if (!projectID || !fileID) return;
      setLoading(true);
      const res = await axios.get(`/project/${projectID}/files/${fileID}`);
      if (
        !res ||
        res.data.err ||
        !Array.isArray(res.data.files) ||
        res.data.files.length === 0
      ) {
        throw new Error("Failed to load file");
      }

      const fileData = res.data.files[res.data.files.length - 1]; // Target file should be last in array
      reset(fileData);
      setIsFolder(fileData.storageType !== "file");
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Submits the file edit request to the server (if form is valid) and
   * closes the modal on completion.
   */
  async function handleEdit() {
    if (Object.values(formState.errors).length > 0) return;
    /* Usually we would use formState.isValid, but seems to be a bug with react-hook-form
    not setting valid to true even when there are no errors. See:
    https://github.com/react-hook-form/react-hook-form/issues/2755
    */
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

  async function loadFramework(id: string) {
    try {
      if (!id) return;
      if (isFolder) return; // No asset tags for folders
      setLoading(true);

      const res = await api.getFramework(id);
      if (!res || res.data.err || !res.data.framework) {
        throw new Error(res.data.errMsg);
      }

      setSelectedFramework(res.data.framework);
      genTagsFromFramework();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  function genTagsFromFramework() {
    if (isFolder) return; // No asset tags for folders
    if (!selectedFramework || !selectedFramework.templates) return;

    // Don't duplicate tags when adding from framework
    const existingTags = getValues().tags;
    let filtered: AssetTagTemplate[] = [];

    if (existingTags && existingTags.length > 0) {
      filtered = selectedFramework.templates.filter(
        (t) => !existingTags.find((tag) => {
          if(isAssetTagKeyObject(tag.key)){
            return tag.key.title === t.title
          }
          return tag.key === t.title
        })
      );
    } else {
      filtered = selectedFramework.templates;
    }

    filtered.forEach((t) => {
      addTag({
        key: t.title,
        value: getInitValueFromTemplate(t),
        framework: selectedFramework,
      });
    });
  }

  function addTag({
    key,
    value,
    framework,
  }: {
    key?: string;
    value?: AssetTagValue;
    framework?: AssetTagFramework;
  }) {
    if (isFolder) return; // No asset tags for folders
    append(
      {
        uuid: crypto.randomUUID(), // Random UUID for new tags, will be replaced with real UUID server-side on save
        key: key ?? "",
        value: value ?? "",
        framework: framework ?? undefined,
        isDeleted: false,
      },
      { shouldFocus: false }
    );
  }

  return (
    <Modal open={show} onClose={onClose} {...rest}>
      <Modal.Header>Edit {isFolder ? "Folder" : "File"}</Modal.Header>
      <Modal.Content>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            //handleEdit();
          }}
          loading={loading}
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
          {!isFolder && (
            <>
              <p className="!mt-6 form-field-label">Tags</p>
              <Table celled>
                <Table.Header fullWidth>
                  <Table.Row key="header">
                    <Table.HeaderCell>Tag Title</Table.HeaderCell>
                    <Table.HeaderCell>Value</Table.HeaderCell>
                    <Table.HeaderCell width={1}>Actions</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {fields && fields.length > 0 ? (
                    fields.map((tag, index) => (
                      <Table.Row key={tag.id}>
                        <Table.Cell>
                          {tag.framework ? (
                            <div className="flex flex-col">
                              <p>{isAssetTagKeyObject(tag.key) ? tag.key.title : tag.key}</p>
                              {/* {isAssetTagFramework(tag.framework) && (
                                <div className="mt-1">
                                  <Label size="mini">
                                    {tag.framework.name}
                                  </Label>
                                </div>
                              )} */}
                            </div>
                          ) : (
                            <CtlTextInput
                              name={`tags.${index}.key`}
                              control={control}
                              fluid
                            />
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <RenderTagInput
                            tag={tag}
                            index={index}
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
                    ))
                  ) : (
                    <Table.Row>
                      <Table.Cell colSpan={3} className="text-center">
                        No tags have been added to this file.
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
              <Button color="blue" onClick={() => addTag({})}>
                <Icon name="plus" />
                Add Tag
              </Button>
              <Button color="blue" onClick={() => setShowSelectFramework(true)}>
                <Icon name="plus" />
                Add From Framework
              </Button>
            </>
          )}
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="green" onClick={() => handleEdit()} loading={loading}>
          <Icon name="save" />
          Save
        </Button>
      </Modal.Actions>
      <SelectFramework
        show={showSelectFramework}
        onClose={() => setShowSelectFramework(false)}
        onSelected={(id: string) => {
          loadFramework(id);
          setShowSelectFramework(false);
        }}
      />
    </Modal>
  );
};

export default EditFile;
