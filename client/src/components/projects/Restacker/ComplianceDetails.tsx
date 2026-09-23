import { Alert, Button, Modal, Stack, Text } from "@libretexts/davis-react";
import React from "react";
import type { LicenseComplianceResult, MissingLicenseVersion } from "./util";
import { formatLicenseRole, getLicenseByRole } from "./util";
import { RestackerTocLicense } from "../../../types/Book";
import LicenseBadge from "./LicenseBadge";
import { getLicenseText } from "../../util/LicenseOptions";

const SUPPORT_CONTACT_URL = "/support/contact";

/** Book and page licenses can be fixed from the Restacker table; others live on other pages. */
const isEditableRole = (role: string) => role === "book" || role === "page";

function describeMissing(missing: MissingLicenseVersion[]): string {
  return missing
    .map((m) => `${formatLicenseRole(m.role)} (${getLicenseText(m.key)})`)
    .join(", ");
}

interface ComplianceDetailsProps {
  open: boolean;
  onClose: () => void;
  pageTitle?: string;
  compliance: LicenseComplianceResult | null;
  bookLicense?: RestackerTocLicense;
  pageLicense?: RestackerTocLicense;
  sourceLicense?: RestackerTocLicense;
  contentLicenses?: RestackerTocLicense[];
}

const ComplianceDetails: React.FC<ComplianceDetailsProps> = ({
  open,
  onClose,
  pageTitle,
  compliance,
  bookLicense,
  pageLicense,
  sourceLicense,
  contentLicenses,
}) => {
  const pairs = compliance?.pairs ?? [];
  const missingVersions = compliance?.missingVersions ?? [];
  const editableMissing = missingVersions.filter((m) => isEditableRole(m.role));
  const externalMissing = missingVersions.filter((m) => !isEditableRole(m.role));
  const licenseContext = {
    bookLicense,
    pageLicense,
    sourceLicense,
    contentLicenses,
  };

  return (
    <Modal open={open} onClose={() => onClose()}>
      <Modal.Header>
        <Modal.Title>Compliance Details</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        
        {pageTitle && (
          <p className="mb-3 text-sm font-semibold text-neutral-800">{pageTitle}</p>
        )}
        <Stack direction="vertical" gap="xs">
          <Text size="sm">
            Book License: <LicenseBadge license={bookLicense} />
          </Text>
          <Text size="sm">
            Page License: <LicenseBadge license={pageLicense} />
          </Text>
          <Text size="sm">
            Source License: <LicenseBadge license={sourceLicense} />
          </Text>
          {contentLicenses?.map((license, index) => (
            <Text key={`content-${index}`} size="sm">
              Content License {contentLicenses.length > 1 ? index + 1 : ""}:{" "}
              <LicenseBadge license={license} />
            </Text>
          ))}
        </Stack>
        {editableMissing.length > 0 && (
          <Alert
            variant="error"
            title="Missing license version"
            message={`${describeMissing(editableMissing)}: no version is set. Edit the license in the table and choose a version.`}
            showIcon
            className="my-3"
          />
        )}
        {externalMissing.length > 0 && (
          <Alert
            variant="warning"
            title="Missing license version in reused content"
            message={`${describeMissing(externalMissing)}: no version is set on the page this content comes from, so it can't be fixed here. Please consult LibreTexts Support to address it.`}
            showIcon
            className="my-3"
            action={{
              label: "Contact LibreTexts Support",
              onClick: () =>
                window.open(SUPPORT_CONTACT_URL, "_blank", "noopener,noreferrer"),
            }}
          />
        )}
        {pairs.length === 0 ? (
          <p className="text-sm text-neutral-600">
            No license pairs to compare for this page.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {pairs.map((pair, index) => {
              const labelA = formatLicenseRole(pair.licenseAdption.role);
              const labelB = formatLicenseRole(pair.licenseOrigin.role);
              const licenseA = getLicenseByRole(pair.licenseAdption.role, licenseContext);
              const licenseB = getLicenseByRole(pair.licenseOrigin.role, licenseContext);

              let statusText = "Unknown compatibility";
              let statusClass = "text-neutral-600";

              if (pair.compatible === true) {
                statusText = "Compatible";
                statusClass = "text-green-700";
              } else if (pair.compatible === false) {
                statusText = "Incompatible";
                statusClass = "text-red-700";
              }

              return (
                <li
                  key={`${pair.licenseAdption.role}-${pair.licenseOrigin.role}-${index}`}
                  className="rounded border border-neutral-200 px-3 py-2"
                >
                  <span className={statusClass}>{statusText}</span>
                  {": "}
                  <span className="font-medium">{labelA}</span>{" "}
                  <LicenseBadge license={licenseA} /> ↔{" "}
                  <span className="font-medium">{labelB}</span>{" "}
                  <LicenseBadge license={licenseB} />
                </li>
              );
            })}          </ul>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onClose}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ComplianceDetails;
