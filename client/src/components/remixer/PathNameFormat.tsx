import React, { useEffect, useMemo, useState } from "react";
import { Message, Table } from "semantic-ui-react";
import {
  DEFAULT_PREFIX_OPTIONS,
  DELIMITER_OPTIONS,
  NUMBERING_TYPE_OPTIONS,
  NumberingType,
  PathLevelFormat,
} from "./model";
import { getStartToken, joinLeveledPathParts } from "./services";
import {
  Button,
  Checkbox,
  Heading,
  Input,
  Modal,
  Select,
  Text,
} from "@libretexts/davis-react";

interface PathNameFormatProps {
  open: boolean;
  dimmer: string;
  onClose: () => void;
  depth: number;
  pathLevelFormats: PathLevelFormat[];
  setPathLevelFormats: (pathLevelFormats: PathLevelFormat[]) => void;
  autoNumbering?: boolean;
  onAutoNumberingChange?: (checked: boolean) => void;
}

const PathNameFormat: React.FC<PathNameFormatProps> = (props) => {
  const {
    open,
    dimmer,
    onClose,
    depth,
    pathLevelFormats,
    setPathLevelFormats,
    autoNumbering = true,
    onAutoNumberingChange,
  } = props;

  const [levelFormats, setLevelFormats] = useState<PathLevelFormat[]>([]);
  const [localAutoNumbering, setLocalAutoNumbering] =
    useState<boolean>(autoNumbering);

  useEffect(() => {
    if (!open) return;
    setLocalAutoNumbering(autoNumbering);
    const savedByLevel = new Map(
      (pathLevelFormats ?? []).map((format) => [format.level, format]),
    );
    const normalized = Array.from(
      { length: Math.max(0, depth) },
      (_, index) => {
        const level = index + 1;
        const existing = savedByLevel.get(level);
        return (
          existing ?? {
            level,
            delimiter: ".",
            prefix: "",
            start: 1,
            type: "numeric" as NumberingType,
          }
        );
      },
    );
    setLevelFormats(normalized);
  }, [open, depth, pathLevelFormats, autoNumbering]);

  const previewByLevel = useMemo(() => {
    return levelFormats.map((_, targetIndex) => {
      const parts: { level: number; token: string }[] = [];
      let previewText = "";
      for (let index = 0; index <= targetIndex; index += 1) {
        const format = levelFormats[index];
        const level = format.level;
        const token = getStartToken(format.start, format.type);
        const tokenExists = token.trim().length > 0;
        const prefix = format.prefix ?? "";

        if (format.excludeParent) {
          if (tokenExists) {
            if (parts.length > 0) parts.pop();
            parts.push({ level, token });
          } else {
            parts.length = 0;
          }
          const numericPath = joinLeveledPathParts(parts, levelFormats);
          previewText = prefix ? `${prefix}${numericPath}` : numericPath;
          continue;
        }

        if (tokenExists) {
          parts.push({ level, token });
          const numericPath = joinLeveledPathParts(parts, levelFormats);
          previewText = prefix ? `${prefix}${numericPath}` : numericPath;
        }
      }
      return previewText;
    });
  }, [levelFormats]);

  const updateLevelFormat = (
    levelIndex: number,
    field: keyof Omit<PathLevelFormat, "level">,
    value: string | number | boolean,
  ) => {
    setLevelFormats((prev) =>
      prev.map((format, index) =>
        index === levelIndex ? { ...format, [field]: value } : format,
      ),
    );
  };

  const buildDefaultFormats = () =>
    Array.from({ length: Math.max(0, depth) }, (_, index) => ({
      level: index + 1,
      delimiter: ".",
      prefix: "",
      start: 1,
      type: "numeric" as NumberingType,
      excludeParent: false,
    }));

  const handleReset = () => {
    setLevelFormats(buildDefaultFormats());
    setLocalAutoNumbering(true);
  };

  const handleSave = () => {
    if (localAutoNumbering !== autoNumbering) {
      onAutoNumberingChange?.(localAutoNumbering);
    }
    setPathLevelFormats(levelFormats);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} size="xl">
      <Modal.Header>
        <div className="flex w-full min-w-0 items-center justify-between gap-4">
          <Heading level={4} className="min-w-0 shrink">
            Autonumber Options
          </Heading>
          <div className="ml-auto shrink-0">
            <Checkbox
              name="autoNumbering"
              checked={localAutoNumbering}
              // onChange={(_, data) => setLocalAutoNumbering(!!data.checked)}
              onChange={(checked) => setLocalAutoNumbering(checked)}
              label={localAutoNumbering ? "Enabled" : "Disabled"}
            />
          </div>
        </div>
      </Modal.Header>
      <Modal.Body>
        <p>
          Configure how each level of hierarchy numbering should be displayed.
        </p>
        {depth <= 0 ? (
          <Message
            info
            content="No nested levels detected in the current book."
          />
        ) : (
          <Table celled compact>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell width={1}>Level</Table.HeaderCell>
                <Table.HeaderCell width={3}>Label</Table.HeaderCell>
                <Table.HeaderCell width={3}>Index Designation</Table.HeaderCell>
                <Table.HeaderCell width={1}>Delimiter</Table.HeaderCell>
                <Table.HeaderCell width={3}>index start</Table.HeaderCell>
                <Table.HeaderCell width={1}>Exclude Parent</Table.HeaderCell>
                <Table.HeaderCell width={1}>continue</Table.HeaderCell>
                <Table.HeaderCell width={2}>Preview</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {levelFormats.map((format, index) => (
                <Table.Row key={format.level} verticalAlign="top">
                  <Table.Cell>{format.level}</Table.Cell>
                  <Table.Cell>
                    <datalist id={`prefix-options-${index}`} hidden>
                      {DEFAULT_PREFIX_OPTIONS.filter(
                        (opt) => opt.value !== "",
                      ).map((opt) => (
                        <option key={opt.key} value={opt.value} />
                      ))}
                    </datalist>
                    <Input
                      list={`prefix-options-${index}`}
                      name="prefix"
                      label=""
                      value={format.prefix}
                      placeholder="Type or choose a prefix…"
                      className="w-full mt-1.5"
                      onChange={(e) =>
                        updateLevelFormat(index, "prefix", e.target.value)
                      }
                    />
                    <Text size="xs" className="mt-1 text-neutral-500">
                      Example:{" "}
                      {`${format.prefix}${getStartToken(format.start, format.type)}`}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Select
                      options={NUMBERING_TYPE_OPTIONS.map((option) => ({
                        label: option.text,
                        value: option.value,
                      }))}
                      name="type"
                      label=""
                      value={format.type}
                      placeholder="Select a type"
                      className="w-full"
                      onChange={(e) =>
                        updateLevelFormat(
                          index,
                          "type",
                          String(e.target.value ?? "numeric"),
                        )
                      }
                    />
                  </Table.Cell>
                  <Table.Cell>
                    {index > 0 ? (
                      <Select
                        options={DELIMITER_OPTIONS.map((option) => ({
                          label: option.text,
                          value: option.value,
                        }))}
                        name="delimiter"
                        label=""
                        value={format.delimiter ?? "."}
                        placeholder="Delimiter"
                        className="w-full"
                        onChange={(e) =>
                          updateLevelFormat(
                            index,
                            "delimiter",
                            String(e.target.value ?? "."),
                          )
                        }
                      />
                    ) : (
                      "N/A"
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Input
                      type="number"
                      name="start"
                      label=" "
                      aria-label="Starting value"
                      value={format.start}
                      className="w-full"
                      onChange={(e) =>
                        updateLevelFormat(
                          index,
                          "start",
                          Number(e.target.value ?? 1),
                        )
                      }
                    />
                    <Text size="xs" className="mt-1 text-neutral-500">
                      Based on type: {getStartToken(format.start, format.type)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    {index > 0 ? (
                      <Checkbox
                        name="excludeParent"
                        label=""
                        checked={format.excludeParent ?? false}
                        onChange={() =>
                          updateLevelFormat(
                            index,
                            "excludeParent",
                            !format.excludeParent,
                          )
                        }
                      />
                    ) : (
                      "N/A"
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {index > 0 ? (
                      <Checkbox
                        name="continue"
                        label=""
                        checked={format.continue ?? false}
                        onChange={() =>
                          updateLevelFormat(index, "continue", !format.continue)
                        }
                      />
                    ) : (
                      "N/A"
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="sm" className="mt-3 text-gray-500">
                      {previewByLevel[index]}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button
          onClick={onClose}
          variant="outline"
          className="bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
        >
          Cancel
        </Button>
        <Button
          onClick={handleReset}
          variant="outline"
          className="bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
        >
          Reset to Defaults
        </Button>
        <Button
          onClick={handleSave}
          variant="primary"
          className="bg-primary text-white hover:bg-primary-dark"
        >
          Apply
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PathNameFormat;
