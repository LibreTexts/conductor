import { Button, Checkbox, Modal, Select, Stack, Text } from "@libretexts/davis-react";
import React, { useEffect, useMemo, useState } from "react";
import {
  getLicenseText,
  getLicenseVersionOptions,
  getValidLicenseVersion,
  licenseOptions,
} from "../../util/LicenseOptions";
import LicenseBadge from "./LicenseBadge";
import type { RestackerTocLicense } from "../../../types";
import {
  expandWithDescendants,
  formatLicenseRole,
  getBulkLicenseSkip,
  type BulkLicenseSkipReason,
  type LicensePairCompliance,
} from "./util";

export type BulkLicenseRow = {
  id: string;
  title: string;
  url?: string;
  depth: number;
  pageLicense?: RestackerTocLicense;
  sourceLicense?: RestackerTocLicense;
  contentLicenses?: RestackerTocLicense[];
};

interface BulkLicenseModalProps {
  open: boolean;
  /** Depth-first flattened TOC rows. */
  rows: BulkLicenseRow[];
  selectedIds: Set<string>;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (pageIDs: string[], license: string, version?: string) => void;
}

const SKIP_REASON_TEXT: Record<BulkLicenseSkipReason, string> = {
  structural: "Structural page must stay Public Domain",
  unchanged: "Already has this license",
  conflict: "Incompatible with",
};

function describeConflicts(conflicts: LicensePairCompliance[]): string {
  return conflicts
    .map((pair) => {
      const other =
        pair.licenseAdption.role === "page"
          ? pair.licenseOrigin
          : pair.licenseAdption;
      return `${formatLicenseRole(other.role)} (${getLicenseText(other.key, other.version ?? "")})`;
    })
    .join(", ");
}

// Clearing licenses in bulk is too easy to do by accident, so it isn't offered here.
const BULK_LICENSE_OPTIONS = licenseOptions
  .filter((option: { value: string }) => option.value !== "")
  .map((option: { value: string; text: string }) => ({
    value: option.value,
    label: option.text,
  }));

export type BulkLicensePlanItem = {
  row: BulkLicenseRow;
  skip: ReturnType<typeof getBulkLicenseSkip>;
};

/** Per-page preview of a bulk license change: which pages update and which are skipped. */
export const BulkLicensePreviewTable: React.FC<{
  plan: BulkLicensePlanItem[];
  /** False until a license is chosen; the Result column then shows a placeholder. */
  showResult: boolean;
}> = ({ plan, showResult }) => (
  <div className="max-h-[45vh] overflow-y-auto rounded border border-gray-200">
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">Pages affected by the license change</caption>
      <thead className="sticky top-0 bg-gray-50 text-left">
        <tr>
          <th scope="col" className="border-b border-gray-200 px-3 py-2 font-medium text-gray-700">
            Page
          </th>
          <th scope="col" className="border-b border-gray-200 px-3 py-2 font-medium text-gray-700">
            Current
          </th>
          <th scope="col" className="border-b border-gray-200 px-3 py-2 font-medium text-gray-700">
            Result
          </th>
        </tr>
      </thead>
      <tbody>
        {plan.map(({ row, skip }, i) => (
          <tr
            key={row.id}
            className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
          >
            <td
              className="border-b border-gray-100 px-3 py-2 break-words max-w-[260px]"
              style={{ paddingLeft: 12 + row.depth * 12 }}
            >
              {row.title}
            </td>
            <td className="border-b border-gray-100 px-3 py-2 whitespace-nowrap">
              <LicenseBadge license={row.pageLicense} />
            </td>
            <td className="border-b border-gray-100 px-3 py-2">
              {!showResult ? (
                <span className="text-gray-500">—</span>
              ) : skip ? (
                <span className="text-red-800">
                  Skipped: {SKIP_REASON_TEXT[skip.reason]}
                  {skip.reason === "conflict" &&
                    ` ${describeConflicts(skip.conflicts)}`}
                </span>
              ) : (
                <span className="text-green-800">Will be updated</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const BulkLicenseModal: React.FC<BulkLicenseModalProps> = ({
  open,
  rows,
  selectedIds,
  loading,
  onCancel,
  onConfirm,
}) => {
  const [license, setLicense] = useState("");
  const [version, setVersion] = useState("");
  const [recursive, setRecursive] = useState(true);

  useEffect(() => {
    if (open) {
      setLicense("");
      setVersion("");
      setRecursive(true);
    }
  }, [open]);

  const versionOptions: { key: string; label: string }[] =
    getLicenseVersionOptions(license);
  const needsVersion = versionOptions.length > 0;
  const validVersion = getValidLicenseVersion(license, version);
  const effectiveVersion = needsVersion ? validVersion || undefined : undefined;
  // Versioned licenses (e.g. CC BY) must carry a version, otherwise every
  // updated page is flagged non-compliant for a missing version.
  const licenseReady = !!license && (!needsVersion || !!validVersion);

  const plan = useMemo<BulkLicensePlanItem[]>(() => {
    const targetIds = recursive
      ? expandWithDescendants(rows, selectedIds)
      : selectedIds;
    const targets = rows.filter((row) => targetIds.has(row.id));
    return targets.map((row) => ({
      row,
      skip: licenseReady
        ? getBulkLicenseSkip(row, license, effectiveVersion)
        : null,
    }));
  }, [rows, selectedIds, recursive, license, effectiveVersion, licenseReady]);

  const toApply = plan.filter((p) => !p.skip);
  const skippedCount = plan.length - toApply.length;
  const canConfirm = licenseReady && toApply.length > 0;

  return (
    <Modal open={open} onClose={onCancel} size="lg">
      <Modal.Header>
        <Modal.Title>Change Page Licenses</Modal.Title>
        <Modal.Close aria-label="Close bulk license change" />
      </Modal.Header>
      <Modal.Body>
        <Stack direction="vertical" gap="sm">
          <Text size="sm" className="text-neutral-600">
            Apply one license to the selected pages. Pages whose Source or
            Content licenses are incompatible with the new license are skipped
            and left unchanged.
          </Text>
          <Stack direction="horizontal" gap="sm" align="end">
            <Select
              name="bulk-license"
              label="New license"
              placeholder="License..."
              options={BULK_LICENSE_OPTIONS}
              value={license}
              disabled={loading}
              onChange={(e) => {
                const next = e.target.value;
                setLicense(next);
                setVersion(getValidLicenseVersion(next, version));
              }}
            />
            {needsVersion && (
              <Select
                name="bulk-license-version"
                label="Version"
                placeholder="Version..."
                required
                options={versionOptions.map((o) => ({
                  value: o.key,
                  label: o.label,
                }))}
                value={version}
                disabled={loading}
                onChange={(e) => setVersion(e.target.value)}
              />
            )}
          </Stack>
          <Checkbox
            name="bulk-license-recursive"
            label="Include all subpages"
            description="Also apply to every page below the selected pages, at every level."
            checked={recursive}
            disabled={loading}
            onChange={setRecursive}
          />
          <Text size="sm" weight="semibold" role="status" aria-live="polite">
            {licenseReady
              ? `${toApply.length} page${toApply.length !== 1 ? "s" : ""} will be updated, ${skippedCount} skipped.`
              : `${plan.length} page${plan.length !== 1 ? "s" : ""} selected. ${license ? "Choose a version" : "Choose a license"} to preview the changes.`}
          </Text>
          <BulkLicensePreviewTable plan={plan} showResult={licenseReady} />
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="primary"
          loading={loading}
          disabled={!canConfirm || loading}
          onClick={() =>
            onConfirm(
              toApply.map((p) => p.row.id),
              license,
              effectiveVersion,
            )
          }
        >
          {`Apply to ${toApply.length} page${toApply.length !== 1 ? "s" : ""}`}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default BulkLicenseModal;
