import { Button, Dropdown, Icon, Modal, Grid, Form } from "semantic-ui-react";
import { useTypedSelector } from "../../../state/hooks";
import { isEmptyString } from "../../util/HelperFunctions";
import { useCallback, useEffect, useState } from "react";
import useGlobalError from "../../error/ErrorHooks";
import useDebounce from "../../../hooks/useDebounce";
import axios from "axios";
import { GenericKeyTextValueObj, OrgEvent, Project } from "../../../types";

type AutoSyncToProjectModalProps = {
  show: boolean;
  orgEvent: OrgEvent;
  onClose: () => void;
  onConfirm: (projectID: string) => void;
};

const AutoSyncToProjectModal: React.FC<AutoSyncToProjectModalProps> = ({
  show,
  orgEvent,
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
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

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

  async function getCurrentProjectInfo() {
    try {
      if (!orgEvent.projectSyncID) return;
      setLoading(true);
      const res = await axios.get("/project/", {
        params: { projectID: orgEvent.projectSyncID },
      });

      if (res.data.err || !res.data.project) {
        handleGlobalError(res.data.errMsg);
        return;
      }

      setCurrentProject(res.data.project);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  // Clear state when modal closes
  useEffect(() => {
    if (show) {
      getCurrentProjectInfo();
    }
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
      <Modal.Header>Configure Auto-Sync Users to Project</Modal.Header>
      <Modal.Content scrolling style={{ minHeight: "30vh" }}>
        <Form noValidate>
          {currentProject && (
            <p className="mb-2p">
              <strong>Current Auto-Sync Project: </strong>
              {currentProject
                ? `${currentProject.title} (${currentProject.projectID})`
                : ""}
            </p>
          )}
          <Form.Group widths="equal">
            <Form.Select
              search
              label={
                orgEvent.projectSyncID ? "Select New Project" : "Select Project"
              }
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
          <strong>Note:</strong> Only participants with emails that can be
          matched to a Conductor account will be added to the project. All
          participants will be added with the <strong>Project Member</strong>{" "}
          role. Existing participants will be synced upon submission of this
          form. Future participants will be synced automatically. If a
          participant cancels their registration, they <strong>will not</strong>{" "}
          automatically be removed from the project.
        </p>
        <p></p>
      </Modal.Content>
      <Modal.Actions>
        {selectedProject && (
          <Button onClick={() => handleConfirm()} color="green">
            <Icon name="refresh" />
            Confirm Sync Settings
          </Button>
        )}
        <Button onClick={onClose} color="grey">
          Cancel
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default AutoSyncToProjectModal;
