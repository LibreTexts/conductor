import { Modal, Dropdown, Button, Icon, TextArea } from "semantic-ui-react";
import { Project } from "../../types";

interface FlagProjectModalProps {
  show: boolean;
  project: Project;
  flagMode: "set" | "clear";
  flagOption: string;
  flagDescrip: string;
  flagLoading: boolean;
  flagOptionErr: boolean;
  setFlagOption: (value: string) => void;
  setFlagDescrip: (value: string) => void;
  onRequestSave: () => void;
  onClose: () => void;
}

const FlagProjectModal: React.FC<FlagProjectModalProps> = ({
  show,
  project,
  flagMode,
  flagOption,
  flagDescrip,
  flagLoading,
  flagOptionErr,
  setFlagOption,
  setFlagDescrip,
  onRequestSave,
  onClose,
}) => {
  return (
    <Modal open={show} onClose={onClose}>
      <Modal.Header>
        {flagMode === "set" ? "Flag Project" : "Clear Project Flag"}
      </Modal.Header>
      <Modal.Content scrolling>
        {flagMode === "set" ? (
          <div>
            <p>
              Flagging a project sends an email notification to the selected
              user and places it in their Flagged Projects list for review.
              Please place a description of the reason for flagging in the text
              box below.
            </p>
            <Dropdown
              placeholder="Flag Option..."
              fluid
              selection
              options={[
                {
                  key: "libretexts",
                  text: "LibreTexts Administrators",
                  value: "libretexts",
                },
                {
                  key: "campusadmin",
                  text: "Campus Administrator",
                  value: "campusadmin",
                },
                {
                  key: "liaison",
                  text: "Project Liaison(s)",
                  value: "liaison",
                  disabled:
                    !project.liaisons ||
                    (Array.isArray(project.liaisons) &&
                      project.liaisons.length === 0),
                },
                {
                  key: "lead",
                  text: "Project Lead(s)",
                  value: "lead",
                },
              ]}
              value={flagOption}
              onChange={(e, { value }) =>
                setFlagOption(value?.toString() ?? "")
              }
              error={flagOptionErr}
              className="mb-2p"
            />
            <TextArea
              placeholder="Describe the reason for flagging..."
              value={flagDescrip}
              onChange={(value, data) =>
                setFlagDescrip(data.value?.toString() ?? "")
              }
            />
          </div>
        ) : (
          <p>Are you sure you want to clear this project's flag?</p>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="orange" loading={flagLoading} onClick={onRequestSave}>
          {flagMode === "set" ? <Icon name="attention" /> : <Icon name="x" />}
          {flagMode === "set" ? "Flag Project" : "Clear Flag"}
        </Button>
      </Modal.Actions>
    </Modal>
  );
};

export default FlagProjectModal;
