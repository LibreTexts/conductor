import {
  Control,
  Controller,
  FieldArrayWithId,
  UseFormGetValues,
  UseFormSetValue,
  UseFormWatch,
  useFieldArray,
  useForm,
} from "react-hook-form";
import {
  Button,
  Dropdown,
  Icon,
  Input,
  Modal,
  ModalProps,
  Select,
  Table,
} from "semantic-ui-react";
import {
  AssetTag,
  AssetTagFramework,
  AssetTagValueTypeOptions,
} from "../../../types";
import CtlCheckbox from "../../ControlledInputs/CtlCheckbox";
import CtlTextInput from "../../ControlledInputs/CtlTextInput";
import "../../../styles/global.css";
import { isAssetTag, isAssetTagArray } from "../../../utils/typeHelpers";
import { useEffect, useState } from "react";
import CtlDropdown from "../../ControlledInputs/CtlDropdown";
import useGlobalError from "../../error/ErrorHooks";
import api from "../../../api";
import LoadingSpinner from "../../LoadingSpinner";
import { truncateString } from "../../util/HelperFunctions";
import { setConstantValue } from "typescript";

interface EditDropdownOptionsModalProps extends ModalProps {
  open: boolean;
  index: number;
  control: Control<AssetTagFramework>;
  onClose: () => void;
}

const EditDropdownOptionsModal: React.FC<EditDropdownOptionsModalProps> = ({
  open,
  index,
  control,
  onClose,
}) => {
  // Global State & Hooks
  const { fields, append, remove } = useFieldArray({
    control,
    name: `tags.${index}.options`,
  });

  // Data & UI
  const [loading, setLoading] = useState<boolean>(false);

  // Effects

  // Handlers & Methods
  function handleSave() {}

  return (
    <Modal open={open} onClose={() => onClose()} size="small">
      <Modal.Header>Edit Dropdown Options</Modal.Header>
      <Modal.Content scrolling>
        {loading && (
          <div className="my-4r">
            <LoadingSpinner />
          </div>
        )}
        {!loading && (
          <div>
            <p className="form-field-label">Dropdown Options</p>
            <Table celled className="!mt-1">
              <Table.Header fullWidth>
                <Table.Row key="header">
                  <Table.HeaderCell>Option Value</Table.HeaderCell>
                  <Table.HeaderCell>Actions</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {(!fields || fields.length === 0) && (
                  <Table.Row>
                    <Table.Cell colSpan={2} className="text-center">
                      No options added yet.
                    </Table.Cell>
                  </Table.Row>
                )}
                {fields.map((opt, idx) => (
                  <Table.Row key={idx}>
                    <Table.Cell>
                      <Controller
                        render={({ field }) => <Input {...field} fluid />}
                        name={`tags.${index}.options.${idx}`}
                        control={control}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Button icon="x" onClick={() => remove(idx)}></Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
            <Button color="blue" onClick={() => append("")}>
              <Icon name="plus" />
              Add Option
            </Button>
          </div>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => onClose()}>
          Done
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default EditDropdownOptionsModal;
