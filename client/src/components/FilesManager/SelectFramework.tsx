import React, { useState, useEffect } from "react";
import { Button, Modal, Select } from "@libretexts/davis-react";
import { IconTool } from "@tabler/icons-react";
import useGlobalError from "../error/ErrorHooks";
import { AssetTagFramework } from "../../types";
import api from "../../api";
import LoadingSpinner from "../LoadingSpinner";

interface SelectFrameworkProps {
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
    <Modal open={show} onClose={() => onClose()} size="xl">
      <Modal.Header>
        <Modal.Title>Edit File</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {loading && <LoadingSpinner />}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSelectFramework();
          }}
          className="pb-20"
        >
          <Select
            name="framework"
            label="Select Framework"
            placeholder="Select Framework"
            required
            onChange={(e) => setSelectedId(e.target.value)}
            options={frameworks.map((f) => ({
              label: f.name,
              value: f.uuid,
            }))}
            value={selectedId}
          />
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => handleSelectFramework()}
          loading={loading}
          icon={<IconTool size={16} />}
        >
          Select Framework
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default SelectFramework;
