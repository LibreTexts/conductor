import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Modal,
  Radio,
  RadioGroup,
  Stack,
  Stepper,
  Text,
} from "@libretexts/davis-react";
import { SimilarAuthorCandidate, SimilarAuthorMatch } from "../../../types";

/** A typed name that resembles existing authors, waiting for the admin to say if it is one of them. */
export type SimilarPrompt = SimilarAuthorMatch & {
  rowId: number;
  /** "distinct" (a different person), or the nameKey of the existing author to use instead. */
  choice?: string;
};

/** What identifies a candidate as a radio choice. Some older authors have no key, so fall back to the id. */
export const candidateChoice = (c: SimilarAuthorCandidate) => c.nameKey ?? `id:${c._id}`;

interface SimilarAuthorsModalProps {
  open: boolean;
  prompts: SimilarPrompt[];
  /**
   * True when an existing author is being renamed. There is nothing to merge into then, so the
   * only decision is whether to save anyway.
   */
  renameOnly: boolean;
  loading: boolean;
  onChoose: (rowId: number, choice: string) => void;
  /** Every name has been answered. */
  onConfirm: () => void;
  /** Back out without saving. */
  onCancel: () => void;
}

/**
 * Asks "is this the same person?" for each typed name that resembles an existing author.
 * One name is a single question; several are walked through one at a time with a stepper.
 */
const SimilarAuthorsModal = ({
  open,
  prompts,
  renameOnly,
  loading,
  onChoose,
  onConfirm,
  onCancel,
}: SimilarAuthorsModalProps) => {
  const [step, setStep] = useState(0);

  // Start from the first question each time the dialog is opened.
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const prompt = prompts[Math.min(step, prompts.length - 1)];
  if (!prompt) return null;

  const isLast = step >= prompts.length - 1;
  const multiple = prompts.length > 1;

  return (
    <Modal open={open} onClose={onCancel} size="lg">
      <Modal.Header>
        <Modal.Title>Is this the same person?</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        <Stack gap="lg">
          {multiple && (
            <Stepper
              steps={prompts.map((p) => ({ label: p.input }))}
              currentStep={step}
              size="sm"
            />
          )}

          <Alert
            variant="warning"
            title={`“${prompt.input}” is similar to ${
              prompt.candidates.length === 1 ? "an existing author" : "existing authors"
            }`}
            message="Nothing has been saved yet."
          />

          {renameOnly && (
            <div>
              <Text size="sm" color="muted">
                Similar authors:
              </Text>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {prompt.candidates.map((c) => (
                  <li key={candidateChoice(c)}>
                    {c.name}{" "}
                    <span className="font-mono text-gray-500">({c.nameKey ?? "no key yet"})</span>
                    {c.campusName ? ` · ${c.campusName}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <RadioGroup
            // Remount per name so the previous step's selection can't carry over visually.
            key={prompt.rowId}
            name={`similar-${prompt.rowId}`}
            label={renameOnly ? "Is this a different person?" : "Is it one of these?"}
            value={prompt.choice ?? ""}
            onChange={(choice) => onChoose(prompt.rowId, choice)}
          >
            {!renameOnly &&
              prompt.candidates.map((c) => (
                <Radio
                  key={candidateChoice(c)}
                  value={candidateChoice(c)}
                  label={`Yes, use ${c.name}`}
                  description={
                    c.nameKey
                      ? [c.nameKey, c.campusName].filter(Boolean).join(" · ")
                      : `No key yet — a new key will be generated for this author${
                          c.campusName ? ` · ${c.campusName}` : ""
                        }`
                  }
                />
              ))}
            <Radio
              value="distinct"
              label={renameOnly ? "Yes, save anyway" : "No, this is a different person"}
            />
          </RadioGroup>
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-between items-center w-full">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Go back
          </Button>
          <div className="flex gap-2">
            {multiple && step > 0 && (
              <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={loading}>
                Previous
              </Button>
            )}
            {isLast ? (
              <Button
                variant="primary"
                onClick={onConfirm}
                loading={loading}
                disabled={prompts.some((p) => !p.choice)}
              >
                Continue
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => setStep(step + 1)}
                disabled={!prompt.choice}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default SimilarAuthorsModal;
