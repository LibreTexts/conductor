import React from 'react';
import PropTypes from 'prop-types';
import styles from './ProgressBar.module.css';

/**
 * Graphical element to visualize the progress of a task.
 */
const ProgressBar = ({ value, label, max, ...props }) => {

  const fixedPrecision = value.toFixed(2);

  return (
    <div>
      {label}
      <progress max={max} value={fixedPrecision} className={styles.progress_bar} {...props}>
        {fixedPrecision}%
      </progress>
    </div>
  );
};

ProgressBar.propTypes = {
  /**
   * The current progress on the task. Should be less than or equal to `max`.
   */
  value: PropTypes.number,
  /**
   * A label for the task represented by the progress bar. If used, the label should be
   * associated with the progress bar via the `htmlFor` and `id` attributes, respectively.
   */
  label: PropTypes.node,
  /**
   * The maximum value of the progress bar. Defaults to `100`.
   */
  max: PropTypes.number,
};

ProgressBar.defaultProps = {
  value: 0,
  max: 100,
};

export default ProgressBar;
