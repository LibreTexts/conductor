import React, { useEffect, useRef, useState } from "react";
import { IconButton, Select, Stack } from "@libretexts/davis-react";
import { IconCheck, IconX } from "@tabler/icons-react";
import {
  getLicenseVersionOptions,
  getValidLicenseVersion,
  licenseOptions,
  normalizeLicenseKey,
} from "../../util/LicenseOptions";
import type { RestackerTocLicense } from "../../../types";
import LicenseBadge from "./LicenseBadge";
import {
  parseLicenseKey,
  parseLicenseVersion,
  formatVersionDigits,
} from "./util";

export type LicenseField = "book" | "page";

interface LicenseEditorProps {
  license?: RestackerTocLicense;
  /** Which license this edits; part of the controls' accessible names. */
  field: LicenseField;
  /** Page the row belongs to; part of the controls' accessible names. */
  pageTitle: string;
  editable?: boolean;
  isEditing?: boolean;
  loading?: boolean;
  onStartEdit?: () => void;
  onCancel?: () => void;
  onSubmit: (license: string, version?: string) => void;
}

const LicenseEditor: React.FC<LicenseEditorProps> = ({
  license,
  field,
  pageTitle,
  editable,
  isEditing,
  loading,
  onStartEdit,
  onCancel,
  onSubmit,
}) => {
  const licenseKey = normalizeLicenseKey(parseLicenseKey(license) ?? "");
  // Drop a stored version the license doesn't have (e.g. GNU DSL tagged 4.0).
  const versionDigits = getValidLicenseVersion(
    licenseKey,
    formatVersionDigits(
      parseLicenseVersion(license?.version) ?? license?.version,
    ),
  );

  const [draftLicense, setDraftLicense] = useState(licenseKey);
  const [draftVersion, setDraftVersion] = useState(versionDigits ?? "");
  const initialValuesRef = useRef({
    license: licenseKey,
    version: versionDigits ?? "",
  });
  const wasEditingRef = useRef(false);

  useEffect(() => {
    if (isEditing && !wasEditingRef.current) {
      initialValuesRef.current = {
        license: licenseKey,
        version: versionDigits ?? "",
      };
      setDraftLicense(licenseKey);
      setDraftVersion(versionDigits ?? "");
    }
    wasEditingRef.current = !!isEditing;
  }, [isEditing, licenseKey, versionDigits]);

  const handleCancel = () => {
    setDraftLicense(initialValuesRef.current.license);
    setDraftVersion(initialValuesRef.current.version);
    onCancel?.();
  };

  if (!isEditing) {
    if (!editable) return <LicenseBadge license={license} />;
    // The accessible name is the visible license text ("Not set" when empty)
    // followed by what the button does, so it satisfies label-in-name and
    // tells screen-reader users which page's license it edits.
    return (
      <button
        type="button"
        onClick={onStartEdit}
        style={{
          cursor: "pointer",
          background: "transparent",
          border: 0,
          padding: 0,
          margin: 0,
          textAlign: "left",
          font: "inherit",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <LicenseBadge license={license} emptyLabel="Not set" />
        <span className="sr-only">
          , edit {field} license for {pageTitle}
        </span>
      </button>
    );
  }

  const showVersion =  getLicenseVersionOptions(draftLicense).length > 0;
  // A versioned license saved without a version is flagged non-compliant.
  const missingVersion =
    showVersion && !getValidLicenseVersion(draftLicense, draftVersion);

  const handleSubmit = () => {
    onSubmit(draftLicense, showVersion ? draftVersion || undefined : undefined);
  };

  // Wraps so Save/Cancel drop below the selects in narrow cells (and at high
  // zoom) instead of overflowing into the next column. The selects use their
  // visible labels as accessible names.
  return (
    <Stack
      direction="horizontal"
      gap="xs"
      align="center"
      className="flex-wrap py-1"
    >
      <Stack direction="vertical" gap="xs" className="w-full min-w-0">
        <Select
          name={`license-${field}`}
          label="License"
          placeholder="License..."
          options={licenseOptions.map((option) => ({
            value: option.value,
            label: option.text,
          }))}
          value={draftLicense}
          disabled={loading}
          onChange={(e) => {
            const nextLicense = e.target.value;
            setDraftLicense(nextLicense);
            setDraftVersion(getValidLicenseVersion(nextLicense, draftVersion));
          }}
        />
        {showVersion && (
          // Pending Davis fix: Select drops `required` (visual "*" only), so the
          // requirement isn't exposed to assistive tech.
          <Select
            name={`license-version-${field}`}
            label="Version"
            placeholder="Version..."
            required
            options={getLicenseVersionOptions(draftLicense).map(
              (option: { key: string; label: string }) => ({
                value: option.key,
                label: option.label,
              }),
            )}  
            value={draftVersion}
            disabled={loading}
            onChange={(e) => setDraftVersion(e.target.value)}
          />
        )}
      </Stack>
      <Stack direction="horizontal" gap="xs" align="center">
        <IconButton
          aria-label={`Save ${field} license for ${pageTitle}`}
          icon={<IconCheck size="lg" />}
          onClick={handleSubmit}
          loading={loading}
          disabled={loading || missingVersion}
        />
        <IconButton
          aria-label={`Cancel editing ${field} license for ${pageTitle}`}
          icon={<IconX size="lg" />}
          onClick={handleCancel}
          disabled={loading}
        />
      </Stack>
    </Stack>
  );
};

export default LicenseEditor;
