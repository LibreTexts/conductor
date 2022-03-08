//
// LibreTexts Conductor
// AuthHelper.js
//

import Cookies from 'js-cookie';

let AuthHelper = {};


/**
 * Checks if the user's browser has the Conductor access token.
 * @returns {Boolean} true if the token is found, false otherwise
 */
AuthHelper.isAuthenticated = () => {
    return Cookies.get('conductor_access') !== undefined;
};


/**
 * Removes the Conductor access tokens from the user's browser. If the user
 * object is available and the user was authenticated via SSO, redirect the
 * user to the CAS logout endpoint. Otherwise, redirect to the main page.
 * @param {object} [user] - The global user state object.
 * @param {boolean} [authExpired] - If the logout is the result of expired authentication.
 * @param {object} [location] - An object containing the document's current location (URL).
 */
AuthHelper.logout = (user, authExpired, location) => {
    if (process.env.NODE_ENV === 'production') {
        let domain = 'libretexts.org'; // default to LibreTexts if it can't be found in env
        if (process.env.REACT_APP_PRODUCTION_URLS) {
            domain = String(process.env.REACT_APP_PRODUCTION_URLS).split(',')[0];
        }
        Cookies.remove('conductor_access', { path: '/', domain: domain, secure: false });
    } else {
        Cookies.remove('conductor_access', { path: '/', domain: 'localhost', secure: false });
    }
    if (user !== undefined && user !== null && typeof(user) === 'object'
        && user.hasOwnProperty('authType') && user.authType === 'sso') {
        window.location.assign('https://sso.libretexts.org/cas/logout');
    } else if (authExpired) {
        let newPath = '/login?src=authexpired';
        /* Process a possibel redirect URL */
        if (typeof (location) === 'object') {
            let redirectURI = '';
            if (typeof (location.pathname) === 'string' && location.pathname.length > 0) {
                redirectURI = location.pathname;
            }
            if (typeof (location.search) === 'string' && location.search.length > 0) {
                redirectURI = `${redirectURI}${location.search}`;
            }
            if (redirectURI.length > 0) newPath = `${newPath}&redirect_uri=${encodeURIComponent(redirectURI)}`;
        }
        window.location.assign(newPath);
    } else {
        window.location.assign('/');
    }
};

export default AuthHelper;
