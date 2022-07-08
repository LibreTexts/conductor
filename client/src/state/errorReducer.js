//
// LibreTexts Conductor
// errorReducer.js
//

/* Error */
const errInitialState = {
    message: '',
    status: ''
};

export default function errorReducer(state = errInitialState, action) {
    switch(action.type) {
        case 'SET_ERROR':
            return action.payload;
        case 'CLEAR_ERROR':
            return errInitialState;
        default:
            return state;
    }
}
