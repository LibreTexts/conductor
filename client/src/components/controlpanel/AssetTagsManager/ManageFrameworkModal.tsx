import { Controller, useFieldArray, useForm } from "react-hook-form";
import {
  Button,
  Checkbox,
  Dropdown,
  Icon,
  Modal,
  ModalProps,
  Popup,
  Table,
} from "semantic-ui-react";
import {
  AssetTagFramework,
  AssetTagTemplate,
  AssetTagTemplateValueTypeOptions,
} from "../../../types";
import CtlCheckbox from "../../ControlledInputs/CtlCheckbox";
import CtlTextInput from "../../ControlledInputs/CtlTextInput";
import "../../../styles/global.css";
import {
  isAssetTagKeyObject,
  isAssetTagTemplate,
} from "../../../utils/typeHelpers";
import { useEffect, useState } from "react";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";
import LoadingSpinner from "../../LoadingSpinner";
import { truncateString } from "../../util/HelperFunctions";
import EditDropdownOptionsModal from "./EditDropdownOptionsModal";
import { cleanDropdownOptions } from "../../../utils/assetHelpers";

interface ManageFrameworkModalProps extends ModalProps {
  open: boolean;
  mode: "create" | "edit";
  id?: string;
  onClose: () => void;
}

const ManageFrameworkModal: React.FC<ManageFrameworkModalProps> = ({
  open,
  mode,
  id,
  onClose,
}) => {
  // Global State & Hooks
  const { handleGlobalError } = useGlobalError();
  const { control, formState, reset, watch, getValues, setValue, register } =
    useForm<AssetTagFramework>({
      defaultValues: {
        name: "",
        description: "",
        enabled: true,
        templates: [],
      },
    });
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "templates",
  });

  // Data & UI
  const [loading, setLoading] = useState<boolean>(false);
  const [showEditDropdownOptions, setShowEditDropdownOptions] =
    useState<boolean>(false);
  const [editDropdownOptionsIndex, setEditDropdownOptionsIndex] = useState<
    number | null
  >(null);

  // Effects
  useEffect(() => {
    if (open && mode === "edit" && id) loadFramework(id);
  }, [id, open]);

  // Handlers & Methods
  async function loadFramework(id: string) {
    try {
      setLoading(true);
      const res = await api.getFramework(id);
      if (!res.data.framework) throw new Error("No framework found");

      const parsed: AssetTagTemplate[] = res.data.framework.templates.map(
        (t) => {
          return {
            key: isAssetTagKeyObject(t.key) ? t.key.title : "",
            valueType: t.valueType,
            defaultValue: t.defaultValue,
            options: t.options,
            enabledAsFilter: t.enabledAsFilter,
            isDeleted: false,
          };
        }
      );

      reset({
        ...res.data.framework,
        templates: parsed,
      });
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    const cleaned = cleanDropdownOptions(getValues("templates"));
    setValue("templates", cleaned);
    if (mode === "create") {
      return createFramework(getValues());
    }
    return updateFramework(getValues());
  }

  async function createFramework(framework: AssetTagFramework) {
    try {
      setLoading(true);
      await api.createFramework(framework);

      handleClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function updateFramework(framework: AssetTagFramework) {
    try {
      if (!framework.uuid)
        throw new Error("No ID provided for updateFramework");
      setLoading(true);

      await api.updateFramework(framework);
      handleClose();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleEditDropdownOptions(index: number) {
    setEditDropdownOptionsIndex(index);
    setShowEditDropdownOptions(true);
  }

  function handleCloseEditDropdownOptionsModal() {
    setEditDropdownOptionsIndex(null);
    setShowEditDropdownOptions(false);
    // Sort dropdown/multiselect options (for all tags) alphabetically
    const values = getValues();
    values.templates.forEach((t: AssetTagTemplate) => {
      if (t.options) t.options.sort();
    });
  }

  function getOptionsString(index: number): string {
    if (!getValues(`templates.${index}.options`)) return "No options set";

    if (
      getValues(`templates.${index}.options`) &&
      (getValues(`templates.${index}.options`) as string[]).length > 0
    ) {
      return truncateString(
        watch(`templates.${index}.options`)?.join(", ") ?? "",
        50
      );
    }

    return "No options set";
  }

  function handleClose() {
    reset({
      name: "",
      description: "",
      enabled: true,
      templates: [],
    }); // Reset form state
    onClose();
  }

  function handleMoveUp(index: number) {
    if (index === 0) return; // Don't move if already at top
    // Check index - 1 exists
    if (!fields[index - 1]) return;
    move(index, index - 1);
  }

  function handleMoveDown(index: number) {
    if (index === fields.length - 1) return; // Don't move if already at bottom
    move(index, index + 1);
  }

  return (
    <Modal open={open} onClose={() => handleClose()} size="fullscreen">
      <Modal.Header>
        <div className="flex justify-between">
          <span>{mode === "create" ? "Create" : "Edit"} Framework</span>
          <div className="flex">
            <CtlCheckbox name="enabled" control={control} toggle />
            <p className="text-base ml-2">Enabled?</p>
          </div>
        </div>
      </Modal.Header>
      <Modal.Content scrolling>
        {loading && (
          <div className="my-4r">
            <LoadingSpinner />
          </div>
        )}
        {!loading && (
          <div className="mb-8">
            <CtlTextInput name="name" control={control} label="Name" fluid />
            <CtlTextInput
              name="description"
              control={control}
              label="Description"
              className="mt-6"
              fluid
            />
            <p className="!mt-6 form-field-label">Default Tags</p>
            <Table celled className="!mt-1">
              <Table.Header fullWidth>
                <Table.Row key="header">
                  <Table.HeaderCell>Tag Title</Table.HeaderCell>
                  <Table.HeaderCell>Value Type</Table.HeaderCell>
                  <Table.HeaderCell>
                    Options / Default Value (optional)
                  </Table.HeaderCell>
                  <Table.HeaderCell width={2}>
                    Enabled as Search Filter
                    <Popup
                      trigger={<Icon name="info circle" className="!ml-1" />}
                      content="If enabled, this tag will be available as a filter in Common's assets search."
                    />
                  </Table.HeaderCell>
                  <Table.HeaderCell width={2}>Actions</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {(!watch("templates") || watch("templates").length === 0) && (
                  <Table.Row>
                    <Table.Cell colSpan={3} className="text-center">
                      No tags have been added to this framework.
                    </Table.Cell>
                  </Table.Row>
                )}
                {fields.map(
                  (tag, index) =>
                    isAssetTagTemplate(tag) && (
                      <Table.Row key={tag.id}>
                        <Table.Cell>
                          <CtlTextInput
                            control={control}
                            name={`templates.${index}.key`}
                            fluid
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <Controller
                            render={({ field }) => (
                              <Dropdown
                                options={AssetTagTemplateValueTypeOptions}
                                {...field}
                                onChange={(e, data) => {
                                  field.onChange(
                                    data.value?.toString() ?? "text"
                                  );
                                }}
                                fluid
                                selection
                              />
                            )}
                            name={`templates.${index}.valueType`}
                            control={control}
                          />
                        </Table.Cell>
                        <Table.Cell>
                          {["dropdown", "multiselect"].includes(
                            watch(`templates.${index}.valueType`)
                          ) ? (
                            <div className="flex items-center">
                              <p className="mr-2">{getOptionsString(index)}</p>
                              <Button
                                icon="edit"
                                onClick={() => handleEditDropdownOptions(index)}
                              />
                            </div>
                          ) : (
                            <CtlTextInput
                              name={`templates.${index}.defaultValue`}
                              control={control}
                              fluid
                              placeholder="Enter default value (optional)..."
                            />
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <CtlCheckbox
                            name={`templates.${index}.enabledAsFilter`}
                            control={control}
                            toggle
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <Button
                            icon="arrow up"
                            onClick={() => handleMoveUp(index)}
                          />
                          <Button
                            icon="arrow down"
                            onClick={() => handleMoveDown(index)}
                            className="!ml-1"
                          />
                          <Button
                            color="red"
                            icon="trash"
                            onClick={() => remove(index)}
                            className="!ml-1"
                          />
                        </Table.Cell>
                      </Table.Row>
                    )
                )}
              </Table.Body>
            </Table>
            <Button
              color="blue"
              onClick={() =>
                append(
                  {
                    key: "",
                    valueType: "text",
                    defaultValue: "",
                    isDeleted: false,
                  },
                  { shouldFocus: false }
                )
              }
            >
              <Icon name="plus" />
              Add Tag
            </Button>
          </div>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => handleClose()}>Cancel</Button>
        <Button color="green" onClick={() => handleSave()}>
          Save
        </Button>
      </Modal.Actions>
      {editDropdownOptionsIndex !== null && (
        <EditDropdownOptionsModal
          open={showEditDropdownOptions}
          index={editDropdownOptionsIndex}
          control={control}
          onClose={() => handleCloseEditDropdownOptionsModal()}
        />
      )}
    </Modal>
  );
};

export default ManageFrameworkModal;
