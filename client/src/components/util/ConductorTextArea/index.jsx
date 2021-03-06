//
// LibreTexts Conductor
// ConductorTextArea/index.js
// A reusable, customizable, and themed textarea for use in
// the Conductor UI.
//

import './ConductorTextArea.css';

import {
    Icon,
    Button
} from 'semantic-ui-react';
import React from 'react';
import PropTypes from 'prop-types';

const ConductorTextArea = ({
    placeholder,
    textValue,
    onTextChange,
    disableSend,
    sendLoading,
    onSendClick,
    inputType,
    showSendButton,
    hideAttached,
    error
}) => {

    return (
        <div id='textarea-input-container' className={error ? 'textarea-error' : ''}>
            <textarea
                id='textarea-input'
                placeholder={placeholder}
                value={textValue}
                onChange={(e) => {
                    if (onTextChange !== undefined) {
                        onTextChange(e.target.value);
                    }
                }}
                rows={1}
                className={showSendButton ? 'has-send-button' : ''}
            ></textarea>
            {!hideAttached && (
                <div id='textarea-attached'>
                    <div className='left-flex'>
                        <span id='textarea-helptext'>
                            You **<strong>can</strong>** `<code>format</code>` *<em>your</em>* {inputType}!
                        </span>
                    </div>
                    {showSendButton &&
                        <div className='right-flex'>
                            <Button
                                disabled={disableSend}
                                loading={sendLoading}
                                onClick={onSendClick}
                                color='blue'
                                floated='right'
                            >
                                <Icon name='send' />
                                Send
                            </Button>
                        </div>
                    }
                </div>
            )}
        </div>
    )
};

ConductorTextArea.defaultProps = {
    placeholder: 'Enter text here...',
    textValue: '',
    onTextChange: () => {},
    disableSend: false,
    sendLoading: false,
    onSendClick: () => {},
    inputType: 'message',
    showSendButton: true,
    hideAttached: false,
    error: false
};

ConductorTextArea.propTypes = {
    placeholder: PropTypes.string,
    textValue: PropTypes.string,
    onTextChange: PropTypes.func,
    disableSend: PropTypes.bool,
    sendLoading: PropTypes.bool,
    onSendClick: PropTypes.func,
    inputType: PropTypes.string,
    showSendButton: PropTypes.bool,
    hideAttached: PropTypes.bool,
    error: PropTypes.bool
};

export default ConductorTextArea;
