import React from 'react';
import PropTypes from 'prop-types';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';

/**
 * A speedometer-like progress bar used to display completion of a certain aspect of a project.
 */
const ProjectProgressBar = ({ progress, showPercent, type, ...props }) => {
  const BASE_STYLE = {
    rotation: 1 / 2 + 1/ 8,
    strokeLinecap: 'butt', 
  };
  const STROKE_WIDTH = 5;
  const CIRCLE_RATIO = 0.75;

  let barColor = '#127BC4';
  if (type === 'peer') {
    barColor = '#CD4D12';
  }
  if (type === 'a11y') {
    barColor = '#00B5AD';
  }
  const computedStyles = buildStyles({
    ...BASE_STYLE,
    pathColor: barColor,
    textColor: barColor,
  });

  return (
    <CircularProgressbar
      value={progress}
      text={showPercent ? `${progress}%` : undefined}
      strokeWidth={STROKE_WIDTH}
      circleRatio={CIRCLE_RATIO}
      styles={computedStyles}
      {...props}
    />
  )
};

ProjectProgressBar.propTypes = {
  /**
   * Integer representing progress out of 100.
   */
  progress: PropTypes.number,
  /**
   * Include the progress percentage as text in the center of the progress bar.
   */
  showPercent: PropTypes.bool,
  /**
   * The project aspect being represented by the progress bar.
   */
  type: PropTypes.oneOf(['progress', 'peer', 'a11y']),
};

ProjectProgressBar.defaultProps = {
  progress: 0,
  showPercent: false,
  type: 'progress',
};

export default ProjectProgressBar;