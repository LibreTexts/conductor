import React, { useState } from "react";
import { useMediaQuery } from "react-responsive";
import { Dropdown, Grid, Header, Icon, Modal, Popup } from "semantic-ui-react";
import {
  DAVIS_REMIXER_BTN_CLASS,
  buttonActiveStyle,
  buttonStyle,
  handleMouseEnter,
  handleMouseLeave,
} from "./style";
import { CopyMode, copyModeStates, defaultCopyModeState } from "./model";
import { Button, IconButton, Select, Stack } from "@libretexts/davis-react";

/** Matches davis IconButton `md` (`size-10` = 2.5rem) row height for toolbar + modal actions. */
const CP_CONTROL_H = "h-10 min-h-10 shrink-0";
const cpTextBtn = (surface: string) => `${surface} ${CP_CONTROL_H}`;
const cpIconBtn = (surface: string) => `${surface} ${CP_CONTROL_H} size-10`;

interface ControlPanelProps {
  onStartOver?: () => void | Promise<void>;
  onLoadVersion?: () => void;
  onPublish?: () => void;
  onPathNameFormat?: () => void;
  onSave?: () => void;
  copyModeState?: CopyMode;
  onCopyModeChange?: (value: CopyMode) => void;
  isAdmin?: boolean;
  autoNumbering: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  onStartOver,
  onLoadVersion,

  onPublish,
  onSave,
  onPathNameFormat,
  copyModeState,
  onCopyModeChange,
  isAdmin = false,
  autoNumbering,
}) => {
  const [confirmStartOverOpen, setConfirmStartOverOpen] = useState(false);
  const [startOverLoading, setStartOverLoading] = useState(false);
  const isToolbarNarrow = useMediaQuery({ maxWidth: 767 });

  const handleStartOverConfirm = async () => {
    if (!onStartOver) {
      setConfirmStartOverOpen(false);
      return;
    }
    setStartOverLoading(true);
    try {
      await onStartOver();
      setConfirmStartOverOpen(false);
    } finally {
      setStartOverLoading(false);
    }
  };

  return (
    <Grid.Row
      style={{
        position: "absolute",
        top: 100,
        // left: 0,
        // right: 0,
        // margin: 0,
        padding: "25px",
        zIndex: 10,
        justifyContent: "center",
      }}
    >
      <Grid.Column
        width={16}
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.80)",
          minHeight: "56px",
          padding: "8px 12px",
          borderRadius: "10px",
          border: "1px solid #000",
          overflow: "visible",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "2px",
            }}
          >
            <Button
              onClick={() => setConfirmStartOverOpen(true)}
              style={buttonStyle}
              className={cpTextBtn(DAVIS_REMIXER_BTN_CLASS.neutral)}
              icon={<Icon name="refresh" />}
              iconPosition="left"
            >
              Start Over
            </Button>
            <Popup
              content="Load a different version"
              position="bottom center"
              trigger={
                <span className={`inline-flex items-center ${CP_CONTROL_H}`}>
                  <IconButton
                    onClick={onLoadVersion}
                    icon={<Icon name="history" />}
                    className={cpIconBtn(DAVIS_REMIXER_BTN_CLASS.neutral)}
                    aria-label="Load a different version"
                  />
                </span>
              }
            />
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              minWidth: 0,
            }}
          >
            {/* <Dropdown
                options={copyModeStates.map((state) => ({
                  key: state.value,
                  text: isToolbarNarrow ? state.title.length > 10 ? state.title.substring(0, 10) + "..." : state.title : state.title,
                  value: state.value,
                }))}
                value={copyModeState ?? defaultCopyModeState.value}
                onChange={(_e, { value }) => {
                  const next = copyModeStates.find((s) => s.value === value);
                  if (next) onCopyModeChange?.(next.value);
                }}
                selection
                compact
                upward={false}
                placeholder="Copy Mode..."
                style={{ minWidth: 180, zIndex: 20, minHeight: 40 }}
              /> */}
            {isAdmin && (
              <Select
                name="copyMode"
                label=""
                options={copyModeStates.map((state) => ({
                  label: state.title,
                  value: state.value,
                }))}
                placeholder="Copy Mode..."
                value={copyModeState ?? defaultCopyModeState.value}
                onChange={(e) => {
                  const next = copyModeStates.find(
                    (s) => s.value === e.target.value,
                  );
                  if (next) onCopyModeChange?.(next.value);
                }}
              />
            )}
            <Popup
              content="Autonumbering settings"
              position="bottom center"
              trigger={
                <Button
                  style={buttonStyle}
                  onClick={onPathNameFormat}
                  className={
                    autoNumbering
                      ? `${DAVIS_REMIXER_BTN_CLASS.success} ${CP_CONTROL_H}`
                      : cpTextBtn(DAVIS_REMIXER_BTN_CLASS.neutral)
                  }
                >
                  Autonumber
                </Button>
              }
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "2px",
              flexWrap: "nowrap",
              overflowX: "visible",
              minWidth: 0,
            }}
          >
            {isToolbarNarrow ? (
              <Dropdown
                direction="left"
                icon={null}
                trigger={
                  <span className={`inline-flex items-center ${CP_CONTROL_H}`}>
                    <IconButton
                      icon={<Icon name="ellipsis vertical" />}
                      className={cpIconBtn(DAVIS_REMIXER_BTN_CLASS.neutral)}
                      aria-label="Control panel actions"
                    />
                  </span>
                }
              >
                <Dropdown.Menu>
                  <Dropdown.Item
                    icon="options"
                    text="Path Name Format"
                    onClick={onPathNameFormat}
                    className={
                      autoNumbering
                        ? DAVIS_REMIXER_BTN_CLASS.menuSuccess
                        : undefined
                    }
                  />
                  <Dropdown.Divider />
                  <Dropdown.Item
                    icon="save"
                    text="Save as a draft"
                    onClick={onSave}
                  />
                  <Dropdown.Item
                    icon="upload"
                    text="Save to Library"
                    onClick={onPublish}
                  />
                </Dropdown.Menu>
              </Dropdown>
            ) : (
              <>
                <Popup
                  content="Save as a draft"
                  position="bottom center"
                  aria-label="Save as a draft"
                  trigger={
                    <span
                      className={`inline-flex items-center ${CP_CONTROL_H}`}
                    >
                      <IconButton
                        icon={<Icon name="save" />}
                        onClick={onSave}
                        className={cpIconBtn(DAVIS_REMIXER_BTN_CLASS.neutral)}
                        aria-label="Save as a draft"
                      />
                    </span>
                  }
                />
                <Popup
                  content="Save on Library"
                  position="bottom center"
                  aria-label="Save to Library"
                  trigger={
                    <span
                      className={`inline-flex items-center ${CP_CONTROL_H}`}
                    >
                      <IconButton
                        icon={<Icon name="upload" />}
                        onClick={onPublish}
                        className={cpIconBtn(DAVIS_REMIXER_BTN_CLASS.neutral)}
                        aria-label="Save to Library"
                      />
                    </span>
                  }
                />
              </>
            )}
          </div>
        </div>
      </Grid.Column>
      <Modal
        open={confirmStartOverOpen}
        size="small"
        onClose={() => {
          if (!startOverLoading) setConfirmStartOverOpen(false);
        }}
      >
        <Modal.Header>Start Over?</Modal.Header>
        <Modal.Content>
          This will delete the saved remixer draft for this project. This action
          cannot be undone.
        </Modal.Content>
        <Modal.Actions>
          <Stack direction="horizontal" gap="md" justify="end">
            <Button
              className={CP_CONTROL_H}
              onClick={() => setConfirmStartOverOpen(false)}
              disabled={startOverLoading}
            >
              Cancel
            </Button>
            <Button
              className={`${DAVIS_REMIXER_BTN_CLASS.success} ${CP_CONTROL_H}`}
              onClick={handleStartOverConfirm}
              loading={startOverLoading}
              disabled={startOverLoading}
            >
              Confirm
            </Button>
          </Stack>
        </Modal.Actions>
      </Modal>
    </Grid.Row>
  );
};

export default ControlPanel;
