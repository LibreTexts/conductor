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
          {pageTitle && field !== "book" && (
            <Text size="sm" weight="semibold">
              Page: {pageTitle}
            </Text>
          )}
          <Text size="sm">
            The proposed {field === "book" ? "book" : "page"} license{" "}
            <strong>{proposedLabel}</strong> is incompatible with:
          </Text>
          <ul className="max-h-[40vh] space-y-2 overflow-y-auto text-sm">
            {incompatiblePairs.map((pair, index) => {
              const changedRole = field === "book" ? "book" : "page";
              const other =
                pair.licenseAdption.role === changedRole
                  ? pair.licenseOrigin
                  : pair.licenseAdption;
              const otherLabel = getLicenseText(
                other.key,
                other.version ?? "",
              );
              const pageLabel =
                field === "book" && pair.licenseOrigin.pageTitle
                  ? pair.licenseOrigin.pageTitle
                  : formatLicenseRole(other.role);

              return (
                <li
                  key={`${pair.licenseAdption.role}-${pair.licenseOrigin.role}-${pair.licenseOrigin.pageTitle ?? ""}-${index}`}
                  className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-900"
                >
                  {field === "book" ? (
                    <>
                      <span className="font-medium">{pageLabel}</span>
                      {": "}
                      {otherLabel}
                    </>
                  ) : (
                    <>
                      {formatLicenseRole(other.role)}: {otherLabel}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <Text size="sm" className="text-neutral-600">
            {field === "book"
              ? "The book license is treated as adapting these pages' original licenses. Applying this change may create conflicts across the book. Do you want to continue?"
              : "Applying this change may create a license conflict on this page. Do you want to continue?"}
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
