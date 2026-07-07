import { Button, Modal, Stack, Text } from "@libretexts/davis-react";
import React from "react";
import type { LicenseComplianceResult } from "./util";
import { formatLicenseRole } from "./util";
import { getLicenseText } from "../../util/LicenseOptions";
import { parseLicenseVersion } from "./util";

interface LicenseWarningModalProps {
  open: boolean;
  field: "book" | "page";
  pageTitle?: string;
  proposedLicense: string;
  proposedVersion?: string;
  compliance: LicenseComplianceResult | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const LicenseWarningModal: React.FC<LicenseWarningModalProps> = ({
  open,
  field,
  pageTitle,
  proposedLicense,
  proposedVersion,
  compliance,
  loading,
  onCancel,
  onConfirm,
}) => {
  const displayVersion = proposedVersion
    ? parseLicenseVersion(proposedVersion) ?? proposedVersion
    : undefined;
  const proposedLabel = getLicenseText(proposedLicense, displayVersion ?? "");
  const incompatiblePairs = compliance?.incompatiblePairs ?? [];

  return (
    <Modal open={open} onClose={onCancel} size="md">
      <Modal.Header>
        <Modal.Title>License Compatibility Warning</Modal.Title>
        <Modal.Close aria-label="Close warning" />
      </Modal.Header>
      <Modal.Body>
        <Stack direction="vertical" gap="sm">
          {pageTitle && (
            <Text size="sm" weight="semibold">
              Page: {pageTitle}
            </Text>
          )}
          <Text size="sm">
            The proposed {field === "book" ? "book" : "page"} license{" "}
            <strong>{proposedLabel}</strong> is incompatible with:
          </Text>
          <ul className="space-y-2 text-sm">
            {incompatiblePairs.map((pair, index) => {
              const changedRole = field === "book" ? "book" : "page";
              const otherRole =
                pair.licenseA.role === changedRole
                  ? pair.licenseB.role
                  : pair.licenseA.role;
              const otherKey =
                pair.licenseA.role === changedRole
                  ? pair.licenseB.key
                  : pair.licenseA.key;

              return (
                <li
                  key={`${pair.licenseA.role}-${pair.licenseB.role}-${index}`}
                  className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-900"
                >
                  {formatLicenseRole(otherRole)} ({otherKey})
                </li>
              );
            })}
          </ul>
          <Text size="sm" className="text-neutral-600">
            Applying this change may create a license conflict on this page.
            Do you want to continue?
          </Text>
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm} loading={loading}>
          Apply Anyway
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default LicenseWarningModal;
