import { Modal, Button } from "@libretexts/davis-react";
import { IconRefresh } from "@tabler/icons-react";
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
}) => {
  const user = useTypedSelector((state) => state.user);
  const { handleGlobalError } = useGlobalError();
  const { debounce } = useDebounce();

  const [loading, setLoading] = useState<boolean>(false);
  const [projectOpts, setProjectOpts] = useState<GenericKeyTextValueObj<string>[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const getProjectOpts = async (query: string) => {
    try {
      setLoading(true);
      const res = await axios.get("/projects/all", {
        params: { uuid: user.uuid, searchQuery: query },
      });

      if (res.data.err || !res.data.projects || !Array.isArray(res.data.projects)) {
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

  useEffect(() => {
    if (show) {
      getCurrentProjectInfo();
    }
    if (!show) {
      setProjectOpts([]);
      setSelectedProject("");
      setSearchQuery("");
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
    <Modal open={show} onClose={onClose} size="lg">
      <Modal.Header>
        <Modal.Title>Configure Auto-Sync Users to Project</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body className="overflow-y-auto min-h-[30vh]">
        <div className="flex flex-col gap-4">
          {currentProject && (
            <p className="text-sm">
              <strong>Current Auto-Sync Project: </strong>
              <a
                href={`/projects/${currentProject.projectID}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {currentProject.title}
              </a>
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {orgEvent.projectSyncID ? "Select New Project" : "Select Project"}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              placeholder="Start typing to search by title..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                getProjectOptionsDebounced(e.target.value);
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={loading}
            />
            {projectOpts.length > 0 && (
              <div className="border border-gray-200 rounded mt-1 max-h-48 overflow-y-auto divide-y divide-gray-100">
                {projectOpts.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                      selectedProject === opt.value ? "bg-blue-50 font-medium" : ""
                    }`}
                    onClick={() => {
                      setSelectedProject(opt.value ?? "");
                      setSearchQuery(opt.text ?? "");
                      setProjectOpts([]);
                    }}
                  >
                    {opt.text}
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="text-sm text-gray-600">
            <strong>Note:</strong> Only participants with emails that can be
            matched to a Conductor account will be added to the project. All
            participants will be added with the <strong>Project Member</strong>{" "}
            role. Existing participants will be synced upon submission of this
            form. Future participants will be synced automatically. If a
            participant cancels their registration, they <strong>will not</strong>{" "}
            automatically be removed from the project.
          </p>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {selectedProject && (
            <Button
              variant="primary"
              icon={<IconRefresh size={16} />}
              loading={loading}
              onClick={handleConfirm}
            >
              Confirm Sync Settings
            </Button>
          )}
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default AutoSyncToProjectModal;
