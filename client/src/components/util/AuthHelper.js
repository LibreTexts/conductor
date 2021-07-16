import Cookies from 'js-cookie';

const AuthHelper = {
    isAuthenticated: function() {
        if (Cookies.get('access_token') !== undefined ){
          return true;
        }
        return false;
    }
};

export default AuthHelper;
