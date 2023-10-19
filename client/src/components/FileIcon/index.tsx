import React from "react";
import { Icon, IconProps, SemanticICONS } from "semantic-ui-react";

const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "tiff", "ico"];
const PDF_EXTS = ["pdf"];
const POWERPOINT_EXTS = ["pptx", "ppsx", "pptm", "ppt"];

interface FileIconProps extends IconProps {
  filename: string;
}

/**
 * Generates a stylized icon depending on a file's type.
 */
const FileIcon: React.FC<FileIconProps> = ({ filename, ...props }) => {
  let iconName: SemanticICONS = "file outline";
  const extArr = filename.split(".");
  let fileExt;
  if (extArr.length > 1) {
    fileExt = extArr[extArr.length - 1];
    if (IMAGE_EXTS.includes(fileExt)) {
      iconName = "file image outline";
    }
    if (PDF_EXTS.includes(fileExt)) {
      iconName = "file pdf outline";
    }
    if (POWERPOINT_EXTS.includes(fileExt)) {
      iconName = "file powerpoint outline";
    }
  }

  return <Icon name={iconName} {...props} />;
};

export default FileIcon;
