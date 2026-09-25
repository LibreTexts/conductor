import { Button, Modal, Stack, Text } from "@libretexts/davis-react";
import React from "react";
import { getLicenseText } from "../../util/LicenseOptions";
import {
  BulkLicensePreviewTable,
  type BulkLicensePlanItem,
} from "./BulkLicenseModal";
import { parseLicenseVersion } from "./util";

interface SubpageLicenseModalProps {
  pageTitle: string;
  license: string;
  version?: string;
  /** Every page below the edited page, with its skip decision. */
  plan: BulkLicensePlanItem[];
  onCancel: () => void;
  onThisPageOnly: () => void;
  onIncludeSubpages: (subpageIDs: string[]) => void;
}

/**
 * Shown after a page license is chosen when that page has subpages. Offers to
 * cascade the license down, skipping subpages whose Source or Content licenses conflict.
 */
const SubpageLicenseModal: React.FC<SubpageLicenseModalProps> = ({
  pageTitle,
  license,
  version,
  plan,
  onCancel,
  onThisPageOnly,
  onIncludeSubpages,
}) => {
  const displayVersion = version
    ? (parseLicenseVersion(version) ?? version)
    : undefined;
  const licenseLabel = getLicenseText(license, displayVersion ?? "");
  const toApply = plan.filter((p) => !p.skip);
  const skippedCount = plan.length - toApply.length;

  return (
    <Modal open onClose={onCancel} size="lg">
      <Modal.Header>
        <Modal.Title>Apply to Subpages?</Modal.Title>
        <Modal.Close aria-label="Close subpage license prompt" />
      </Modal.Header>
      <Modal.Body>
        <Stack direction="vertical" gap="sm">
          <Text size="sm">
            <strong>{pageTitle}</strong> has {plan.length} subpage
            {plan.length !== 1 ? "s" : ""}. Do you also want to apply{" "}
            <strong>{licenseLabel}</strong> to them?
          </Text>
          <Text size="sm" className="text-neutral-600">
            {toApply.length} subpage{toApply.length !== 1 ? "s" : ""} will be
            updated. {skippedCount} will be skipped because their Source or
            Content licenses are incompatible, or they already have this license.
          </Text>
          <BulkLicensePreviewTable plan={plan} showResult />
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

export default SubpageLicenseModal;
