const AuthHelper = {
    isAuthenticated: function() {
        if (localStorage.getItem('lbrtxts-pts-auth') != null) {
            return true;
        }
        return false;
    }
};

export default AuthHelper;
