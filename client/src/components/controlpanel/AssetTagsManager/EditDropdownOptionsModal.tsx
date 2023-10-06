import { Control, Controller, useFieldArray } from "react-hook-form";
import {
  Button,
  Icon,
  Input,
  Modal,
  ModalProps,
  Table,
} from "semantic-ui-react";
import { AssetTagFramework } from "../../../types";
import "../../../styles/global.css";

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
    name: `templates.${index}.options`,
  });

  return (
    <Modal open={open} onClose={() => onClose()} size="small">
      <Modal.Header>Edit Dropdown Options</Modal.Header>
      <Modal.Content scrolling>
        <p className="form-field-label">Dropdown Options</p>
        <Table celled className="!mt-1">
          <Table.Header fullWidth>
            <Table.Row key="header">
              <Table.HeaderCell>Option Value</Table.HeaderCell>
              <Table.HeaderCell width={1}>Actions</Table.HeaderCell>
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
                    name={`templates.${index}.options.${idx}`}
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
        <Button color="blue" onClick={() => append("", {shouldFocus: false})}>
          <Icon name="plus" />
          Add Option
        </Button>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => onClose()} color="green">
          <Icon name="save" />
          Save
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default EditDropdownOptionsModal;
