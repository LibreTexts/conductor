import React from "react";
import { RestackerTocLicense } from "../../../types";
import { parseLicenseKey, parseLicenseVersion } from "./util";
import { getLicenseColor } from "../../util/BookHelpers";
import { getLicenseText } from "../../util/LicenseOptions";

interface LicenseBadgeProps {
  license?: RestackerTocLicense;
  /**
   * Visible text when there is no license (e.g. "Not set" on an editable
   * license button). Without it, a dash is shown and read as "None".
   */
  emptyLabel?: string;
}

/** Placeholder for a missing license; #4b5563 keeps 4.5:1 on white. */
export const EmptyLicense: React.FC<{ label?: string }> = ({ label }) =>
  label ? (
    <span style={{ color: "#4b5563" }}>{label}</span>
  ) : (
    <span style={{ color: "#4b5563" }}>
      <span aria-hidden="true">—</span>
      <span className="sr-only">None</span>
    </span>
  );

const LicenseBadge: React.FC<LicenseBadgeProps> = (props) => {
  const { license, emptyLabel } = props;
  if (!license?.label) {
    return <EmptyLicense label={emptyLabel} />;
  }
  const key = parseLicenseKey(license);
  if (!key) {
    return <EmptyLicense label={emptyLabel} />;
  }
  const version = parseLicenseVersion(license.version);
  const bgColor = getLicenseColor(key);
  const text = getLicenseText(key, version ?? "");
  return (
    <span
      style={{
        backgroundColor: bgColor || "#6b7280",
        color: "#fff",
        padding: "2px 10px",
        borderRadius: 3,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: "18px",
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        boxSizing: "border-box",
        minHeight: 22,
      }}
    >
      {text}
    </span>
  );
};

LicenseBadge.propTypes = {};

export default LicenseBadge;
