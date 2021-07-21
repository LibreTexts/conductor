//
// PrivateRoute
//  Specifies a route in which a user SHOULD be authenticated
//  If the user is authenticated, they should be redirected to login
//

import { Route } from 'react-router-dom';
import React from 'react';

import AuthHelper from './AuthHelper.js';

const PrivateRoute = ({ component: Component, ...rest }) => (
    <Route {...rest} render={(props) => (
        AuthHelper.isAuthenticated() === true
        ? <Component {...props} />
        : window.location.assign('/login')
    )} />
);

export default PrivateRoute;
