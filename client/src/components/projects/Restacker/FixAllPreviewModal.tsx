import { Button, Modal, Stack, Text } from "@libretexts/davis-react";
import React from "react";
import { getLicenseText } from "../../util/LicenseOptions";
import LicenseBadge from "./LicenseBadge";
import type { RestackerTocLicense } from "../../../types";
import { parseLicenseVersion, formatVersionDigits } from "./util";

export type FixAllEntry = {
  pageID: string;
  title: string;
  currentLicense?: RestackerTocLicense;
  license: string;
  version?: string;
  reason: string;
};

interface FixAllPreviewModalProps {
  open: boolean;
  entries: FixAllEntry[];
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function licenseLabel(key: string, version?: string): string {
  const displayVersion = version
    ? (parseLicenseVersion(version) ?? version)
    : undefined;
  return getLicenseText(key, displayVersion ?? "");
}

const FixAllPreviewModal: React.FC<FixAllPreviewModalProps> = ({
  open,
  entries,
  loading,
  onCancel,
  onConfirm,
}) => {
  return (
    <Modal open={open} onClose={onCancel} size="lg">
      <Modal.Header>
        <Modal.Title>Fix All — Preview Changes</Modal.Title>
        <Modal.Close aria-label="Close preview" />
      </Modal.Header>
      <Modal.Body>
        <Stack direction="vertical" gap="sm">
          <Text size="sm" className="text-neutral-600">
            The following {entries.length} page{entries.length !== 1 ? "s" : ""}{" "}
            will be updated. Review the changes and confirm to apply them all at
            once.
          </Text>
          <div className="max-h-[55vh] overflow-y-auto rounded border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left">
                <tr>
                  <th className="border-b border-gray-200 px-3 py-2 font-medium text-gray-700">
                    Page
                  </th>
                  <th className="border-b border-gray-200 px-3 py-2 font-medium text-gray-700">
                    Current
                  </th>
                  <th className="border-b border-gray-200 px-3 py-2 font-medium text-gray-700">
                    New
                  </th>
                  <th className="border-b border-gray-200 px-3 py-2 font-medium text-gray-700">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr
                    key={entry.pageID}
                    className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="border-b border-gray-100 px-3 py-2 break-words max-w-[220px]">
                      {entry.title}
                    </td>
                    <td className="border-b border-gray-100 px-3 py-2 whitespace-nowrap">
                      {entry.currentLicense?.label ? (
                        <LicenseBadge license={entry.currentLicense} />
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className="border-b border-gray-100 px-3 py-2 whitespace-nowrap">
                      <LicenseBadge
                        license={{
                          label: entry.license,
                          raw: entry.version ?? "",
                          version: entry.version
                            ? formatVersionDigits(entry.version)
                            : undefined,
                        }}
                      />
                    </td>
                    <td className="border-b border-gray-100 px-3 py-2 text-gray-500">
                      {entry.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm} loading={loading}>
          Apply All ({entries.length})
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default FixAllPreviewModal;
