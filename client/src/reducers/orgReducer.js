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
    coverPhoto: '/coverphoto_default.jpg',
    largeLogo: '',
    mediumLogo: '',
    smallLogo: '',
    aboutLink: ''
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
