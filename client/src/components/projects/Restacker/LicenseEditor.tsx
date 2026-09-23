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
  editable?: boolean;
  isEditing?: boolean;
  loading?: boolean;
  onStartEdit?: () => void;
  onCancel?: () => void;
  onSubmit: (license: string, version?: string) => void;
}

const LicenseEditor: React.FC<LicenseEditorProps> = ({
  license,
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
    return (
      <button
        type="button"
        onClick={() => {
          if (editable) onStartEdit?.();
        }}
        style={{
          cursor: editable ? "pointer" : "default",
          background: "transparent",
          border: 0,
          padding: 0,
          margin: 0,
          textAlign: "left",
          font: "inherit",
          lineHeight: 0,
          display: "inline-flex",
          alignItems: "center",
        }}
        title={editable ? "Click to edit" : undefined}
        disabled={!editable}
        aria-label={editable ? "Edit license" : undefined}
      >
        <LicenseBadge license={license} />
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

  return (
    <Stack direction="horizontal" gap="xs" align="center" className="py-1">
      <Stack direction="vertical" gap="xs" className="min-w-[120px]">
        <Select
          name="license"
          label="License"
          aria-label="License"
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
          <Select
            name="version"
            label="Version"
            aria-label="License version"
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
          aria-label="Save license"
          icon={<IconCheck size="lg" />}
          onClick={handleSubmit}
          loading={loading}
          disabled={loading || missingVersion}
        />
        <IconButton
          aria-label="Cancel editing"
          icon={<IconX size="lg" />}
          onClick={handleCancel}
          disabled={loading}
        />
      </Stack>
    </Stack>
  );
};

export default LicenseEditor;
