import React from "react";
import { useFieldArray, Controller, Control, useWatch, UseFormSetValue } from "react-hook-form";
import { Dropdown, Button, Table, Input, Icon } from "semantic-ui-react";
import CtlTextInput from "../ControlledInputs/CtlTextInput";

interface ISBNEntry {
  medium: string;
  format: string;
  isbn: string;
}

interface ISBNsTableProps {
  control: Control<any>;
  setValue: UseFormSetValue<any>;
}

const mediumOptions = [
  { value: "Audio", text: "Audio" },
  { value: "E-Book", text: "E-Book" },
  { value: "Print", text: "Print" },
];

const formatOptions: Record<string, { value: string; text: string }[]> = {
  Audio: [
    { value: "CD Audio", text: "CD Audio" },
    { value: "DVD Audio", text: "DVD Audio" },
    { value: "Downloadable Audio File", text: "Downloadable Audio File" },
  ],
  "E-Book": [
    { value: "Digital online", text: "Digital online" },
    { value: "Electronic book text", text: "Electronic book text" },
  ],
  Print: [
    { value: "Hardback", text: "Hardback" },
    { value: "Paperback", text: "Paperback" },
  ],
};

const ISBNsTable: React.FC<ISBNsTableProps> = ({ control, setValue }) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "isbns",
  });

  const isbns = useWatch({ control, name: "isbns" }) as ISBNEntry[] || [];

  const getFormats = (medium: string) => formatOptions[medium] || [];

    const isFormatUsed = (medium: string, format: string, idx: number) =>
        isbns.some(
            (row, i) =>
            i !== idx &&
            row.medium === medium &&
            row.format === format &&
            medium &&
            format
        );

  return (
    <div>
      <h3>ISBN's</h3>
      <Table celled fluid>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Medium</Table.HeaderCell>
            <Table.HeaderCell>Format</Table.HeaderCell>
            <Table.HeaderCell>ISBN</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {fields.map((field, idx) => (
            <Table.Row key={field.id}>
              <Table.Cell>
                    <Controller
                        control={control}
                        name={`isbns.${idx}.medium`}
                        render={({ field }) => (
                            <Dropdown
                            compact
                            selection
                            options={mediumOptions}
                            placeholder="Select Medium"
                            value={field.value}
                            onChange={(_, data) => {
                                field.onChange(data.value);
                                if (
                                isbns[idx]?.format &&
                                !getFormats(data.value as string).some(
                                    (f) => f.value === isbns[idx].format
                                )
                                ) {
                                setValue(`isbns.${idx}.format`, "");
                                }
                            }}
                            onBlur={field.onBlur}
                            />
                        )}
                    />
              </Table.Cell>
              <Table.Cell>
                <Controller
                    control={control}
                    name={`isbns.${idx}.format`}
                    render={({ field }) => {
                    const formatDropdownOptions = getFormats(isbns[idx]?.medium).map(opt => ({
                        ...opt,
                        disabled: isFormatUsed(isbns[idx]?.medium, opt.value, idx),
                    }));
                    return (
                        <Dropdown
                        compact
                        selection
                        options={formatDropdownOptions}
                        placeholder="Select Format"
                        value={field.value}
                        onChange={(_, data) => field.onChange(data.value)}
                        onBlur={field.onBlur}
                        disabled={!isbns[idx]?.medium}
                        style={{ minWidth: 120, maxWidth: 180, width: '100%' }}
                        />
                    );
                    }}
                />
              </Table.Cell>
              <Table.Cell style={{ minWidth: 120 }}>
                <Controller
                  control={control}
                  name={`isbns.${idx}.isbn`}
                  disabled={!isbns[idx]?.format}
                  render={({ field }) => (
                    <Input {...field} placeholder="Enter value" />
                  )}
                />
              </Table.Cell>
              <Table.Cell>
                <Button
                  color="red"
                  icon
                  onClick={() => remove(idx)}
                >
                  <Icon name="trash" />
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
          {fields.length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={4} textAlign="center">
                <em>No ISBNs added yet. Click "Add Format" to get started.</em>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>
      <Button
        color="blue"
        icon
        labelPosition="left"
        onClick={() => append({ medium: "", format: "", isbn: "" })}
      >
        <Icon name="plus" />
        Add Format
      </Button>
    </div>
  );
};

export default ISBNsTable;