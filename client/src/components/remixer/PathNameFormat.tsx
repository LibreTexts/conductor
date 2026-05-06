import React, { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Dropdown, Input, Message, Modal, Table } from "semantic-ui-react";
import {
  DEFAULT_PREFIX_OPTIONS,
  DELIMITER_OPTIONS,
  NUMBERING_TYPE_OPTIONS,
  NumberingType,
  PathLevelFormat,
  PrefixOption,
} from "./model";
import { getStartToken, joinLeveledPathParts } from "./services";

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
  const [prefixOptions, setPrefixOptions] =
    useState<PrefixOption[]>(DEFAULT_PREFIX_OPTIONS);
  const [localAutoNumbering, setLocalAutoNumbering] =
    useState<boolean>(autoNumbering);

  useEffect(() => {
    if (!open) return;
    setLocalAutoNumbering(autoNumbering);
    const savedByLevel = new Map(
      (pathLevelFormats ?? []).map((format) => [format.level, format]),
    );
    const normalized = Array.from({ length: Math.max(0, depth) }, (_, index) => {
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
    });
    setLevelFormats(normalized);
    setPrefixOptions((prev) => {
      const next = [...prev];
      normalized.forEach((format) => {
        if (!next.some((option) => option.value === format.prefix)) {
          next.push(toPrefixOption(format.prefix));
        }
      });
      return next;
    });
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

  const toPrefixOption = (rawPrefix: string): PrefixOption => {
    const trimmed = rawPrefix.trim();
    const label = trimmed || "None";
    return {
      key: `custom-${label.toLowerCase().replace(/\s+/g, "-")}`,
      text: label,
      value: rawPrefix,
    };
  };

  const ensurePrefixOption = (rawPrefix: string) => {
    if (prefixOptions.some((option) => option.value === rawPrefix)) return;
    setPrefixOptions((prev) => [...prev, toPrefixOption(rawPrefix)]);
  };

  const handleSave = () => {
    if (localAutoNumbering !== autoNumbering) {
      onAutoNumberingChange?.(localAutoNumbering);
    }
    setPathLevelFormats(levelFormats);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} dimmer={dimmer} size="fullscreen">
      <Modal.Header>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span>Autonumber Options</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <span></span>
            <Checkbox
              toggle
              checked={localAutoNumbering}
              onChange={(_, data) => setLocalAutoNumbering(!!data.checked)}
              label={localAutoNumbering ? "Enabled" : "Disabled"}
            />
      
          </div>
        </div>
      </Modal.Header>
      <Modal.Content>
        <p>Configure how each level of hierarchy numbering should be displayed.</p>
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
                <Table.HeaderCell width={1}>Exclude Parent </Table.HeaderCell>
                <Table.HeaderCell width={1}>Delimiter</Table.HeaderCell>
                <Table.HeaderCell width={3}>Prefix</Table.HeaderCell>
                <Table.HeaderCell width={3}>Type</Table.HeaderCell>
                <Table.HeaderCell width={3}>Starting</Table.HeaderCell>

                <Table.HeaderCell width={2}>Preview</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {levelFormats.map((format, index) => (
                <Table.Row key={format.level} verticalAlign="top">
                  <Table.Cell>{format.level}</Table.Cell>
                  <Table.Cell>
                    <Checkbox
                      checked={format.excludeParent ?? false}
                      onChange={() => updateLevelFormat(index, "excludeParent", !(format.excludeParent ))}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Dropdown
                      fluid
                      selection
                      search
                      allowAdditions
                      additionLabel="Custom: "
                      options={DELIMITER_OPTIONS}
                      value={format.delimiter ?? "."}
                      placeholder="Delimiter"
                      onChange={(_, data) =>
                        updateLevelFormat(
                          index,
                          "delimiter",
                          String(data.value ?? "."),
                        )
                      }
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Dropdown
                      fluid
                      selection
                      search
                      allowAdditions
                      additionLabel="Custom: "
                      options={prefixOptions}
                      value={format.prefix}
                      placeholder="Select or type a prefix"
                      onAddItem={(_, data) => {
                        const rawValue = String(data.value ?? "").trim();
                        const normalized =
                          rawValue.length > 0 && !rawValue.endsWith(" ")
                            ? `${rawValue} `
                            : rawValue;
                        ensurePrefixOption(normalized);
                        updateLevelFormat(index, "prefix", normalized);
                      }}
                      onChange={(_, data) => {
                        const value = String(data.value ?? "");
                        updateLevelFormat(index, "prefix", value);
                      }}
                    />
                    
                    <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                      Example: {`${format.prefix}${getStartToken(format.start, format.type)}`}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Dropdown
                      fluid
                      selection
                      options={NUMBERING_TYPE_OPTIONS}
                      value={format.type}
                      onChange={(_, data) =>
                        updateLevelFormat(
                          index,
                          "type",
                          (data.value as NumberingType) ?? "numeric",
                        )
                      }
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Input
                      fluid
                      type="number"
                      min={1}
                      step={1}
                      value={format.start}
                      onChange={(event) =>
                        updateLevelFormat(
                          index,
                          "start",
                          Number(event.target.value) || 1,
                        )
                      }
                    />
                    <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                      Based on type: {getStartToken(format.start, format.type)}
                    </div>
                  </Table.Cell>
                  <Table.Cell>{previewByLevel[index]}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button positive onClick={handleSave}>
          Apply
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default PathNameFormat;
