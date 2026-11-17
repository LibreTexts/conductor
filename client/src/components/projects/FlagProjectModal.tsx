import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Modal, Select, Textarea } from "@libretexts/davis-react";
import { IconAlertCircle, IconX } from "@tabler/icons-react";
import api from "../../api";
import useProject from "../../hooks/useProject";
import useGlobalError from "../error/ErrorHooks";

interface FlagProjectModalProps {
  projectID: string;
  mode: "set" | "clear";
  onClose: () => void;
}

const MAX_DESCRIPTION_LENGTH = 2000;

const FlagProjectModal: React.FC<FlagProjectModalProps> = ({ projectID, mode, onClose }) => {
  const queryClient = useQueryClient();
  const { handleGlobalError } = useGlobalError();
  const { project, useProjectQueryKey } = useProject(projectID);

  const [flagOption, setFlagOption] = useState("");
  const [flagDescrip, setFlagDescrip] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const optionError = flagOption === "";
  const descripError = flagDescrip.length > MAX_DESCRIPTION_LENGTH;

  const flagMutation = useMutation({
    mutationFn: async () => {
      const res =
        mode === "set"
          ? await api.flagProject(projectID, flagOption, flagDescrip.trim() || undefined)
          : await api.clearProjectFlag(projectID);
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(useProjectQueryKey);
      onClose();
    },
    onError: (err) => handleGlobalError(err),
  });

  const handleSave = () => {
    if (mode === "set" && (optionError || descripError)) {
      setShowErrors(true);
      return;
    }
    flagMutation.mutate();
  };

  const hasLiaisons = Array.isArray(project?.liaisons) && project.liaisons.length > 0;
  const flagOptions = [
    { value: "libretexts", label: "LibreTexts Administrators" },
    { value: "campusadmin", label: "Campus Administrator" },
    ...(hasLiaisons ? [{ value: "liaison", label: "Project Liaison(s)" }] : []),
    { value: "lead", label: "Project Lead(s)" },
  ];

  return (
    <Modal open onClose={() => onClose()}>
      <Modal.Header>
        <Modal.Title>{mode === "set" ? "Flag Project" : "Clear Project Flag"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {mode === "set" ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-700">
              Flagging a project sends an email notification to the selected user and places it in
              their Flagged Projects list for review. Please place a description of the reason for
              flagging in the text box below.
            </p>
            <Select
              name="flag-option"
              label="Flag Option"
              placeholder="Flag Option..."
              required
              options={flagOptions}
              value={flagOption}
              onChange={(e) => setFlagOption(e.target.value)}
              error={showErrors && optionError}
              errorMessage={showErrors && optionError ? "Select who to notify." : undefined}
            />
            <Textarea
              name="flag-description"
              label="Reason for Flagging"
              placeholder="Describe the reason for flagging..."
              value={flagDescrip}
              onChange={(e) => setFlagDescrip(e.target.value)}
              rows={5}
              error={showErrors && descripError}
              errorMessage={
                showErrors && descripError
                  ? `Keep the reason under ${MAX_DESCRIPTION_LENGTH} characters.`
                  : undefined
              }
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
          <Button variant="destructive" loading={flagMutation.isLoading} onClick={handleSave}>
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              {mode === "set" ? <IconAlertCircle size={15} /> : <IconX size={15} />}
              {mode === "set" ? "Flag Project" : "Clear Flag"}
            </span>
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default FlagProjectModal;
