import { useState, useRef } from "react";
import { Control, Controller, useFieldArray } from "react-hook-form";
import {
  Button,
  Icon,
  Input,
  Modal,
  ModalProps,
  Popup,
  Table,
} from "semantic-ui-react";
import { AssetTagFramework } from "../../../types";
import "../../../styles/global.css";
import useGlobalError from "../../error/ErrorHooks";
import { ParseResult, parse } from "papaparse";

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
  const { handleGlobalError } = useGlobalError();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `templates.${index}.options`,
  });

  const [loading, setLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleOpenFileDialog() {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Handle file selection here
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      parseFile(selectedFile);
    }
  };

  async function parseFile(file: File) {
    try {
      setLoading(true);

      function parsePromise(file: File) {
        return new Promise<ParseResult<unknown>>((resolve, reject) => {
          // @ts-ignore
          parse(file, {
            header: true,
            skipEmptyLines: true,
            trimHeaders: true,
            preview: 1500, // Only parse first 1500 rows
            complete: (results) => {
              resolve(results); // Resolve the Promise with parsed data
            },
            error: (error) => {
              reject(error); // Reject the Promise with the error
            },
          });
        });
      }

      const results = await parsePromise(file);
      const dataObjs = results.data.filter(
        (r) => typeof r === "object" && r !== null
      ) as object[];
      const options = dataObjs
        .filter((obj) => obj.hasOwnProperty("options"))
        // @ts-ignore
        .map((obj) => obj["options"])
        .flat();
      const stringOptions = options.map((opt) => opt.toString());
      const uniqueOptions = [...new Set(stringOptions)];
      const sortedOptions = uniqueOptions.sort((a, b) => a.localeCompare(b));

      if (sortedOptions.length + fields.length > 1500) {
        throw new Error(
          "Dropdown/multi-select options have a maximum of 1500 total options. This request would exceed that limit."
        );
      }

      for (const option of sortedOptions) {
        append(option);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

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
              <Table.Row key={opt.id}>
                <Table.Cell>
                  <Controller
                    render={({ field }) => <Input {...field} fluid />}
                    name={`templates.${index}.options.${idx}`}
                    control={control}
                  />
                </Table.Cell>
                <Table.Cell>
                  <Button
                    icon="x"
                    onClick={() => remove(idx)}
                    loading={loading}
                  ></Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        <input
          type="file"
          accept=".csv"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex justify-end">
          <Button
            color="blue"
            onClick={() => append("", { shouldFocus: false })}
            loading={loading}
          >
            <Icon name="plus" />
            Add Option
          </Button>
        </div>
        <p className="text-muted italic text-center mb-4">
          Options are sorted alphabetically (A-Z) on save
        </p>
      </Modal.Content>
      <Modal.Actions>
        <div className="flex justify-between">
          <div className="flex justify-start items-center">
            <Button onClick={() => handleOpenFileDialog()} loading={loading}>
              <Icon name="file alternate outline" />
              Add from CSV
            </Button>
            <Popup
              content="Create a CSV file with one option per line. The first line should be the column header 'options' (no quotes). All other columns will be ignored. Any duplicate options will be ignored. To prevent misuse, only the first 1500 rows will be parsed. Dropdown/multi-select options have a maximum of 1500 options."
              trigger={
                <span className="ml-1 underline cursor-pointer">
                  How do I use this?
                </span>
              }
            />
          </div>
          <Button onClick={() => onClose()} color="green">
            <Icon name="save" />
            Save
          </Button>
        </div>
      </Modal.Actions>
    </Modal>
  );
};

export default EditDropdownOptionsModal;
