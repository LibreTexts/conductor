//
// LibreTexts Conductor
// AuthHelper.js
//

import Cookies from 'js-cookie';

const AuthHelper = {
    isAuthenticated: function() {
        if (Cookies.get('conductor_access') !== undefined ){
          return true;
        }
        return false;
    },
    logout: function() {
        if (process.env.NODE_ENV === 'production') {
            Cookies.remove('conductor_access', { path: '/', domain: '.libretexts.org', secure: false });
        } else {
            Cookies.remove('conductor_access', { path: '/', domain: 'localhost', secure: false });
        }
    }
};

export default AuthHelper;
