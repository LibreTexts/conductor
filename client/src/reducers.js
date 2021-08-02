import Cookies from 'js-cookie';

/* User */
export const userInitialState = {
    firstName: '',
    lastName: '',
    avatar: '/favicon-96x96.png',
    roles: [],
    isAuthenticated: false,
    org: {
        orgID: '',
        name: '',
        shortName: '',
        abbreviation: '',
        coverPhoto: '/coverphoto_default.jpg',
        largeLogo: '',
        mediumLogo: '',
        smallLogo: '',
        aboutLink: ''
    }
};

export function userReducer(state, action) {
    switch(action.type) {
        case 'SET_AUTH':
            return {
                ...state,
                isAuthenticated: true
            }
        case 'CHECK_AUTH':
            if (Cookies.get('access_token') !== undefined) {
                return {
                    ...state,
                    isAuthenticated: true
                }
            } else {
                return state;
            }
        case 'CLEAR_AUTH':
            return {
                ...state,
                isAuthenticated: false
            }
        case 'SET_USER_INFO':
            return {
                ...state,
                firstName: action.firstName,
                lastName: action.lastName,
                roles: action.roles,
                avatar: action.avatar
            }
        case 'CLEAR_USER_INFO':
            return {
                ...state,
                userInitialState
            }
        case 'SET_ORG_INFO':
            return {
                ...state,
                org: action.org
            }
        default:
            return state;
    }
};
