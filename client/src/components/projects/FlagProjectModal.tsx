import { Button, Modal, Select, Textarea } from "@libretexts/davis-react";
import { IconAlertCircle, IconX } from "@tabler/icons-react";
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
  const hasLiaisons =
    Array.isArray(project.liaisons) && project.liaisons.length > 0;

  const flagOptions = [
    { value: "libretexts", label: "LibreTexts Administrators" },
    { value: "campusadmin", label: "Campus Administrator" },
    ...(hasLiaisons ? [{ value: "liaison", label: "Project Liaison(s)" }] : []),
    { value: "lead", label: "Project Lead(s)" },
  ];

  return (
    <Modal open={show} onClose={(v) => { if (!v) onClose(); }}>
      <Modal.Header>
        <Modal.Title>
          {flagMode === "set" ? "Flag Project" : "Clear Project Flag"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {flagMode === "set" ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-700">
              Flagging a project sends an email notification to the selected
              user and places it in their Flagged Projects list for review.
              Please place a description of the reason for flagging in the text
              box below.
            </p>
            <Select
              name="flag-option"
              label="Flag Option"
              placeholder="Flag Option..."
              options={flagOptions}
              value={flagOption}
              onChange={(e) => setFlagOption(e.target.value)}
              error={flagOptionErr}
            />
            <Textarea
              name="flag-description"
              label="Reason for Flagging"
              placeholder="Describe the reason for flagging..."
              value={flagDescrip}
              onChange={(e) => setFlagDescrip(e.target.value)}
              rows={5}
            />
          </div>
        ) : (
          <p className="text-sm text-gray-700">
            Are you sure you want to clear this project&apos;s flag?
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={flagLoading}
            onClick={onRequestSave}
          >
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              {flagMode === "set" ? <IconAlertCircle size={15} /> : <IconX size={15} />}
              {flagMode === "set" ? "Flag Project" : "Clear Flag"}
            </span>
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default FlagProjectModal;
