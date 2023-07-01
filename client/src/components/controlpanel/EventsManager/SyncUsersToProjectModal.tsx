import { Button, Dropdown, Icon, Modal, Grid, Form } from "semantic-ui-react";
import { useTypedSelector } from "../../../state/hooks";
import { isEmptyString } from "../../util/HelperFunctions";
import { useCallback, useEffect, useState } from "react";
import useGlobalError from "../../error/ErrorHooks";
import useDebounce from "../../../hooks/useDebounce";
import axios from "axios";
import { GenericKeyTextValueObj, Project } from "../../../types";

type SyncUsersToProjectModalProps = {
  show: boolean;
  selectedParticipants: string[];
  onClose: () => void;
  onConfirm: (projectID: string) => void;
};

const SyncUsersToProjectModal: React.FC<SyncUsersToProjectModalProps> = ({
  show,
  selectedParticipants,
  onClose,
  onConfirm,
  ...props
}) => {
  // Global State and Error Handling
  const user = useTypedSelector((state) => state.user);
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();

  const [loading, setLoading] = useState<boolean>(false);
  const [projectOpts, setProjectOpts] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [selectedProject, setSelectedProject] = useState<string>("");

  const getProjectOpts = async (searchQuery: string) => {
    try {
      setLoading(true);
      const res = await axios.get("/projects/all", {
        params: {
          uuid: user.uuid,
          searchQuery: searchQuery,
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
    } finally {
      setLoading(false);
    }
  };

  const getProjectOptionsDebounced = debounce(
    (inputVal: string) => getProjectOpts(inputVal),
    250
  );

  // Clear state when modal closes
  useEffect(() => {
    if (!show) {
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
    onConfirm(selectedProject);
    setLoading(false);
  }

  return (
    <Modal size="large" open={show} onClose={onClose} {...props}>
      <Modal.Header>Sync Users to Project</Modal.Header>
      <Modal.Content scrolling style={{ minHeight: "30vh" }}>
        <Form noValidate>
          <Form.Group widths="equal">
            <Form.Select
              search
              label="Select Project"
              placeholder="Start typing to search by title..."
              options={projectOpts}
              onChange={(_e, { value }) => {
                setSelectedProject(value ? value.toString() : "");
              }}
              onSearchChange={(_e, { searchQuery }) => {
                if (searchQuery) {
                  getProjectOptionsDebounced(searchQuery);
                }
              }}
              loading={loading}
              disabled={loading}
              required
            />
          </Form.Group>
        </Form>
        <p>
          <strong>Note:</strong> Only participants with that can be matched to a
          Conductor account will be added to the project. All participants will
          be added with the <strong>Project Member</strong> role. Participants
          who were previously synced will not be duplicated.
        </p>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => handleConfirm()} color="green">
          <Icon name="refresh" />
          Confirm Sync
        </Button>

        <Button onClick={onClose} color="grey">
          Go Back
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default SyncUsersToProjectModal;
