import { Controller, useFieldArray, useForm } from "react-hook-form";
import { Dropdown, Table } from "semantic-ui-react";
import {
  Button,
  IconButton,
  Modal,
  Spinner,
  Switch,
  Tabs,
  Tooltip,
} from "@libretexts/davis-react";
import {
  IconArrowDown,
  IconArrowUp,
  IconEdit,
  IconInfoCircle,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
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
import { truncateString } from "../../util/HelperFunctions";
import EditDropdownOptionsModal from "./EditDropdownOptionsModal";
import { cleanDropdownOptions } from "../../../utils/assetHelpers";

interface ManageFrameworkModalProps {
interface ManageFrameworkModalProps {
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
  const { handleGlobalError } = useGlobalError();
  const { control, reset, watch, getValues, setValue } =
  const { control, reset, watch, getValues, setValue } =
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

  const [loading, setLoading] = useState<boolean>(false);
  const [showEditDropdownOptions, setShowEditDropdownOptions] =
    useState<boolean>(false);
  const [editDropdownOptionsIndex, setEditDropdownOptionsIndex] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (open && mode === "edit" && id) loadFramework(id);
  }, [id, open]);

  async function loadFramework(id: string) {
    try {
      setLoading(true);
      const res = await api.getFramework(id);
      if (!res.data.framework) throw new Error("No framework found");

      const parsed: AssetTagTemplate[] = res.data.framework.templates.map(
        (t) => ({
          key: isAssetTagKeyObject(t.key) ? t.key.title : "",
          valueType: t.valueType,
          defaultValue: t.defaultValue,
          options: t.options,
          enabledAsFilter: t.enabledAsFilter,
          isDeleted: false,
        })
      );

      reset({ ...res.data.framework, templates: parsed });
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    const templates = cleanDropdownOptions(getValues("templates"));
    const frameworkData: AssetTagFramework = {
      ...getValues(),
      templates,
    };
    if (mode === "create") return createFramework(frameworkData);
    return updateFramework(frameworkData);
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
    const values = getValues();
    values.templates.forEach((t: AssetTagTemplate) => {
      if (t.options) t.options.sort();
    });
  }

  function getOptionsString(index: number): string {
    const opts = getValues(`templates.${index}.options`) as string[] | undefined;
    if (!opts || opts.length === 0) return "No options set";
    return truncateString(
      watch(`templates.${index}.options`)?.join(", ") ?? "",
      50
    );
  }

  function handleClose() {
    reset({ name: "", description: "", enabled: true, templates: [] });
    onClose();
  }

  function handleMoveUp(index: number) {
    if (index === 0 || !fields[index - 1]) return;
    move(index, index - 1);
  }

  function handleMoveDown(index: number) {
    if (index === fields.length - 1) return;
    if (index === fields.length - 1) return;
    move(index, index + 1);
  }

  return (
    <Modal open={open} onClose={handleClose} size="full">
      <Modal.Header>
        <div className="flex items-center justify-between w-full">
          <Modal.Title>
            {mode === "create" ? "Create" : "Edit"} Framework
          </Modal.Title>
          <div className="flex items-center gap-2">
            <Switch
              checked={watch("enabled") ?? true}
              onChange={(checked) => setValue("enabled", checked)}
            />
            <span className="text-sm">Enabled</span>
          </div>
        </div>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <Tabs defaultIndex={0}>
            <Tabs.List>
              <Tabs.Tab>Details</Tabs.Tab>
              <Tabs.Tab>Tags</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panels>
              <Tabs.Panel>
                <div className="flex flex-col gap-4 pt-4">
                  <CtlTextInput
                    name="name"
                    control={control}
                    label="Name"
                    fluid
                  />
                  <CtlTextInput
                    name="description"
                    control={control}
                    label="Description"
                    fluid
                  />
                </div>
              </Tabs.Panel>
              <Tabs.Panel>
                <div className="pt-4">
                  <Table celled className="!mt-1">
                    <Table.Header fullWidth>
                      <Table.Row key="header">
                        <Table.HeaderCell>Tag Title</Table.HeaderCell>
                        <Table.HeaderCell>Value Type</Table.HeaderCell>
                        <Table.HeaderCell>
                          Options / Default Value (optional)
                        </Table.HeaderCell>
                        <Table.HeaderCell width={2}>
                          <div className="flex items-center gap-1">
                            Enabled as Search Filter
                            <Tooltip
                              content="If enabled, this tag will be available as a filter in Common's assets search."
                              placement="top"
                            >
                              <span className="cursor-help">
                                <IconInfoCircle size={16} />
                              </span>
                            </Tooltip>
                          </div>
                        </Table.HeaderCell>
                        <Table.HeaderCell width={2}>Actions</Table.HeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {(!watch("templates") ||
                        watch("templates").length === 0) && (
                        <Table.Row>
                          <Table.Cell colSpan={5} className="text-center">
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
                                      onChange={(_e, data) => {
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
                                  <div className="flex items-center gap-2">
                                    <p className="mr-2">
                                      {getOptionsString(index)}
                                    </p>
                                    <IconButton
                                      icon={<IconEdit size={16} />}
                                      aria-label="Edit options"
                                      onClick={() =>
                                        handleEditDropdownOptions(index)
                                      }
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
                                <div className="flex items-center justify-center gap-1">
                                  <IconButton
                                    icon={<IconArrowUp size={16} />}
                                    aria-label="Move up"
                                    onClick={() => handleMoveUp(index)}
                                  />
                                  <IconButton
                                    icon={<IconArrowDown size={16} />}
                                    aria-label="Move down"
                                    onClick={() => handleMoveDown(index)}
                                  />
                                  <IconButton
                                    icon={<IconTrash size={16} />}
                                    aria-label="Remove tag"
                                    variant="destructive"
                                    onClick={() => remove(index)}
                                  />
                                </div>
                              </Table.Cell>
                            </Table.Row>
                          )
                      )}
                    </Table.Body>
                  </Table>
                  <Button
                    variant="primary"
                    icon={<IconPlus size={16} />}
                    className="mt-3"
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
                    Add Tag
                  </Button>
                </div>
              </Tabs.Panel>
            </Tabs.Panels>
          </Tabs>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={handleClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} loading={loading}>
          Save
        </Button>
      </Modal.Footer>
      {editDropdownOptionsIndex !== null && (
        <EditDropdownOptionsModal
          open={showEditDropdownOptions}
          index={editDropdownOptionsIndex}
          control={control}
          onClose={() => handleCloseEditDropdownOptionsModal()}
        />
      )}
    </>
  );
};

export default ManageFrameworkModal;
