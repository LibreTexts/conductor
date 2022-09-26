import React from 'react';
import PropTypes from 'prop-types';
import styles from './TextArea.module.css';

/**
 * A reusable and themed textarea.
 */
const TextArea = ({
  placeholder,
  textValue,
  onTextChange,
  hideFormatMsg,
  contentType,
  error
}) => {

  /**
   * Activates the provided change handler, with the new value as the first argument.
   *
   * @param {React.ChangeEvent<HTMLTextAreaElement>} e - Event that activate the handler.
   */
  function handleInputChange(e) {
    onTextChange(e.target.value);
  }

  return (
    <div id={styles.container} className={error ? styles.error : ''}>
      <textarea
        id={styles.textarea}
        placeholder={placeholder}
        value={textValue}
        onChange={handleInputChange}
        rows={1}
      />
      {!hideFormatMsg && (
        <div id={styles.format_msg}>
          <span id={styles.format_msg_text}>
            You **<strong>can</strong>** `<code>format</code>` *<em>your</em>* {contentType}!
          </span>
        </div>
      )}
    </div>
  )
};

TextArea.propTypes = {
  placeholder: PropTypes.string,
  textValue: PropTypes.string,
  onTextChange: PropTypes.func,
  hideFormatMsg: PropTypes.bool,
  contentType: PropTypes.string,
  error: PropTypes.bool,
};

TextArea.defaultProps = {
  placeholder: 'Enter text here...',
  textValue: '',
  onTextChange: () => { },
  hideFormatMsg: false,
  contentType: 'message',
  error: false,
};


export default TextArea;
