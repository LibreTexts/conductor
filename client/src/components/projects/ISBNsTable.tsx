import React from "react";
import {
  useFieldArray,
  Controller,
  Control,
  useWatch,
  UseFormSetValue,
} from "react-hook-form";
import {
  Button,
  Heading,
  IconButton,
  Input,
  Select,
  Text,
} from "@libretexts/davis-react";
import { IconPlus, IconTrash } from "@tabler/icons-react";

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
  { value: "Audio", label: "Audio" },
  { value: "E-Book", label: "E-Book" },
  { value: "Print", label: "Print" },
];

const formatOptions: Record<string, { value: string; label: string }[]> = {
  Audio: [
    { value: "CD Audio", label: "CD Audio" },
    { value: "DVD Audio", label: "DVD Audio" },
    { value: "Downloadable Audio File", label: "Downloadable Audio File" },
  ],
  "E-Book": [
    { value: "Digital online", label: "Digital online" },
    { value: "Electronic book text", label: "Electronic book text" },
  ],
  Print: [
    { value: "Hardback", label: "Hardback" },
    { value: "Paperback", label: "Paperback" },
  ],
};

const ISBNsTable: React.FC<ISBNsTableProps> = ({ control, setValue }) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "isbns",
  });

  const isbns = (useWatch({ control, name: "isbns" }) as ISBNEntry[]) || [];

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
    <div className="w-full space-y-2">
      <Heading level={4} className="m-0! text-sm font-bold text-slate-900">
        ISBNs
      </Heading>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Medium
              </th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Format
              </th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                ISBN
              </th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {fields.map((fieldItem, idx) => (
              <tr key={fieldItem.id}>
                <td className="px-3 py-2 min-w-[140px]">
                  <Controller
                    control={control}
                    name={`isbns.${idx}.medium`}
                    render={({ field }) => (
                      <div className="timeline-granularity-select">
                        <Select
                          name={field.name}
                          label="Medium"
                          labelClassName="sr-only"
                          size="sm"
                          placeholder="Select Medium"
                          options={mediumOptions}
                          value={field.value ?? ""}
                          onChange={(e) => {
                            const nextMedium = e.target.value;
                            field.onChange(nextMedium);
                            if (
                              isbns[idx]?.format &&
                              !getFormats(nextMedium).some(
                                (f) => f.value === isbns[idx].format
                              )
                            ) {
                              setValue(`isbns.${idx}.format`, "");
                            }
                          }}
                          onBlur={field.onBlur}
                        />
                      </div>
                    )}
                  />
                </td>
                <td className="px-3 py-2 min-w-[160px]">
                  <Controller
                    control={control}
                    name={`isbns.${idx}.format`}
                    render={({ field }) => {
                      const availableFormats = getFormats(
                        isbns[idx]?.medium
                      ).filter(
                        (opt) =>
                          opt.value === field.value ||
                          !isFormatUsed(isbns[idx]?.medium, opt.value, idx)
                      );
                      return (
                        <div className="timeline-granularity-select">
                          <Select
                            name={field.name}
                            label="Format"
                            labelClassName="sr-only"
                            size="sm"
                            placeholder="Select Format"
                            options={availableFormats}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value)}
                            onBlur={field.onBlur}
                            disabled={!isbns[idx]?.medium}
                          />
                        </div>
                      );
                    }}
                  />
                </td>
                <td className="px-3 py-2 min-w-[160px]">
                  <Controller
                    control={control}
                    name={`isbns.${idx}.isbn`}
                    render={({ field }) => (
                      <div className="task-search-input">
                        <Input
                          name={field.name}
                          label="ISBN"
                          labelClassName="sr-only"
                          size="sm"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          disabled={!isbns[idx]?.format}
                          placeholder="Digits only - no dashes"
                        />
                      </div>
                    )}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <IconButton
                    icon={<IconTrash size={15} />}
                    iconClassName="items-center justify-center"
                    aria-label="Remove ISBN row"
                    variant="destructive"
                    size="sm"
                    onClick={() => remove(idx)}
                  />
                </td>
              </tr>
            ))}
            {fields.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center">
                  <Text size="sm" color="muted">
                    No ISBNs added yet. Click &ldquo;Add Format&rdquo; to get
                    started.
                  </Text>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Button
        variant="primary"
        size="sm"
        icon={<IconPlus size={15} />}
        iconClassName="items-center justify-center"
        onClick={() => append({ medium: "", format: "", isbn: "" })}
      >
        Add Format
      </Button>
    </div>
  );
};

export default ISBNsTable;
