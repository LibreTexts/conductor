import React from 'react';
import PropTypes from 'prop-types';
import { Icon } from 'semantic-ui-react';

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'tiff', 'ico'];
const PDF_EXTS = ['pdf'];
const POWERPOINT_EXTS = ['pptx', 'ppsx', 'pptm', 'ppt'];

/**
 * Generates a stylized icon depending on a file's type.
 */
const FileIcon = ({ filename, ...props }) => {

  let iconName = "file outline";
  let fileExt = filename.split('.');
  if (fileExt.length > 1) {
    fileExt = fileExt[fileExt.length - 1];
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

  return (
    <Icon name={iconName} {...props} />
  );
};

FileIcon.propTypes = {
  /**
   * The file's name, including extension.
   */
  filename: PropTypes.string.isRequired,
};

export default FileIcon;
