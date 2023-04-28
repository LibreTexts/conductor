//
// LibreTexts Conductor
// errorReducer.js
//

import { AnyAction } from "redux";

/* Error */
const errInitialState = {
    message: '',
    status: '',
    relevantLinkTitle: '',
    relevantLinkHREF: ''
};

export default function errorReducer(state = errInitialState, action: AnyAction) {
    switch(action.type) {
        case 'SET_ERROR':
            return action.payload;
        case 'CLEAR_ERROR':
            return errInitialState;
        default:
            return state;
    }
}
