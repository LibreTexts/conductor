import { Button, Modal, Stack, Text } from "@libretexts/davis-react";
import type { AuthorshipRow } from "./util";

export type SubpageAuthorPlanItem = { row: AuthorshipRow; skip: boolean };

interface SubpageAuthorModalProps {
  pageTitle: string;
  /** Display name of the author being applied, or null when clearing. */
  authorLabel: string | null;
  plan: SubpageAuthorPlanItem[];
  onCancel: () => void;
  onThisPageOnly: () => void;
  onIncludeSubpages: (subpageIDs: string[]) => void;
}

/**
 * Shown after an author is chosen for the book or a page that has subpages. Offers to apply it
 * to the subpages too, skipping those that already have exactly this author.
 */
const SubpageAuthorModal = ({
  pageTitle,
  authorLabel,
  plan,
  onCancel,
  onThisPageOnly,
  onIncludeSubpages,
}: SubpageAuthorModalProps) => {
  const toApply = plan.filter((p) => !p.skip);
  const skippedCount = plan.length - toApply.length;
  const action = authorLabel ? (
    <>
      set <strong>{authorLabel}</strong> as the author of
    </>
  ) : (
    <>clear the author of</>
  );

  return (
    <Modal open onClose={onCancel} size="lg">
      <Modal.Header>
        <Modal.Title>Apply to Subpages?</Modal.Title>
        <Modal.Close aria-label="Close subpage author prompt" />
      </Modal.Header>
      <Modal.Body>
        <Stack direction="vertical" gap="sm">
          <Text size="sm">
            <strong>{pageTitle}</strong> has {plan.length} subpage{plan.length !== 1 ? "s" : ""}.
            Do you also want to {action} them?
          </Text>
          <Text size="sm" className="text-neutral-600">
            {toApply.length} subpage{toApply.length !== 1 ? "s" : ""} will be updated.{" "}
            {skippedCount > 0 &&
              `${skippedCount} already ${skippedCount === 1 ? "has" : "have"} this author and will be skipped.`}
          </Text>
          <ul className="max-h-64 overflow-y-auto rounded border border-gray-200 p-2 text-sm">
            {plan.map(({ row, skip }) => (
              <li
                key={row.id}
                className={skip ? "text-gray-400" : undefined}
                style={{ paddingLeft: `${row.depth * 12}px` }}
              >
                {row.title}
                {skip && " (unchanged)"}
              </li>
            ))}
          </ul>
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={onThisPageOnly}>
          This Page Only
        </Button>
        <Button
          variant="primary"
          disabled={toApply.length === 0}
          onClick={() => onIncludeSubpages(toApply.map((p) => p.row.id))}
        >
          {`Include ${toApply.length} Subpage${toApply.length !== 1 ? "s" : ""}`}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default SubpageAuthorModal;
