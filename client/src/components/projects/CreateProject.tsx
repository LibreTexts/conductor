import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import { Button, Input, Modal, Select } from "@libretexts/davis-react";
import type { SelectOption } from "@libretexts/davis-react";
import { IconPlus } from "@tabler/icons-react";
import { visibilityOptions } from "../util/ProjectHelpers";
import useGlobalError from "../error/ErrorHooks";
import { useTypedSelector } from "../../state/hooks";

interface CreateProjectProps {
  show: boolean;
  onClose: () => void;
}

const visibilitySelectOptions: SelectOption[] = visibilityOptions.map((o) => ({
  value: o.value,
  label: o.text,
}));

const CreateProject: React.FC<CreateProjectProps> = ({ show, onClose }) => {
  const { handleGlobalError } = useGlobalError();
  const history = useHistory();
  const org = useTypedSelector((state) => state.org);

  const [projTitle, setProjTitle] = useState("");
  const [projVis, setProjVis] = useState("private");
  const [loading, setLoading] = useState(false);
  const [titleErr, setTitleErr] = useState(false);

  function resetFormErrors() {
    setTitleErr(false);
  }

  function validateForm() {
    let valid = true;
    if (!projTitle || projTitle.length < 1) {
      valid = false;
      setTitleErr(true);
    }
    return valid;
  }

  async function createProject() {
    resetFormErrors();
    if (!validateForm()) return;
    try {
      setLoading(true);
      const createRes = await axios.post("/project", {
        title: projTitle,
        visibility: projVis,
      });
      if (createRes.data.err) {
        throw new Error(createRes.data.errMsg);
      }
      if (createRes.data.projectID) {
        history.push(`/projects/${createRes.data.projectID}?projectCreated=true`);
      } else {
        history.push(`/projects?projectCreated=true`);
      }
    } catch (e) {
      setLoading(false);
      handleGlobalError(e);
    }
  }

  return (
    <Modal open={show} onClose={() => onClose()} size="lg">
      <Modal.Header>
        <Modal.Title>Create Project</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-gray-600 mb-4">
          This project will be created within <strong>{org.name}</strong>. You
          can add tags, collaborators, and more after creation.
        </p>
        <div className="space-y-4">
          <Input
            name="project-title"
            label="Project Title"
            placeholder="Enter the project title..."
            required
            value={projTitle}
            onChange={(e) => setProjTitle(e.target.value)}
            error={titleErr}
            errorMessage={titleErr ? "Project title is required." : undefined}
          />
          <Select
            name="project-visibility"
            label="Project Visibility"
            placeholder="Visibility..."
            options={visibilitySelectOptions}
            value={projVis}
            onChange={(e) => setProjVis(e.target.value)}
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={createProject}
          loading={loading}
          icon={<IconPlus size={16} />}
        >
          Create Project
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CreateProject;
