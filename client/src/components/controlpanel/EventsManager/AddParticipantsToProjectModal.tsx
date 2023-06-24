import { Button, Dropdown, Icon, Modal, Grid, Form } from "semantic-ui-react";
import { useTypedSelector } from "../../../state/hooks";
import { isEmptyString } from "../../util/HelperFunctions";
import { useCallback, useEffect, useState } from "react";
import useGlobalError from "../../error/ErrorHooks";
import axios from "axios";
import { GenericKeyTextValueObj, Project } from "../../../types";

type AddParticipantsToProjectModalProps = {
  show: boolean;
  selectedParticipants: string[];
  onClose: () => void;
  onConfirm: (participantIds: string[], projectID: string) => void;
};

const AddParticipantsToProjectModal: React.FC<
  AddParticipantsToProjectModalProps
> = ({ show, selectedParticipants, onClose, onConfirm, ...props }) => {
  // Global State and Error Handling
  const org = useTypedSelector((state) => state.org);
  const user = useTypedSelector((state) => state.user);
  const { handleGlobalError } = useGlobalError();

  const [loading, setLoading] = useState<boolean>(false);
  const [projectOpts, setProjectOpts] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [selectedProject, setSelectedProject] = useState<string>("");

  const getProjectOpts = useCallback(async () => {
    try {
      const res = await axios.get("/user/projects", {
        params: {
          uuid: user.uuid,
        },
      });
      
      if (
        res.data.err ||
        !res.data.projects ||
        !Array.isArray(res.data.projects)
      ) {
        handleGlobalError(res.data.errMsg);
        return;
      }

      setProjectOpts(
        res.data.projects.map((p: Project) => ({
          key: p.projectID,
          text: p.title,
          value: p.projectID.toString(),
        }))
      );
    } catch (err) {
      handleGlobalError(err);
    }
  }, [org, show]);

  // Fetch project options when modal is opened, clear state when closed
  useEffect(() => {
    if (show) {
      getProjectOpts();
    } else {
      setProjectOpts([]);
      setSelectedProject("");
    }
  }, [show]);

  function handleConfirm() {
    if (!selectedProject || isEmptyString(selectedProject)) {
      handleGlobalError("Please select a project to add participants to.");
      return;
    }

    setLoading(true);
    onConfirm(selectedParticipants, selectedProject);
    setLoading(false);
  }

  return (
    <Modal size="large" open={show} onClose={onClose} {...props}>
      <Modal.Header>Add Selected Participants(s) to Project</Modal.Header>
      <Modal.Content scrolling style={{ minHeight: "40vh" }}>
        <Form noValidate>
          <Form.Group widths="equal">
            <Form.Field required>
              <label htmlFor="project-dropdown">Select Project</label>
              <Dropdown
                placeholder="Select Project..."
                selection
                options={projectOpts}
                onChange={(_e, { value }) =>
                  setSelectedProject(value ? value.toString() : "")
                }
              />
            </Form.Field>
          </Form.Group>
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => handleConfirm()} color="green">
          <Icon name="user plus" />
          Add to Project
        </Button>

        <Button onClick={onClose} color="grey">
          Go Back
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default AddParticipantsToProjectModal;
