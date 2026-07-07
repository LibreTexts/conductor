import React, { useEffect, useRef, useState } from "react";
import { IconButton, Select, Stack } from "@libretexts/davis-react";
import { IconCheck, IconX } from "@tabler/icons-react";
import { licenseOptions } from "../../util/LicenseOptions";
import type { RestackerTocLicense } from "../../../types";
import LicenseBadge from "./LicenseBadge";
import {
  LICENSE_VERSION_OPTIONS,
  licenseNeedsVersion,
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
  const licenseKey = parseLicenseKey(license) ?? "";
  const versionDigits = formatVersionDigits(
    parseLicenseVersion(license?.version) ?? license?.version,
  );

  const [draftLicense, setDraftLicense] = useState(licenseKey);
  const [draftVersion, setDraftVersion] = useState(versionDigits ?? "");
  const initialValuesRef = useRef({ license: licenseKey, version: versionDigits ?? "" });
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
      <div
        onDoubleClick={() => {
          if (editable) onStartEdit?.();
        }}
        style={{ cursor: editable ? "pointer" : "default" }}
        title={editable ? "Double-click to edit" : undefined}
      >
        <LicenseBadge license={license} />
      </div>
    );
  }

  const showVersion = licenseNeedsVersion(draftLicense);

  const handleSubmit = () => {
    onSubmit(
      draftLicense,
      showVersion ? draftVersion || undefined : undefined,
    );
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
            if (!licenseNeedsVersion(nextLicense)) {
              setDraftVersion("");
            }
          }}
        />
        {showVersion && (
          <Select
            name="version"
            label="Version"
            aria-label="License version"
            placeholder="Version..."
            options={LICENSE_VERSION_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
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
          disabled={loading}
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
