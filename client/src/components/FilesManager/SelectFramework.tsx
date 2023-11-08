import React, { useState, useEffect } from "react";
import { Modal, Form, Button, Icon, ModalProps } from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import { AssetTagFramework } from "../../types";
import api from "../../api";

interface SelectFrameworkProps extends ModalProps {
  show: boolean;
  onClose: () => void;
  onSelected: (framework: string) => void;
}

/**
 * Modal tool to select a framework for asset tagging.
 */
const SelectFramework: React.FC<SelectFrameworkProps> = ({
  show,
  onClose,
  onSelected,
  rest,
}) => {
  // Global State & Hooks
  const { handleGlobalError } = useGlobalError();

  // Data & UI
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [frameworks, setFrameworks] = useState<AssetTagFramework[]>([]);

  // Effects
  useEffect(() => {
    if (show) {
      setSelectedId("");
      loadFrameworks();
    }
  }, [show]);

  // Handlers & Methods

  async function handleSelectFramework() {
    if (!selectedId) {
      return;
    }
    onSelected(selectedId);
  }

  /**
   * Submits the file edit request to the server (if form is valid) and
   * closes the modal on completion.
   */
  async function loadFrameworks() {
    try {
      setLoading(true);

      const res = await api.getFrameworks({});
      if (!res || res.data.err || !res.data.frameworks) {
        throw new Error("Failed to load frameworks");
      }

      setFrameworks(res.data.frameworks);
      setLoading(false);
    } catch (e) {
      handleGlobalError(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={show} onClose={onClose} {...rest}>
      <Modal.Header>Edit File</Modal.Header>
      <Modal.Content scrolling>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            handleSelectFramework();
          }}
          className="pb-20"
          loading={loading}
        >
          <Form.Field required={true}>
            <label>Select Framework</label>
            <Form.Select
              labeled={true}
              placeholder="Select Framework"
              onChange={(e, { value }) =>
                setSelectedId((value as string) || "")
              }
              options={frameworks.map((f) => {
                return { key: f.uuid, text: f.name, value: f.uuid };
              })}
              fluid
            />
          </Form.Field>
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          color="blue"
          onClick={() => handleSelectFramework()}
          loading={loading}
        >
          <Icon name="wrench" />
          Select Framework
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default SelectFramework;
