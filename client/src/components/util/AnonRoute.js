//
// AnonRoute
//  Specifies a route in which a user should NOT be authenticated.
//  If the user is authenticated, they should be redirected to the root page.
//

import { Route } from 'react-router-dom';
import React from 'react';

import AuthHelper from './AuthHelper.js';

const AnonRoute = ({ component: Component, ...rest }) => (
    <Route {...rest} render={(props) => (
        AuthHelper.isAuthenticated() === true
        ? window.location.assign('/home')
        : <Component {...props} />
    )} />
);

export default AnonRoute;
