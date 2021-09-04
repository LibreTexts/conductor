import Cookies from 'js-cookie';

const AuthHelper = {
    isAuthenticated: function() {
        if (Cookies.get('conductor_access') !== undefined ){
          return true;
        }
        return false;
    }
};

export default AuthHelper;
