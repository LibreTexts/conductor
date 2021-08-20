import Cookies from 'js-cookie';
import { isEmptyString } from './components/util/HelperFunctions.js';

/* User */
export const userInitialState = {
    firstName: '',
    lastName: '',
    avatar: '/favicon-96x96.png',
    roles: [],
    isAuthenticated: false,
    isCampusAdmin: false,
    isSuperAdmin: false,
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

/**
 * Accepts an array of the User's @roles and
 * returns true if the user is a CampusAdmin
 * in the current instance, false otherwise.
 */
const checkCampusAdmin = (roles) => {
    if ((roles !== undefined) && (Array.isArray(roles)) && !isEmptyString(process.env.REACT_APP_ORG_ID)) {
        var foundCampusAdmin = roles.find((element) => {
            if (element.org && element.role) {
                if ((element.org === process.env.REACT_APP_ORG_ID) && (element.role === 'campusadmin')) {
                    return element;
                }
            }
            return null;
        });
        if (foundCampusAdmin !== undefined) {
            return true;
        } else {
            return false;
        }
    } else {
        return false
    }
};

/**
 * Accepts an array of the User's @roles and
 * returns true if the user is a SuperAdmin
 * in Conductor, false otherwise.
 */
const checkSuperAdmin = (roles) => {
    if ((roles !== undefined) && (Array.isArray(roles))) {
        var foundCampusAdmin = roles.find((element) => {
            if (element.org && element.role) {
                if ((element.org === 'libretexts') && (element.role === 'superadmin')) {
                    return element;
                }
            }
            return null;
        });
        if (foundCampusAdmin !== undefined) {
            return true;
        } else {
            return false;
        }
    } else {
        return false
    }
};

/**
 * Dispatch User Reducer
 */
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
                avatar: action.avatar,
                isCampusAdmin: checkCampusAdmin(action.roles),
                isSuperAdmin: checkSuperAdmin(action.roles)
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
