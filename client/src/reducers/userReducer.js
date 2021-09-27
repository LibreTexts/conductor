//
// LibreTexts Conductor
// userReducer.js
//

/* Utils */
import Cookies from 'js-cookie';
import { isEmptyString } from '../components/util/HelperFunctions.js';

/* User */
const userInitialState = {
    uuid: '',
    firstName: '',
    lastName: '',
    avatar: '/favicon-96x96.png',
    roles: [],
    isAuthenticated: false,
    isCampusAdmin: false,
    isSuperAdmin: false
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

export default function userReducer(state = userInitialState, action) {
    switch(action.type) {
        case 'SET_AUTH':
            return {
                ...state,
                isAuthenticated: true
            }
        case 'CHECK_AUTH':
            if (Cookies.get('conductor_access') !== undefined) {
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
        case 'SET_USER_NAME':
            return {
                ...state,
                firstName: action.payload.firstName,
                lastName: action.payload.lastName
            }
        case 'SET_USER_INFO':
            return {
                ...state,
                uuid: action.payload.uuid,
                firstName: action.payload.firstName,
                lastName: action.payload.lastName,
                roles: action.payload.roles,
                avatar: action.payload.avatar,
                isCampusAdmin: checkCampusAdmin(action.payload.roles),
                isSuperAdmin: checkSuperAdmin(action.payload.roles)
            }
        case 'CLEAR_USER_INFO':
            return userInitialState;
        default:
            return state;
    }
};
