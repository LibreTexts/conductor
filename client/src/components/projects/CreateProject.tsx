import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import { Button, Form, Icon, Modal } from "semantic-ui-react";
import { visibilityOptions } from "../util/ProjectHelpers";
import useGlobalError from "../error/ErrorHooks";
import { useTypedSelector } from "../../state/hooks";

interface CreateProjectProps {
  show: boolean;
  onClose: () => void;
}

/**
 * Modal tool to create a new Project.
 */
const CreateProject: React.FC<CreateProjectProps> = ({ show, onClose }) => {
  // Global state and error handling
  const { handleGlobalError } = useGlobalError();
  const history = useHistory();
  const org = useTypedSelector((state) => state.org);

  // Form Data
  const [projTitle, setProjTitle] = useState("");
  const [projVis, setProjVis] = useState("private");

  // Form State
  const [loading, setLoading] = useState(false);
  const [titleErr, setTitleErr] = useState(false);

  /**
   * Resets any active error states in the form.
   */
  function resetFormErrors() {
    setTitleErr(false);
  }

  /**
   * Validates the form's inputs and sets error states if necessary.
   *
   * @returns {boolean} True if all inputs valid, false otherwise.
   */
  function validateForm() {
    let valid = true;
    if (!projTitle || projTitle.length < 1) {
      valid = false;
      setTitleErr(true);
    }
    return valid;
  }

  /**
   * Submits the new Project request the the server (if form is valid), then redirects to the new
   * Project View if successful.
   */
  async function createProject() {
    resetFormErrors();
    if (validateForm()) {
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
          history.push(
            `/projects/${createRes.data.projectID}?projectCreated=true`
          );
        } else {
          history.push(`/projects?projectCreated=true`);
        }
      } catch (e) {
        setLoading(false);
        handleGlobalError(e);
      }
    }
  }

  return (
    <Modal size="large" open={show} onClose={onClose}>
      <Modal.Header>Create Project</Modal.Header>
      <Modal.Content>
        <p>
          This project will be created within <strong>{org.name}</strong>. You
          can add tags, collaborators, and more after creation.
        </p>
        <Form noValidate onSubmit={createProject}>
          <Form.Input
            fluid
            label="Project Title"
            placeholder="Enter the project title..."
            required
            type="text"
            value={projTitle}
            onChange={(e) => setProjTitle(e.target.value)}
            error={titleErr}
          />
          <Form.Select
            fluid
            label="Project Visibility"
            placeholder="Visibility..."
            options={visibilityOptions}
            onChange={(e, { value }) => setProjVis(value as string)}
            value={projVis}
          />
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="green" onClick={createProject} loading={loading}>
          <Icon name="plus" />
          Create Project
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default CreateProject;
