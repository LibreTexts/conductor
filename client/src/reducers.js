/* User */
export const userInitialState = {
    firstName: '',
    lastName: '',
    avatar: '',
    roles: [],
    isAuthenticated: false
};

export function userReducer(state, action) {
    switch(action.type) {
        case 'SET_LOCAL_TOKEN':
            localStorage.setItem('lbrtxts-pts-auth', action.token);
            return state;
        case 'CHECK_LOCAL_TOKEN':
            const token = localStorage.getItem('lbrtxts-pts-auth');
            if (token) {
                return {
                    ...state,
                    isAuthenticated: true
                }
            } else {
                return state;
            }
        case 'CLEAR_LOCAL_DATA':
            localStorage.clear();
            return state;
        case 'SET_AUTH_TRUE':
            return {
                ...state,
                isAuthenticated: true
            }
        case 'SET_AUTH_FALSE':
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
        default:
            return state;
    }
};
