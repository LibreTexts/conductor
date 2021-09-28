//
// LibreTexts Conductor
// AuthHelper.js
//

import Cookies from 'js-cookie';

const AuthHelper = {
    /**
     * Checks if the user's browser has the Conductor access token.
     * @returns {Boolean} true if the token is found, false otherwise
     */
    isAuthenticated: function() {
        if (Cookies.get('conductor_access') !== undefined ){
          return true;
        }
        return false;
    },
    /**
     * Removes the Conductor access tokens from the user's browser. If the user
     * object is available and the user was authenticated via SSO, redirect the
     * user to the CAS logout endpoint. Otherwise, redirect to the main page.
     * @param {Object} user  - the global user state object
     */
    logout: function(user) {
        if (process.env.NODE_ENV === 'production') {
            Cookies.remove('conductor_access', { path: '/', domain: '.libretexts.org', secure: false });
        } else {
            Cookies.remove('conductor_access', { path: '/', domain: 'localhost', secure: false });
        }
        if (user !== null && user.hasOwnProperty('authType') && user.authType === 'sso') {
            window.location.assign('https://sso.libretexts.org/cas/logout');
        } else {
            window.location.assign('/');
        }
    }
};

export default AuthHelper;
