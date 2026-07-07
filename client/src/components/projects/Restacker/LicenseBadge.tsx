import React from "react";
import { RestackerTocLicense } from "../../../types";
import { parseLicenseKey, parseLicenseVersion } from "./util";
import { getLicenseColor } from "../../util/BookHelpers";
import { getLicenseText } from "../../util/LicenseOptions";

interface LicenseBadgeProps {
  license?: RestackerTocLicense;
}

const LicenseBadge: React.FC<LicenseBadgeProps> = (props) => {
  const { license } = props;
  if (!license?.label) {
    return <span style={{ color: "#9ca3af" }}>—</span>;
  }
  const key = parseLicenseKey(license);
  if (!key) {
    return <span style={{ color: "#9ca3af" }}>—</span>;
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
        whiteSpace: "nowrap",
        display: "inline-block",
      }}
    >
      {text}
    </span>
  );
};

LicenseBadge.propTypes = {};

export default LicenseBadge;
