import React from 'react';
import styles from './TextArea.module.css';
import classNames from 'classnames';

interface TextAreaProps {
  placeholder?: string;
  textValue: string;
  onTextChange: (newText: string) => void;
  hideFormatMsg?: boolean;
  contentType: string;
  error?: boolean;
  innerRef?: React.RefObject<HTMLTextAreaElement>;
  className?: string;
  rows?: number;
}

/**
 * A reusable and themed textarea.
 */
const TextArea: React.FC<TextAreaProps> = ({
  placeholder,
  textValue,
  onTextChange,
  hideFormatMsg,
  contentType,
  error,
  innerRef,
  className,
  rows = 5
}) => {

  /**
   * Activates the provided change handler, with the new value as the first argument.
   *
   * @param {React.ChangeEvent<HTMLTextAreaElement>} e - Event that activate the handler.
   */
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onTextChange(e.target.value);
  }

  return (
    <div id={styles.container} className={classNames(error ? styles.error : '', className)}>
      <textarea
        id={styles.textarea}
        placeholder={placeholder}
        value={textValue}
        onChange={handleInputChange}
        rows={rows}
        ref={innerRef}
        className='!h-100'
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

export default TextArea;
