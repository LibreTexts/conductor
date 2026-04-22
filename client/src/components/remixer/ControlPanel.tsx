import React, { useState } from "react";
import { Button, Dropdown, Grid, Header, Icon, Modal, Popup } from "semantic-ui-react";
import {
  buttonActiveStyle,
  buttonStyle,
  handleMouseEnter,
  handleMouseLeave,
} from "./style";
import { CopyMode, copyModeStates, defaultCopyModeState } from "./model";

interface ControlPanelProps {
  onStartOver?: () => void | Promise<void>;
  onLoadVersion?: () => void;
  onPublish?: () => void;
  onPathNameFormat?: () => void;
  onSave?: () => void;
  copyModeState?: CopyMode;
  onCopyModeChange?: (value: CopyMode) => void;
  isAdmin?: boolean;
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
}) => {
  const [confirmStartOverOpen, setConfirmStartOverOpen] = useState(false);
  const [startOverLoading, setStartOverLoading] = useState(false);

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
        position: "fixed",
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
          <Header
            as="h2"
            style={{ margin: 0, whiteSpace: "nowrap", color: "white" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              <Button
                style={buttonStyle}
                onClick={() => setConfirmStartOverOpen(true)}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <Icon name="refresh" /> Start Over
              </Button>
              <Popup
                content="Load a different version"
                position="bottom center"
                trigger={
                  <Button
                    icon
                    style={buttonStyle}
                    onClick={onLoadVersion}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  >
                    <Icon name="history" />
                  </Button>
                }
              />{" "}
            </div>
          </Header>
          {isAdmin && (
            <div
              style={{
                flex: 1,
                display: "flex",
                justifyContent: "center",
                minWidth: 0,
              }}
            >
              <Dropdown
                options={copyModeStates.map((state) => ({
                  key: state.value,
                  text: state.title,
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
                style={{ minWidth: 180, zIndex: 20 }}
              />
            </div>
          )}
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
            <Popup
              content="Path Name Format"
              position="bottom center"
              trigger={
                <Button
                  onClick={onPathNameFormat}
                  style={buttonStyle}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                 Auto number
                </Button>
              }
            />

            <Popup
              content="Save as a draft"
              position="bottom center"
              trigger={
                <Button
                  icon
                  onClick={onSave}
                  style={buttonStyle}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <Icon name="save" />
                </Button>
              }
            />
            <Popup
              content="Save on Library"
              position="bottom center"
              trigger={
                <Button
                  icon
                  onClick={onPublish}
                  style={buttonStyle}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <Icon name="upload" />
                </Button>
              }
            />
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
          <Button
            onClick={() => setConfirmStartOverOpen(false)}
            disabled={startOverLoading}
          >
            Cancel
          </Button>
          <Button
            negative
            onClick={handleStartOverConfirm}
            loading={startOverLoading}
            disabled={startOverLoading}
          >
            Confirm
          </Button>
        </Modal.Actions>
      </Modal>
    </Grid.Row>
  );
};

export default ControlPanel;
