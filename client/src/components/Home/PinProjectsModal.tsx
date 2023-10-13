import axios from "axios";
import { useCallback, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Divider,
  Form,
  Icon,
  List,
  Loader,
  Modal,
  ModalProps,
} from "semantic-ui-react";
import { pinProject } from "../../utils/projectHelpers";
import { GenericKeyTextValueObj, Project } from "../../types";
import useGlobalError from "../error/ErrorHooks";

interface PinProjectsModalProps extends ModalProps {
  show: boolean;
  pinnedProjects: Project[];
  onDataChange: () => void;
  onClose: () => void;
}

const PinProjectsModal: React.FC<PinProjectsModalProps> = ({
  show,
  pinnedProjects,
  onDataChange,
  onClose,
  rest,
}) => {
  //Global State & Error Handling
  const { handleGlobalError } = useGlobalError();

  //Data & UI
  const [loading, setLoading] = useState<boolean>(false);
  const [projectToPin, setProjectToPin] = useState<string>("");
  const [projectsOptions, setProjectsOptions] = useState<
    GenericKeyTextValueObj<"string">[]
  >([]);

  // Effects & Callbacks
  useEffect(() => {
    if (show) {
      getPinnableProjects();
    }
  }, [show]);

  /**
   * Loads the user's projects from the server, then filters already-pinned projects before
   * saving the list to state.
   */
  const getPinnableProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get("/projects/all");
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      if (!Array.isArray(res.data.projects)) {
        throw new Error("Invalid response from server.");
      }
      const pinnedFiltered = res.data.projects
        .filter((item: Project) => {
          const foundMatch = pinnedProjects.find((pinned) => {
            return pinned.projectID === item.projectID;
          });
          if (foundMatch) {
            return false;
          }
          return true;
        })
        .sort((a: Project, b: Project) => {
          let normalA = String(a.title)
            .toLowerCase()
            .replace(/[^A-Za-z]+/g, "");
          let normalB = String(b.title)
            .toLowerCase()
            .replace(/[^A-Za-z]+/g, "");
          if (normalA < normalB) return -1;
          if (normalA > normalB) return 1;
          return 0;
        })
        .map((item: Project) => {
          return {
            key: item.projectID,
            value: item.projectID,
            text: item.title,
          };
        });
      setProjectsOptions(pinnedFiltered);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }, [pinnedProjects, setLoading, setProjectsOptions, handleGlobalError]);

  /**
   * Wraps the project pinning function for use in the Edit Pinned Projects modal. Project
   * selection in the modal is reset if the operation was successful.
   *
   * @see {@link pinProject}
   */
  async function pinProjectInModal() {
    if (!projectToPin) return;
    setLoading(true);
    const didPin = await pinProject(projectToPin);
    if (!didPin) {
      handleGlobalError(new Error("Failed to pin project."));
    }
    setProjectToPin("");
    setProjectsOptions([]);
    onDataChange();
    setLoading(false);
  }

  /**
   * Submits a request to the server to unpin a project, then refreshes the pinned list.
   * For use inside the Edit Pinned Projects modal.
   *
   * @param {string} projectID - The identifier of the project to unpin.
   */
  async function unpinProject(projectID: string) {
    try {
      if (!projectID) return;
      setLoading(true);
      const res = await axios.delete("/project/pin", {
        data: {
          projectID,
        },
      });
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
      onDataChange();
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={show} onClose={() => onClose()} size="fullscreen" {...rest}>
      <Modal.Header>Edit Pinned Projects</Modal.Header>
      <Modal.Content scrolling id="edit-pinned-projects-content">
        <Form noValidate>
          <Form.Select
            search
            label="Select from your Projects"
            placeholder="Choose or start typing to search..."
            options={projectsOptions}
            onChange={(_e, { value }) => setProjectToPin(value as string)}
            value={projectToPin}
            loading={loading}
            disabled={loading}
          />
          <Button
            fluid
            disabled={!projectToPin}
            color="blue"
            loading={loading}
            onClick={pinProjectInModal}
          >
            <Icon name="pin" />
            Pin Project
          </Button>
        </Form>
        <Divider />
        {loading ? (
          <Loader active inline="centered" />
        ) : pinnedProjects.length > 0 ? (
          <List divided verticalAlign="middle" className="mb-2p">
            {pinnedProjects.map((item) => {
              return (
                <List.Item key={item.projectID}>
                  <div className="flex-row-div">
                    <div className="left-flex">
                      <Link to={`/projects/${item.projectID}`} target="_blank">
                        {item.title}
                      </Link>
                      <Icon name="external" className="ml-1p" />
                    </div>
                    <div className="right-flex">
                      <Button onClick={() => unpinProject(item.projectID)}>
                        <Icon.Group className="icon">
                          <Icon name="pin" />
                          <Icon corner name="x" />
                        </Icon.Group>
                        Unpin
                      </Button>
                    </div>
                  </div>
                </List.Item>
              );
            })}
          </List>
        ) : (
          <p className="text-center muted-text">No pinned projects yet.</p>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => onClose()} color="blue">
          Done
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default PinProjectsModal;
