//
// LibreTexts Conductor
// orgReducer.js
//

/* Organization */
const orgInitialState = {
    orgID: '',
    name: '',
    shortName: '',
    abbreviation: '',
    coverPhoto: '',
    largeLogo: '',
    mediumLogo: '',
    smallLogo: '',
    aboutLink: '',
    commonsHeader: '',
    commonsMessage: ''
};

export default function orgReducer(state = orgInitialState, action) {
    switch(action.type) {
        case 'SET_ORG_INFO':
            return action.payload;
        case 'CLEAR_ORG_INFO':
            return orgInitialState;
        default:
            return state;
    }
}
