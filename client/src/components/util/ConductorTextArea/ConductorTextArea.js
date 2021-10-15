//
// LibreTexts Conductor
// ConductorTextArea.js
// A reusable, customizable, and themed textarea for use in
// the Conductor UI.
//

import './ConductorTextArea.css';

import {
  Icon,
  Button
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';

const ConductorTextArea = ({
    placeholder,
    textValue,
    onTextChange,
    disableSend,
    sendLoading,
    onSendClick,
    inputType,
    showSendButton
}) => {

    const [inputTypeInternal, setInputTypeInternal] = useState('message');
    const [showSendInternal, setShowSendInternal] = useState(true);

    useEffect(() => {
        if ((inputType !== undefined) && (inputType !== null)) {
            setInputTypeInternal(inputType);
        }
        if ((showSendButton !== undefined) && (showSendButton !== null)) {
            setShowSendInternal(showSendButton);
        }
    }, [inputType, setInputTypeInternal, showSendButton, setShowSendInternal]);

    return (
        <div id='textarea-input-container'>
            <textarea
                id='textarea-input'
                placeholder={placeholder}
                value={textValue}
                onChange={(e) => {
                    if (onTextChange !== undefined) {
                        onTextChange(e.target.value)
                    }
                }}
                rows={1}
            ></textarea>
            <div id='textarea-attached'>
                <div className='left-flex'>
                    <span id='textarea-helptext'>
                        You **<strong>can</strong>** `<code>format</code>` *<em>your</em>* {inputTypeInternal}!
                    </span>
                </div>
                {showSendInternal &&
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
        </div>
    )
};

export default ConductorTextArea;
